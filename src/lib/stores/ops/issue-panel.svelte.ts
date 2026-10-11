import { browser } from '$app/environment';
import { pushState as svelteKitPushState } from '$app/navigation';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { appendProjectParam } from '$lib/project';
import type { Issue, Comment, Attachment } from '$lib/types';
import { getIssueColumn, columns } from '$lib/utils';
import { hasDirtyDrafts, labelUpdate, type DraftField, type Drafts } from '$lib/pane-logic';
import { ApiClientError } from '$lib/http';
import {
	loadAttachmentsApi,
	uploadAttachmentApi,
	deleteAttachmentApi,
	setIssueStateApi,
	promoteWispApi
} from '$lib/api';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';
import type { IssueStore } from '$lib/stores/issue-store.svelte';
import type { NotifyTicket } from '$lib/stores/ops/notify';

export interface IssuePanelContext {
	issueStore: IssueStore;
	getIssues: () => Issue[];
	setSelectedId: (id: string | null) => void;
}

/**
 * The detail panel: which issue is open, its comments and attachments, and its unsaved text.
 * Properties save as they change (saveFields); only long text is drafted (drafts) and saved
 * explicitly, so drafts are the one thing that can be lost — every exit path asks first.
 */
export function createIssuePanel(ctx: IssuePanelContext, notifyTicket: NotifyTicket) {
	let editingIssue = $state<Issue | null>(null);
	let drafts = $state<Drafts>({});
	let panelColumnIndex = $state<number | null>(null);
	let isCreating = $state(false);
	let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task', deps: [] as string[] });
	let comments = $state<Comment[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let attachments = $state<Attachment[]>([]);
	let loadingAttachments = $state(false);
	let issueClosedExternally = $state(false);

	// --- Panel operations ---

	function hasUnsavedCreate(): boolean {
		return isCreating && (createForm.title.trim() !== '' || createForm.description.trim() !== '');
	}

	/** True when it's fine to leave the current pane state: nothing unsaved, or the user agreed to drop it. */
	function confirmDiscard(): boolean {
		if (!hasUnsavedCreate() && !hasDirtyDrafts(drafts) && !newComment.trim()) return true;
		return confirm('You have unsaved changes. Discard them?');
	}

	function openEditPanel(issue: Issue, pushState = true) {
		// Re-opening the same issue (table paging, a second click) keeps its drafts.
		if (editingIssue?.id !== issue.id) {
			if (!confirmDiscard()) return;
			drafts = {};
			attachments = [];
			newComment = '';
			issueClosedExternally = false;
		}
		isCreating = false;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		const col = getIssueColumn(issue);
		const idx = columns.findIndex(c => c.key === col.key);
		panelColumnIndex = idx >= 0 ? idx : 0;
		ctx.setSelectedId(issue.id);
		comments = [];
		loadComments(issue.id);
		loadAttachments(issue.id);
		loadIssueDetail(issue.id);
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.set('issue', issue.id);
			svelteKitPushState(url, { issue: issue.id });
		}
	}

	function closePanel(pushState = true, force = false) {
		if (!force && !confirmDiscard()) return;
		editingIssue = null;
		drafts = {};
		panelColumnIndex = null;
		isCreating = false;
		issueClosedExternally = false;
		comments = [];
		attachments = [];
		newComment = '';
		if (browser && pushState) {
			const url = new URL(window.location.href);
			url.searchParams.delete('issue');
			svelteKitPushState(url, {});
		}
	}

	function openCreatePanel() {
		if (!isCreating) {
			if (!confirmDiscard()) return;
			editingIssue = null;
			drafts = {};
			isCreating = true;
			createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		}
		requestAnimationFrame(() => {
			const titleInput = document.getElementById('create-title') as HTMLInputElement;
			titleInput?.focus();
		});
	}

	function openIssueById(id: string, pushState = true) {
		const issue = ctx.getIssues().find(i => i.id === id);
		if (issue) {
			openEditPanel(issue, pushState);
			return;
		}
		// Issue not found in current project — clean up URL and notify user
		if (browser) {
			const url = new URL(window.location.href);
			if (url.searchParams.has('issue')) {
				url.searchParams.delete('issue');
				svelteKitPushState(url.pathname + url.search, {});
			}
			toastQueue.show({ type: 'warning', title: 'Issue not found', message: `Issue ${id} not found in this project`, duration: 4000 });
		}
	}

	function handlePopState(e: PopStateEvent) {
		const issueId = e.state?.issue || new URL(window.location.href).searchParams.get('issue');
		if (issueId) openIssueById(issueId, false);
		else closePanel(false);
	}

	// --- Saving the open issue ---

	/** Show a change on the open issue right away: its full read and its board card. */
	function patchOpenIssue(updates: Partial<Issue>) {
		if (!editingIssue) return;
		Object.assign(editingIssue, updates);
		ctx.issueStore.patchLocal(editingIssue.id, updates);
	}

	/** Write changed fields straight to the tracker (the pane has no global Save). */
	async function saveFields(updates: Partial<Issue>) {
		if (!editingIssue) return;
		Object.assign(editingIssue, updates);
		await ctx.issueStore.updateIssue(editingIssue.id, updates);
	}

	async function setLabels(next: string[]) {
		if (!editingIssue) return;
		await saveFields(labelUpdate(editingIssue.labels ?? [], next));
	}

	function startDraft(field: DraftField) {
		const base = editingIssue?.[field] ?? '';
		drafts[field] = { base, value: base };
	}

	function cancelDraft(field: DraftField) {
		delete drafts[field];
	}

	async function saveDraft(field: DraftField) {
		const draft = drafts[field];
		if (!draft) return;
		delete drafts[field];
		if (draft.value !== draft.base) await saveFields({ [field]: draft.value });
	}

	// --- Operational state (bd set-state) ---

	/** Set a `dimension:value` operational state on the open issue (immediate write + event bead). */
	async function setIssueState(dimension: string, value: string, reason?: string) {
		if (!editingIssue) return;
		const id = editingIssue.id;
		// Optimistic: replace any existing label for this dimension with the new value.
		const others = (editingIssue.labels || []).filter(l => !l.startsWith(`${dimension}:`));
		patchOpenIssue({ labels: [...others, `${dimension}:${value}`] });
		await setIssueStateApi(id, dimension, value, reason);
	}

	/** Promote the open wisp to a permanent bead (bd promote). */
	async function promoteWisp(reason?: string) {
		if (!editingIssue || !editingIssue.ephemeral) return;
		const id = editingIssue.id;
		patchOpenIssue({ ephemeral: false });
		await promoteWispApi(id, reason);
	}

	// --- Comments ---

	/**
	 * The list payload is slim (see db.ts) — these fields only exist on the full read.
	 * Fetch them when the panel opens and merge them in; nothing else is touched, so a
	 * field the user is already typing in can't be clobbered by a late response.
	 */
	async function loadIssueDetail(issueId: string) {
		const res = await fetch(appendProjectParam(`/api/issues?ids=${encodeURIComponent(issueId)}`));
		const payload = await res.json();
		const full = payload?.ok ? (payload.data?.issues?.[0] as Issue | undefined) : undefined;
		if (!full || !editingIssue || editingIssue.id !== issueId) return;
		const edited = Object.entries(editingIssue).filter(([, v]) => v !== undefined);
		editingIssue = { ...full, ...Object.fromEntries(edited) } as Issue;
	}

	async function loadComments(issueId: string) {
		loadingComments = true;
		const res = await fetch(appendProjectParam(`/api/issues/${issueId}/comments`));
		const payload = await res.json();
		if (editingIssue?.id !== issueId) return; // a later open won the race
		comments = payload?.ok ? (payload.data?.comments ?? []) : [];
		loadingComments = false;
	}

	async function addComment() {
		if (!editingIssue || !newComment.trim()) return;
		const commentText = newComment.trim();
		await fetch(appendProjectParam(`/api/issues/${editingIssue.id}/comments`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ text: commentText })
		});
		notifyTicket(
			editingIssue.id,
			`Comment: "${commentText.slice(0, 100)}${commentText.length > 100 ? '...' : ''}"`,
			'comment',
			{ ticketTitle: editingIssue.title, sender: 'user' }
		);
		newComment = '';
		await loadComments(editingIssue.id);
		fetchMutations();
	}

	// --- Attachments ---

	async function loadAttachments(issueId: string) {
		loadingAttachments = true;
		const loaded = await loadAttachmentsApi(issueId);
		if (editingIssue?.id !== issueId) return; // a later open won the race
		attachments = loaded;
		loadingAttachments = false;
	}

	async function handleUploadAttachment(file: File) {
		if (!editingIssue) return;
		// A refused upload (too large, bad name) is expected: tell the user, don't throw.
		const attachment = await uploadAttachmentApi(editingIssue.id, file).catch((e: unknown) => {
			if (!(e instanceof ApiClientError)) throw e;
			toastQueue.show({ type: 'error', title: 'Upload failed', message: e.message, duration: 6000 });
			return null;
		});
		if (attachment && editingIssue) {
			attachments = [...attachments, attachment];
			notifyTicket(editingIssue.id, `Attachment added: ${file.name}`, 'attachment', { ticketTitle: editingIssue.title, sender: 'user' });
		}
	}

	async function handleDeleteAttachment(filename: string) {
		if (!editingIssue) return;
		await deleteAttachmentApi(editingIssue.id, filename);
		attachments = attachments.filter(a => a.filename !== filename);
		notifyTicket(editingIssue.id, `Attachment removed: ${filename}`, 'attachment', { ticketTitle: editingIssue.title, sender: 'user' });
	}

	// --- Issue CRUD (delegating to issueStore) ---

	async function createIssue() {
		if (!createForm.title.trim()) return;
		const form = consumeCreateForm();
		await ctx.issueStore.createIssue(form);
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		await ctx.issueStore.updateIssue(id, updates);
	}

	async function deleteIssue(id: string) {
		const deleted = await ctx.issueStore.deleteIssue(id);
		if (deleted && editingIssue?.id === id) {
			editingIssue = null;
			drafts = {};
		}
	}

	/** Reset the panel after an agent took over the issue. */
	function releaseToAgent() {
		editingIssue = null;
		drafts = {};
		isCreating = false;
	}

	/** Take the pending create form and clear it — the caller owns the values from here. */
	function consumeCreateForm() {
		const form = { ...createForm, deps: [...createForm.deps] };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;
		return form;
	}

	return {
		get editingIssue() { return editingIssue; },
		set editingIssue(v: Issue | null) { editingIssue = v; },
		get drafts() { return drafts; },
		get panelColumnIndex() { return panelColumnIndex; },
		set panelColumnIndex(v: number | null) { panelColumnIndex = v; },
		get isCreating() { return isCreating; },
		set isCreating(v: boolean) { isCreating = v; },
		get createForm() { return createForm; },
		set createForm(v: typeof createForm) { createForm = v; },
		get comments() { return comments; },
		set comments(v: Comment[]) { comments = v; },
		get newComment() { return newComment; },
		set newComment(v: string) { newComment = v; },
		get loadingComments() { return loadingComments; },
		get attachments() { return attachments; },
		get loadingAttachments() { return loadingAttachments; },
		get issueClosedExternally() { return issueClosedExternally; },
		set issueClosedExternally(v: boolean) { issueClosedExternally = v; },
		get panelOpen() { return editingIssue !== null || isCreating; },
		openEditPanel,
		closePanel,
		openCreatePanel,
		confirmDiscard,
		openIssueById,
		handlePopState,
		patchOpenIssue,
		saveFields,
		setLabels,
		startDraft,
		cancelDraft,
		saveDraft,
		setIssueState,
		promoteWisp,
		loadComments,
		addComment,
		loadAttachments,
		handleUploadAttachment,
		handleDeleteAttachment,
		createIssue,
		updateIssue,
		deleteIssue,
		releaseToAgent,
		consumeCreateForm
	};
}

export type IssuePanel = ReturnType<typeof createIssuePanel>;
