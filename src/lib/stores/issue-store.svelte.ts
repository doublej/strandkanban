import type { Issue, LoadingStatus } from '$lib/types';
import type { BoardAnimation } from '$lib/stores/board-animation.svelte';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { appendProjectParam } from '$lib/project';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';

/**
 * Backstop poll interval. bd's Dolt backend flushes .beads/issues.jsonl on a delayed,
 * coalesced cadence (several seconds), so the server's fs.watch — which drives
 * external-write events — lags well behind the actual change. Polling refreshIssues()
 * keeps the board live regardless of that cadence.
 *
 * 10s, not 2s: a no-change poll still maps every row server-side, serializes the board and
 * hashes it here, so it is a permanent CPU floor on a blocking event loop. SSE covers
 * in-app and (via fs.watch) most external writes; this only has to cover their gaps.
 */
const POLL_INTERVAL_MS = 10_000;

export interface IssueStoreCallbacks {
	onNewIssue: (issue: Issue) => void;
	onStatusChange: (issue: Issue, oldStatus: string) => void;
	/** Card teleport animation — measured before, flown after, the issue list swap. */
	animation: BoardAnimation;
	notifyTicket: (id: string, message: string, type: 'status' | 'priority' | 'assignee', context: { ticketTitle: string; sender: string }) => void;
	onEditingIssueClosedExternally: () => void;
	getEditingIssue: () => Issue | null;
	getIsCreating: () => boolean;
}

export function createIssueStore(callbacks: IssueStoreCallbacks, initialIssues: Issue[] = []) {
	// SSR can seed the board so it paints filled on first load. When seeded, mark it
	// ready (InitialLoader won't flash) and prime lastSnapshotHash below so the first
	// live refresh doesn't re-animate every card.
	const seeded = initialIssues.length > 0;
	let issues = $state<Issue[]>(initialIssues);
	let pendingUpdates = $state<Map<string, { updates: Partial<Issue>; timestamp: number }>>(new Map());
	let pendingDeletes = $state<Set<string>>(new Set());
	let animatingIds = $state<Set<string>>(new Set());
	let loadingStatus = $state<LoadingStatus>({
		phase: seeded ? 'ready' : 'disconnected',
		pollCount: 0,
		lastUpdate: null,
		issueCount: initialIssues.length,
		hasChanges: false,
		errorMessage: null
	});
	let initialLoaded = $state(seeded);
	let sseSource = $state<EventSource | null>(null);
	let pollTimer: ReturnType<typeof setInterval> | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

	function mergeWithPendingUpdates(sseIssues: Issue[]): Issue[] {
		const now = Date.now();
		const PENDING_TIMEOUT = 10000;

		const filtered = sseIssues.filter(issue => !pendingDeletes.has(issue.id));

		// Clean up confirmed deletes
		const sseIds = new Set(sseIssues.map(i => i.id));
		const originalSize = pendingDeletes.size;
		for (const id of pendingDeletes) {
			if (!sseIds.has(id)) pendingDeletes.delete(id);
		}
		if (pendingDeletes.size !== originalSize) {
			pendingDeletes = new Set(pendingDeletes);
		}

		return filtered.map(issue => {
			const pending = pendingUpdates.get(issue.id);
			if (!pending) return issue;

			const record = issue as unknown as Record<string, unknown>;
			const isConfirmed = Object.entries(pending.updates).every(
				([key, value]) => record[key] === value
			);

			if (isConfirmed || now - pending.timestamp > PENDING_TIMEOUT) {
				pendingUpdates.delete(issue.id);
				pendingUpdates = new Map(pendingUpdates);
				return issue;
			}

			return { ...issue, ...pending.updates };
		});
	}

	function handleStatusChanges(data: { issues: Issue[] }, oldIssuesMap: Map<string, Issue>) {
		const statusChanges: { id: string; newStatus: string }[] = [];

		for (const issue of data.issues) {
			const oldIssue = oldIssuesMap.get(issue.id);
			if (!oldIssue) {
				callbacks.onNewIssue(issue);
			} else if (oldIssue.status !== issue.status) {
				statusChanges.push({ id: issue.id, newStatus: issue.status });
				callbacks.onStatusChange(issue, oldIssue.status);
			}
		}

		if (statusChanges.length === 0) {
			issues = mergeWithPendingUpdates(data.issues);
			return;
		}

		const measurements = callbacks.animation.measureStatusChanges(statusChanges);

		// Update state immediately (cards will shrink, not hide)
		issues = mergeWithPendingUpdates(data.issues);

		callbacks.animation.flyStatusChanges(measurements, (id) => issues.find(i => i.id === id));
	}

	function checkEditingIssueClosed(data: { issues: Issue[] }) {
		const editing = callbacks.getEditingIssue();
		if (!editing || callbacks.getIsCreating()) return;

		const updated = data.issues.find((i: Issue) => i.id === editing.id);
		if (updated && updated.status === 'closed' && editing.status !== 'closed') {
			callbacks.onEditingIssueClosedExternally();
		}
	}

	let pollCount = 0;

	function snapshotHash(items: Issue[]): string {
		return items.map((i) => `${i.id}:${i.updated_at ?? ''}:${i.status}`).join('|');
	}

	// Primed from SSR-seeded issues so the first live refresh diffs against what's
	// already on screen instead of re-animating every card.
	let lastSnapshotHash = snapshotHash(initialIssues);

	async function refreshIssues(scope?: 'active') {
		try {
			if (!initialLoaded && loadingStatus.phase !== 'loading') {
				loadingStatus = { ...loadingStatus, phase: 'loading' };
			}
			const path = scope ? `/api/issues?scope=${scope}` : '/api/issues';
			const res = await fetch(appendProjectParam(path));
			const payload = await res.json();
			if (!payload?.ok) {
				loadingStatus = { ...loadingStatus, phase: 'error', errorMessage: payload?.error?.message ?? 'Load failed' };
				return;
			}
			const data = { issues: payload.data?.issues ?? [] };
			pollCount += 1;

			const hash = snapshotHash(data.issues);
			const hasChanges = hash !== lastSnapshotHash;
			lastSnapshotHash = hash;

			loadingStatus = {
				...loadingStatus,
				phase: 'ready',
				pollCount,
				lastUpdate: Date.now(),
				issueCount: data.issues.length,
				hasChanges,
				errorMessage: null,
			};
			if (!initialLoaded) {
				initialLoaded = true;
			}
			if (!hasChanges) return;

			const oldIssuesMap = new Map(issues.map((i) => [i.id, i]));
			checkEditingIssueClosed(data);
			handleStatusChanges(data, oldIssuesMap);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			loadingStatus = { ...loadingStatus, phase: 'error', errorMessage: msg };
		}
	}

	function cancelReconnect() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
	}

	function connectSSE(): EventSource {
		// A retry queued by a previous stream must not open a second one on top of this.
		cancelReconnect();
		if (!initialLoaded) {
			loadingStatus = { ...loadingStatus, phase: 'connecting' };
		}
		const eventSource = new EventSource(appendProjectParam('/api/events/stream'));
		sseSource = eventSource;

		// Initial snapshot fires on open; subsequent refreshes triggered by events.
		// Skip the immediate fetch when SSR already seeded the board — the backstop
		// poll and SSE events keep it live. Net: zero client-side exports on cold load.
		// Two-phase: open issues paint the board first (~30% of the payload on a big
		// project), then the full list — including Complete — replaces it a moment later.
		// Both hit the server's export cache, so phase two costs a serialization, not a
		// second `bd export`. No user action gates anything; if phase two fails,
		// loadingStatus surfaces it as today.
		if (!initialLoaded) void refreshIssues('active').then(() => refreshIssues());

		// Backstop poll (de-duped via snapshotHash, so no UI churn when nothing changed):
		// SSE events fire instantly for in-app writes but lag several seconds for external
		// (agent/CLI) writes because they hinge on bd's delayed issues.jsonl export.
		if (pollTimer) clearInterval(pollTimer);
		pollTimer = setInterval(() => void refreshIssues(), POLL_INTERVAL_MS);

		eventSource.onmessage = (event) => {
			let msg: { type?: string; name?: string };
			try { msg = JSON.parse(event.data); } catch { return; }
			if (msg.type === 'event') {
				void refreshIssues();
			}
		};

		eventSource.onerror = () => {
			eventSource.close();
			loadingStatus = { ...loadingStatus, phase: 'disconnected' };
			cancelReconnect();
			reconnectTimer = setTimeout(() => connectSSE(), 3000);
		};

		return eventSource;
	}

	function addAnimatingId(id: string) {
		animatingIds = new Set([...animatingIds, id]);
		setTimeout(() => {
			animatingIds = new Set([...animatingIds].filter(x => x !== id));
		}, 600);
	}

	/**
	 * Show a change on the board before the tracker confirms it. Pending changes to the same
	 * issue accumulate, so two quick edits don't let the first one flicker back.
	 */
	function patchLocal(id: string, updates: Partial<Issue>, displayOnly: Partial<Issue> = {}) {
		const prev = pendingUpdates.get(id)?.updates;
		pendingUpdates.set(id, { updates: { ...prev, ...updates }, timestamp: Date.now() });
		pendingUpdates = new Map(pendingUpdates);

		const idx = issues.findIndex(i => i.id === id);
		if (idx !== -1) {
			issues = [...issues.slice(0, idx), { ...issues[idx], ...updates, ...displayOnly }, ...issues.slice(idx + 1)];
		}
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		const original = issues.find(i => i.id === id);
		const title = original?.title ?? id;

		// updated_at is display-only: the tracker's own timestamp never matches it, so it must
		// not join the pending set that waits for confirmation.
		patchLocal(id, updates, { updated_at: new Date().toISOString() });
		addAnimatingId(id);

		const res = await fetch(appendProjectParam(`/api/issues/${id}`), {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(updates)
		});
		const payload = await res.json();
		if (!payload?.ok) {
			// Drop the optimistic value so the next refresh shows what the tracker really has.
			pendingUpdates.delete(id);
			pendingUpdates = new Map(pendingUpdates);
			toastQueue.show({ type: 'error', title: 'Save failed', message: payload?.error?.message ?? `Could not update ${id}`, duration: 6000 });
			return;
		}
		fetchMutations();

		// Notify agents about field changes
		const ctx = { ticketTitle: title, sender: 'user' };
		if (updates.status && original?.status !== updates.status) {
			callbacks.notifyTicket(id, `Status changed: ${original?.status} \u2192 ${updates.status}`, 'status', ctx);
		}
		if (updates.priority !== undefined && original?.priority !== updates.priority) {
			callbacks.notifyTicket(id, `Priority changed: ${original?.priority} \u2192 ${updates.priority}`, 'priority', ctx);
		}
		if (updates.assignee !== undefined && original?.assignee !== updates.assignee) {
			callbacks.notifyTicket(id, `Assignee changed: ${original?.assignee || 'unassigned'} \u2192 ${updates.assignee || 'unassigned'}`, 'assignee', ctx);
		}
	}

	async function deleteIssue(id: string): Promise<boolean> {
		if (!confirm('Delete this issue permanently?')) return false;
		addAnimatingId(id);
		pendingDeletes.add(id);
		pendingDeletes = new Set(pendingDeletes);
		issues = issues.filter(i => i.id !== id);

		await fetch(appendProjectParam(`/api/issues/${id}`), { method: 'DELETE' });
		fetchMutations();
		return true;
	}

	/** `deps` are ids the new issue is blocked by; bd links them in the same create call. */
	async function createIssue(form: { title: string; description: string; priority: number; issue_type: string; deps?: string[] }): Promise<string | null> {
		if (!form.title.trim()) return null;

		const tempId = `temp-${Date.now()}`;
		// Estimate next seq as current max + 1 (will be corrected by SSE)
		const maxSeq = issues.reduce((max, i) => Math.max(max, i.seq ?? 0), 0);
		const tempIssue: Issue = {
			id: tempId,
			seq: maxSeq + 1,
			title: form.title,
			description: form.description,
			status: 'open',
			priority: form.priority as Issue['priority'],
			issue_type: form.issue_type,
			labels: [],
			dependencies: (form.deps ?? []).map((id) => {
				const dep = issues.find((i) => i.id === id);
				return { id, title: dep?.title ?? id, status: dep?.status ?? 'open', dependency_type: 'blocks' };
			}),
			dependents: [],
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		};
		issues = [tempIssue, ...issues];
		addAnimatingId(tempId);

		const res = await fetch(appendProjectParam('/api/issues'), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(form)
		});
		const payload = await res.json();
		const id = payload?.ok ? payload.data?.id : null;
		fetchMutations();
		return id ?? null;
	}

	function closeSse() {
		cancelReconnect();
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = null;
		}
		if (sseSource) {
			sseSource.close();
			sseSource = null;
		}
	}

	function setIssues(newIssues: Issue[]) {
		issues = newIssues;
	}

	return {
		get issues() { return issues; },
		get animatingIds() { return animatingIds; },
		get loadingStatus() { return loadingStatus; },
		get initialLoaded() { return initialLoaded; },
		get sseSource() { return sseSource; },
		set initialLoaded(v: boolean) { initialLoaded = v; },
		connectSSE,
		closeSse,
		setIssues,
		patchLocal,
		updateIssue,
		deleteIssue,
		createIssue
	};
}

export type IssueStore = ReturnType<typeof createIssueStore>;
