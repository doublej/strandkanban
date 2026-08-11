import type { Issue } from '$lib/types';
import { loadComments as loadCommentsApi, loadAttachmentsApi } from '$lib/api';
import { formatTicketDelivery as formatTicketDeliveryFn } from '$lib/agent/ticket-delivery';
import type { TicketDeliveryData } from '$lib/agent/ticket-delivery';
import { toastQueue } from '$lib/notifications/toast-queue.svelte';
import { settings } from '$lib/stores/settings.svelte';
import type { IssueStore } from '$lib/stores/issue-store.svelte';
import { addPane, getRunningSessionsForCwd, startSession, type Pane } from '$lib/wsStore.svelte';
import { updateSession, addSystemMessage, setSessionError, getSessions, setSessions } from '$lib/stores/agent-sessions.svelte';
import { createWorktreeApi } from '$lib/stores/worktree-api';
import {
	enqueueTicket as serverEnqueueTicket,
	cancelQueueItem as serverCancelQueueItem,
	reorderQueue as serverReorderQueue,
} from '$lib/stores/queue.svelte';
import type { IssuePanel } from '$lib/stores/ops/issue-panel.svelte';

export interface AgentOpsContext {
	issueStore: IssueStore;
	getIssues: () => Issue[];
	getWsPanes: () => Map<string, Pane>;
	getCurrentProjectPath: () => string;
	getExpandedPanes: () => Set<string>;
	setExpandedPanes: (v: Set<string>) => void;
}

/** Launching agents on tickets: cwd conflicts, worktrees, and the start queue. */
export function createAgentOps(ctx: AgentOpsContext, panel: IssuePanel) {
	let cwdConflict = $state<{
		ticketId: string;
		agentName: string;
		conflicts: string[];
		cwd: string;
		issue: Issue;
		briefing: string;
	} | null>(null);

	function getEffectiveModel(issue: Issue): string | undefined {
		return issue.agent_model || settings.agentModel || undefined;
	}

	function formatTicketDelivery(agentName: string, data: TicketDeliveryData): string {
		return formatTicketDeliveryFn(agentName, data, settings.agentTicketDelivery);
	}

	function expandPane(agentName: string) {
		const expanded = ctx.getExpandedPanes();
		expanded.add(agentName);
		ctx.setExpandedPanes(new Set(expanded));
	}

	function getWorktreeRelPath(fullPath: string): string {
		return fullPath.split('/').slice(-2).join('/');
	}

	function createPlaceholderSession(agentName: string, cwd: string, ticketId: string) {
		const sessions = getSessions();
		sessions.set(agentName, {
			id: crypto.randomUUID(),
			name: agentName,
			cwd,
			streaming: false,
			messages: [],
			currentDelta: '',
			pane_type: 'agent',
			ticketId
		});
		setSessions(new Map(sessions));
	}

	function enqueueAgentStart(entry: { ticketId: string; agentName: string; cwd: string; issueSnapshot: Issue; useWorktree: boolean }) {
		serverEnqueueTicket({
			ticketId: entry.ticketId,
			agentName: entry.agentName,
			cwd: entry.cwd,
			title: entry.issueSnapshot.title,
			description: entry.issueSnapshot.description || '',
			priority: entry.issueSnapshot.priority ?? 2,
			issueType: entry.issueSnapshot.issue_type || 'task',
			useWorktree: entry.useWorktree,
			enqueuedAt: new Date().toISOString(),
		});
		toastQueue.show({
			type: 'info',
			title: 'Agent queued',
			message: `${entry.ticketId} will start when active agents finish.`,
			duration: 4000
		});
	}

	function cancelQueueItem(ticketId: string) {
		serverCancelQueueItem(ticketId);
		toastQueue.show({
			type: 'info',
			title: 'Agent cancelled',
			message: `${ticketId} removed from queue.`,
			duration: 3000
		});
	}

	function reorderQueue(fromIndex: number, toIndex: number) {
		if (fromIndex === toIndex) return;
		serverReorderQueue(fromIndex, toIndex);
	}

	function launchOrConflict(ticketId: string, agentName: string, cwd: string, issue: Issue, briefing: string): boolean {
		const conflicts = getRunningSessionsForCwd(cwd);
		if (conflicts.length > 0) {
			cwdConflict = { ticketId, agentName, conflicts, cwd, issue, briefing };
			const strategy = settings.conflictStrategy;
			if (strategy !== 'ask') {
				setTimeout(() => resolveConflict(strategy), 50);
			}
			return false;
		}
		addPane(agentName, cwd, briefing, settings.combinedSystemPrompt, undefined, ticketId, getEffectiveModel(issue));
		expandPane(agentName);
		return true;
	}

	async function startAgentForIssue(issue: Issue) {
		const agentName = `${issue.id}-agent`;
		const cwd = ctx.getCurrentProjectPath();
		const [issueComments, issueAttachments] = await Promise.all([
			loadCommentsApi(issue.id),
			loadAttachmentsApi(issue.id)
		]);
		const briefing = formatTicketDelivery(agentName, { issue, comments: issueComments, attachments: issueAttachments });

		if (launchOrConflict(issue.id, agentName, cwd, issue, briefing)) {
			panel.releaseToAgent();
		}
	}

	async function createIssueAndStartAgent() {
		if (!panel.createForm.title.trim()) return;
		const savedForm = panel.consumeCreateForm();

		const newId = await ctx.issueStore.createIssue(savedForm);
		if (newId) {
			const agentName = `${newId}-agent`;
			const cwd = ctx.getCurrentProjectPath();
			// Estimate seq as max + 1 (will be corrected by SSE)
			const maxSeq = ctx.getIssues().reduce((max, i) => Math.max(max, i.seq ?? 0), 0);
			const newIssue: Issue = {
				id: newId,
				seq: maxSeq + 1,
				title: savedForm.title,
				description: savedForm.description || '',
				status: 'open',
				priority: (savedForm.priority || 2) as Issue["priority"],
				issue_type: savedForm.issue_type || 'task'
			};
			const briefing = formatTicketDelivery(agentName, { issue: newIssue });
			launchOrConflict(newId, agentName, cwd, newIssue, briefing);
		}
	}

	async function resolveConflict(action: 'worktree' | 'queue' | 'same') {
		if (!cwdConflict) return;
		const { agentName, cwd, issue, briefing, ticketId } = cwdConflict;
		cwdConflict = null;

		if (action === 'queue') {
			enqueueAgentStart({
				ticketId,
				agentName,
				cwd,
				issueSnapshot: issue,
				useWorktree: false
			});
			panel.releaseToAgent();
			return;
		}

		// STEP 1: Create empty pane IMMEDIATELY (show UI without starting agent)
		createPlaceholderSession(agentName, cwd, ticketId);
		expandPane(agentName);

		let effectiveCwd = cwd;

		try {
			if (action === 'worktree') {
				addSystemMessage(agentName, 'Creating isolated worktree...', 'worktree_progress');
				effectiveCwd = await createWorktreeApi(cwd, ticketId);
				addSystemMessage(agentName, `Worktree created at .git/${getWorktreeRelPath(effectiveCwd)}`, 'worktree_progress');
			}

			addSystemMessage(agentName, 'Initializing agent...', 'worktree_progress');
			updateSession(agentName, { cwd: effectiveCwd });

			setTimeout(() => {
				startSession(agentName, effectiveCwd, briefing, settings.combinedSystemPrompt, undefined, ticketId, getEffectiveModel(issue));
				if (action === 'worktree') updateSession(agentName, { worktreePath: effectiveCwd });
			}, 100);

		} catch (err: any) {
			setSessionError(agentName, err.message || 'Unknown error during startup');
			console.error(`[agent:${agentName}] startup error:`, err);
		}

		panel.releaseToAgent();
	}

	function dismissConflict() {
		cwdConflict = null;
	}

	function openAgentPane(paneName: string) {
		if (ctx.getWsPanes().has(paneName)) {
			expandPane(paneName);
		}
	}

	function openTicketFromPane(ticketId: string) {
		const issue = ctx.getIssues().find(i => i.id === ticketId);
		if (issue) {
			panel.editingIssue = issue;
			panel.isCreating = false;
		}
	}

	function extractTicketIdFromName(name: string): string | undefined {
		if (name.endsWith('-agent')) return name.slice(0, -6);
		return undefined;
	}

	return {
		get cwdConflict() { return cwdConflict; },
		formatTicketDelivery,
		cancelQueueItem,
		reorderQueue,
		startAgentForIssue,
		createIssueAndStartAgent,
		resolveConflict,
		dismissConflict,
		openAgentPane,
		openTicketFromPane,
		extractTicketIdFromName
	};
}

export type AgentOps = ReturnType<typeof createAgentOps>;
