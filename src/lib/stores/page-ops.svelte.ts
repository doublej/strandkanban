import type { Issue } from '$lib/types';
import { copyState } from '$lib/stores/copy-state.svelte';
import type { IssueStore } from '$lib/stores/issue-store.svelte';
import type { Pane } from '$lib/wsStore.svelte';
import { getQueueItems } from '$lib/stores/queue.svelte';
import { createTicketNotifier } from '$lib/stores/ops/notify';
import { createIssuePanel } from '$lib/stores/ops/issue-panel.svelte';
import { createAgentOps } from '$lib/stores/ops/agent-ops.svelte';
import { createIssueLinks } from '$lib/stores/ops/issue-links.svelte';

export interface PageOpsContext {
	issueStore: IssueStore;
	getIssues: () => Issue[];
	getWsPanes: () => Map<string, Pane>;
	getCurrentProjectPath: () => string;
	getSelectedId: () => string | null;
	setSelectedId: (id: string | null) => void;
	getExpandedPanes: () => Set<string>;
	setExpandedPanes: (v: Set<string>) => void;
}

/** Facade over the three op groups — one `ops` object for the whole page. */
export function createPageOps(ctx: PageOpsContext) {
	const notifyTicket = createTicketNotifier(ctx.getCurrentProjectPath);
	const panel = createIssuePanel(ctx, notifyTicket);
	const agents = createAgentOps(ctx, panel);
	const links = createIssueLinks(ctx, panel, notifyTicket);

	return {
		// --- Detail panel ---
		get editingIssue() { return panel.editingIssue; },
		set editingIssue(v) { panel.editingIssue = v; },
		get drafts() { return panel.drafts; },
		get panelColumnIndex() { return panel.panelColumnIndex; },
		set panelColumnIndex(v) { panel.panelColumnIndex = v; },
		get isCreating() { return panel.isCreating; },
		set isCreating(v) { panel.isCreating = v; },
		get createForm() { return panel.createForm; },
		set createForm(v) { panel.createForm = v; },
		get comments() { return panel.comments; },
		set comments(v) { panel.comments = v; },
		get newComment() { return panel.newComment; },
		set newComment(v) { panel.newComment = v; },
		get loadingComments() { return panel.loadingComments; },
		get attachments() { return panel.attachments; },
		get loadingAttachments() { return panel.loadingAttachments; },
		get issueClosedExternally() { return panel.issueClosedExternally; },
		set issueClosedExternally(v) { panel.issueClosedExternally = v; },
		get panelOpen() { return panel.panelOpen; },
		get copiedId() { return copyState.copiedId; },
		openEditPanel: panel.openEditPanel,
		closePanel: panel.closePanel,
		openCreatePanel: panel.openCreatePanel,
		confirmDiscard: panel.confirmDiscard,
		openIssueById: panel.openIssueById,
		handlePopState: panel.handlePopState,
		saveFields: panel.saveFields,
		setLabels: panel.setLabels,
		startDraft: panel.startDraft,
		cancelDraft: panel.cancelDraft,
		saveDraft: panel.saveDraft,
		setIssueState: panel.setIssueState,
		promoteWisp: panel.promoteWisp,
		loadComments: panel.loadComments,
		addComment: panel.addComment,
		loadAttachments: panel.loadAttachments,
		handleUploadAttachment: panel.handleUploadAttachment,
		handleDeleteAttachment: panel.handleDeleteAttachment,
		createIssue: panel.createIssue,
		updateIssue: panel.updateIssue,
		deleteIssue: panel.deleteIssue,

		// --- Agent launch & queue ---
		get cwdConflict() { return agents.cwdConflict; },
		get agentQueue() { return getQueueItems(); },
		createIssueAndStartAgent: agents.createIssueAndStartAgent,
		startAgentForIssue: agents.startAgentForIssue,
		resolveConflict: agents.resolveConflict,
		dismissConflict: agents.dismissConflict,
		cancelQueueItem: agents.cancelQueueItem,
		reorderQueue: agents.reorderQueue,
		openAgentPane: agents.openAgentPane,
		openTicketFromPane: agents.openTicketFromPane,
		extractTicketIdFromName: agents.extractTicketIdFromName,
		formatTicketDelivery: agents.formatTicketDelivery,
		notifyTicket,

		// --- Context menu, rope drag, dependencies ---
		get ropeDrag() { return links.ropeDrag; },
		set ropeDrag(v) { links.ropeDrag = v; },
		get pendingDep() { return links.pendingDep; },
		set pendingDep(v) { links.pendingDep = v; },
		get contextMenu() { return links.contextMenu; },
		set contextMenu(v) { links.contextMenu = v; },
		get sortMenuOpen() { return links.sortMenuOpen; },
		set sortMenuOpen(v) { links.sortMenuOpen = v; },
		copyToClipboard: links.copyToClipboard,
		setIssuePriority: links.setIssuePriority,
		openContextMenu: links.openContextMenu,
		closeContextMenu: links.closeContextMenu,
		handleMouseMove: links.handleMouseMove,
		handleMouseUp: links.handleMouseUp,
		startRopeDrag: links.startRopeDrag,
		confirmDependency: links.confirmDependency,
		cancelDependency: links.cancelDependency,
		createDependency: links.createDependency,
		removeDependency: links.removeDependency,
		getIssueTitle: links.getIssueTitle
	};
}

export type PageOps = ReturnType<typeof createPageOps>;
