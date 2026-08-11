import { browser } from '$app/environment';
import { pushState as svelteKitPushState } from '$app/navigation';
import { fetchMutations } from '$lib/mutationStore.svelte';
import { appendProjectParam } from '$lib/project';
import type { Issue, Comment, Attachment } from '$lib/types';
import { getIssueColumn, columns, getColumnMoveUpdates } from '$lib/utils';
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

/** The detail panel: which issue is open, its draft edits, comments and attachments. */
export function createIssuePanel(ctx: IssuePanelContext, notifyTicket: NotifyTicket) {
	let editingIssue = $state<Issue | null>(null);
	let originalLabels = $state<string[]>([]);
	let panelColumnIndex = $state<number | null>(null);
	let isCreating = $state(false);
	let createForm = $state({ title: '', description: '', priority: 2, issue_type: 'task', deps: [] as string[] });
	let comments = $state<Comment[]>([]);
	let newComment = $state('');
	let loadingComments = $state(false);
	let attachments = $state<Attachment[]>([]);
	let loadingAttachments = $state(false);
	let newLabelInput = $state('');
	let issueClosedExternally = $state(false);

	// --- Panel operations ---

	function hasUnsavedCreate(): boolean {
		return isCreating && (createForm.title.trim() !== '' || createForm.description.trim() !== '');
	}

	function openEditPanel(issue: Issue, pushState = true) {
		if (hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		isCreating = false;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		editingIssue = { ...issue, labels: issue.labels ? [...issue.labels] : [] };
		originalLabels = issue.labels ? [...issue.labels] : [];
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
		if (!force && hasUnsavedCreate()) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		editingIssue = null;
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
		editingIssue = null;
		isCreating = true;
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		requestAnimationFrame(() => {
			const titleInput = document.getElementById('create-title') as HTMLInputElement;
			titleInput?.focus();
		});
	}

	function setEditingColumn(columnKey: string) {
		if (!editingIssue) return;
		const updates = getColumnMoveUpdates(editingIssue, columnKey);
		if (updates.status) editingIssue.status = updates.status;
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

	// --- Labels ---

	function addLabelToEditing(label: string) {
		if (!editingIssue) return;
		const trimmed = label.trim().toLowerCase();
		if (!trimmed) return;
		const labels = editingIssue.labels || [];
		if (!labels.includes(trimmed)) {
			editingIssue.labels = [...labels, trimmed];
		}
		newLabelInput = '';
	}

	function removeLabelFromEditing(label: string) {
		if (!editingIssue) return;
		editingIssue.labels = (editingIssue.labels || []).filter(l => l !== label);
	}

	// --- Operational state (bd set-state) ---

	/** Set a `dimension:value` operational state on the open issue (immediate write + event bead). */
	async function setIssueState(dimension: string, value: string, reason?: string) {
		if (!editingIssue) return;
		const id = editingIssue.id;
		// Optimistic: replace any existing label for this dimension with the new value.
		const others = (editingIssue.labels || []).filter(l => !l.startsWith(`${dimension}:`));
		editingIssue.labels = [...others, `${dimension}:${value}`];
		await setIssueStateApi(id, dimension, value, reason);
	}

	/** Promote the open wisp to a permanent bead (bd promote). */
	async function promoteWisp(reason?: string) {
		if (!editingIssue || !editingIssue.ephemeral) return;
		const id = editingIssue.id;
		editingIssue.ephemeral = undefined; // optimistic
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
		attachments = await loadAttachmentsApi(issueId);
		loadingAttachments = false;
	}

	async function handleUploadAttachment(file: File) {
		if (!editingIssue) return;
		const attachment = await uploadAttachmentApi(editingIssue.id, file);
		if (attachment) {
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
		const form = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;
		await ctx.issueStore.createIssue(form);
	}

	async function updateIssue(id: string, updates: Partial<Issue>) {
		await ctx.issueStore.updateIssue(id, updates);
	}

	async function deleteIssue(id: string) {
		const deleted = await ctx.issueStore.deleteIssue(id);
		if (deleted && editingIssue?.id === id) editingIssue = null;
	}

	/** Reset the panel after an agent took over the issue. */
	function releaseToAgent() {
		editingIssue = null;
		isCreating = false;
	}

	/** Take the pending create form and clear it — the caller owns the values from here. */
	function consumeCreateForm() {
		const form = { title: createForm.title, description: createForm.description, priority: createForm.priority, issue_type: createForm.issue_type };
		createForm = { title: '', description: '', priority: 2, issue_type: 'task', deps: [] };
		isCreating = false;
		return form;
	}

	return {
		get editingIssue() { return editingIssue; },
		set editingIssue(v: Issue | null) { editingIssue = v; },
		get originalLabels() { return originalLabels; },
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
		get newLabelInput() { return newLabelInput; },
		set newLabelInput(v: string) { newLabelInput = v; },
		get issueClosedExternally() { return issueClosedExternally; },
		set issueClosedExternally(v: boolean) { issueClosedExternally = v; },
		get panelOpen() { return editingIssue !== null || isCreating; },
		openEditPanel,
		closePanel,
		openCreatePanel,
		hasUnsavedCreate,
		setEditingColumn,
		openIssueById,
		handlePopState,
		addLabelToEditing,
		removeLabelFromEditing,
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
