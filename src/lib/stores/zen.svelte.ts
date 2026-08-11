import { browser } from '$app/environment';
import { replaceState as svelteKitReplaceState, afterNavigate } from '$app/navigation';
import { appendProjectParam } from '$lib/project';
import { setIssueStateApi } from '$lib/api';
import { fetchMutations } from '$lib/mutationStore.svelte';
import type { Issue } from '$lib/types';
import type { TriageAction } from '$lib/zen-triage';

export interface ZenContext {
	getIssues: () => Issue[];
	getFilteredIssues: () => Issue[];
	getSelectedId: () => string | null;
	updateIssue: (id: string, updates: Partial<Issue>) => Promise<void>;
	openIssueById: (id: string, pushState?: boolean) => void;
}

/** Zen focus review plus the `?zen=` / `?issue=` deep-link entrypoints. */
export function createZen(ctx: ZenContext, preload: Issue[] = []) {
	let open = $state(false);
	let ids = $state<string[]>([]);
	let index = $state(0);
	// The deep link's own issues — SSR-seeded, so Zen paints without waiting for the board.
	let zenPreload = $state<Issue[]>(preload);

	function openReview(list?: string[], startIndex?: number) {
		const next = list && list.length ? list : ctx.getFilteredIssues().map((i) => i.id);
		if (!next.length) return;
		ids = next;
		const selectedId = ctx.getSelectedId();
		const seeded = startIndex ?? (selectedId ? next.indexOf(selectedId) : -1);
		index = seeded >= 0 ? seeded : 0;
		open = true;
	}

	// Quick triage (Q in Zen): record the pick as a `triage:<value>` state
	// label and reprioritize when the action carries one. Sequential awaits —
	// bd writes to the same issue must not overlap.
	async function handleQuickAction(issue: Issue, action: TriageAction) {
		if (action.priority !== undefined && action.priority !== issue.priority) {
			await ctx.updateIssue(issue.id, { priority: action.priority });
		}
		await setIssueStateApi(issue.id, 'triage', action.value, `Zen triage: ${action.label}`);
		fetchMutations();
	}

	// Deep-link entrypoint: ?zen=bd-1,bd-2,bd-3 opens focus review on load.
	// The param is consumed (stripped) so a refresh/close doesn't force it back.
	async function consumeZenParam(raw: string) {
		const wanted = raw.split(',').map((s) => s.trim()).filter(Boolean);
		if (browser) {
			const url = new URL(window.location.href);
			url.searchParams.delete('zen');
			svelteKitReplaceState(url.pathname + url.search + url.hash, {});
		}
		if (!wanted.length) return;
		// Client-side navigation to ?zen= skips the server load, so fetch just those issues.
		if (!zenPreload.length) {
			const res = await fetch(
				appendProjectParam(`/api/issues?ids=${encodeURIComponent(wanted.join(','))}`)
			);
			const payload = await res.json().catch(() => null);
			zenPreload = payload?.ok ? (payload.data?.issues ?? []) : [];
		}
		// Accept the short form people actually write (`uhgp.17`) as well as the
		// prefixed id bd stores (`myproject-uhgp.17`) — same leniency as `bd show`.
		const list = wanted.map(
			(id) =>
				zenPreload.find((i) => i.id === id)?.id ??
				zenPreload.find((i) => i.id.endsWith(`-${id}`))?.id ??
				id
		);
		openReview(list, 0);
	}

	let zenParamChecked = false;
	let initialUrlChecked = false;
	// pushState/replaceState throw until the router has finished initializing,
	// so wait for the first navigation before touching the URL.
	let routerReady = $state(false);
	afterNavigate(() => { routerReady = true; });

	// Zen deep link fetches its own issues, so it must not wait for the board.
	$effect(() => {
		if (!browser || !routerReady || zenParamChecked) return;
		zenParamChecked = true;
		const zenParam = new URL(window.location.href).searchParams.get('zen');
		if (zenParam) {
			initialUrlChecked = true; // ?zen wins over ?issue
			consumeZenParam(zenParam);
		}
	});

	$effect(() => {
		if (!browser || !routerReady || initialUrlChecked || ctx.getIssues().length === 0) return;
		initialUrlChecked = true;
		const issueId = new URL(window.location.href).searchParams.get('issue');
		if (issueId) ctx.openIssueById(issueId, false);
	});

	return {
		get open() { return open; },
		get ids() { return ids; },
		get index() { return index; },
		set index(v: number) { index = v; },
		/** Board issues once loaded, else the deep link's own SSR-seeded set. */
		get issues() { const list = ctx.getIssues(); return list.length ? list : zenPreload; },
		openReview,
		close() { open = false; },
		handleQuickAction
	};
}

export type Zen = ReturnType<typeof createZen>;
