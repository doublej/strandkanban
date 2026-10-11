import { appendProjectParam } from '$lib/project';
import type { Issue } from '$lib/types';
import { copyState } from '$lib/stores/copy-state.svelte';
import type { IssuePanel } from '$lib/stores/ops/issue-panel.svelte';
import type { NotifyTicket } from '$lib/stores/ops/notify';

export interface IssueLinksContext {
	getIssues: () => Issue[];
}

/** Context menu, rope-drag dependency drawing, and the dependency writes behind it. */
export function createIssueLinks(ctx: IssueLinksContext, panel: IssuePanel, notifyTicket: NotifyTicket) {
	let ropeDrag = $state<{ fromId: string; startX: number; startY: number; currentX: number; currentY: number; targetId: string | null } | null>(null);
	let pendingDep = $state<{ fromId: string; toId: string } | null>(null);
	let contextMenu = $state<{ x: number; y: number; issue: Issue } | null>(null);
	let sortMenuOpen = $state<string | null>(null);

	function getIssueTitle(id: string): string {
		return ctx.getIssues().find(i => i.id === id)?.title ?? id;
	}

	// --- Context menu & priority ---

	function openContextMenu(e: MouseEvent, issue: Issue) {
		e.preventDefault();
		e.stopPropagation();
		contextMenu = { x: e.clientX, y: e.clientY, issue };
	}

	function closeContextMenu() {
		contextMenu = null;
		sortMenuOpen = null;
	}

	async function setIssuePriority(id: string, priority: Issue["priority"]) {
		await panel.updateIssue(id, { priority });
		closeContextMenu();
	}

	// --- Clipboard ---

	async function copyToClipboard(text: string, id?: string) {
		await navigator.clipboard.writeText(text);
		copyState.set(id ?? text);
	}

	// --- Rope drag (dependency drawing) ---

	function handleMouseMove(e: MouseEvent) {
		if (ropeDrag) {
			ropeDrag = { ...ropeDrag, currentX: e.clientX, currentY: e.clientY };
			const elements = document.elementsFromPoint(e.clientX, e.clientY);
			const card = elements.find(el => el.classList.contains('card')) as HTMLElement | null;
			const targetId = card?.dataset.cardId ?? null;
			if (targetId && targetId !== ropeDrag.fromId) {
				ropeDrag = { ...ropeDrag, targetId };
			} else {
				ropeDrag = { ...ropeDrag, targetId: null };
			}
		}
	}

	function handleMouseUp() {
		if (ropeDrag && ropeDrag.targetId) {
			pendingDep = { fromId: ropeDrag.fromId, toId: ropeDrag.targetId };
		}
		ropeDrag = null;
	}

	function startRopeDrag(e: MouseEvent, issueId: string) {
		e.preventDefault();
		e.stopPropagation();
		ropeDrag = {
			fromId: issueId,
			startX: e.clientX,
			startY: e.clientY,
			currentX: e.clientX,
			currentY: e.clientY,
			targetId: null
		};
		closeContextMenu();
	}

	// --- Dependencies ---

	async function confirmDependency(depType: string) {
		if (!pendingDep) return;
		const { fromId, toId } = pendingDep;
		const { createDependencyApi } = await import('$lib/api');
		await createDependencyApi(fromId, toId, depType);
		notifyTicket(fromId, `Dependency added: ${depType} → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} ${depType} this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	function cancelDependency() {
		pendingDep = null;
	}

	async function createDependency(fromId: string, toId: string) {
		const res = await fetch(appendProjectParam(`/api/issues/${fromId}/deps`), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: toId, dep_type: 'blocks' })
		});
		const payload = await res.json();
		if (!res.ok || !payload?.ok) {
			console.error('Failed to create dependency:', payload?.error?.message);
			return;
		}
		notifyTicket(fromId, `Dependency added: blocks → ${toId}`, 'dependency', { ticketTitle: getIssueTitle(fromId), sender: 'user' });
		notifyTicket(toId, `Dependency added: ${fromId} blocks this`, 'dependency', { ticketTitle: getIssueTitle(toId), sender: 'user' });
		closeContextMenu();
	}

	async function removeDependency(issueId: string, dependsOnId: string) {
		const res = await fetch(appendProjectParam(`/api/issues/${issueId}/deps`), {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ depends_on: dependsOnId })
		});
		const payload = await res.json();
		if (!res.ok || !payload?.ok) {
			console.error('Failed to remove dependency:', payload?.error?.message);
			return;
		}
		const editing = panel.editingIssue;
		if (editing?.id === issueId) {
			panel.patchOpenIssue({ dependencies: (editing.dependencies ?? []).filter(d => d.id !== dependsOnId) });
		} else if (editing?.id === dependsOnId) {
			panel.patchOpenIssue({ dependents: (editing.dependents ?? []).filter(d => d.id !== issueId) });
		}
		notifyTicket(issueId, `Dependency removed: → ${dependsOnId}`, 'dependency', { ticketTitle: getIssueTitle(issueId), sender: 'user' });
		notifyTicket(dependsOnId, `Dependency removed: ${issueId} no longer blocks`, 'dependency', { ticketTitle: getIssueTitle(dependsOnId), sender: 'user' });
	}

	return {
		get ropeDrag() { return ropeDrag; },
		set ropeDrag(v: typeof ropeDrag) { ropeDrag = v; },
		get pendingDep() { return pendingDep; },
		set pendingDep(v: typeof pendingDep) { pendingDep = v; },
		get contextMenu() { return contextMenu; },
		set contextMenu(v: typeof contextMenu) { contextMenu = v; },
		get sortMenuOpen() { return sortMenuOpen; },
		set sortMenuOpen(v: string | null) { sortMenuOpen = v; },
		getIssueTitle,
		openContextMenu,
		closeContextMenu,
		setIssuePriority,
		copyToClipboard,
		handleMouseMove,
		handleMouseUp,
		startRopeDrag,
		confirmDependency,
		cancelDependency,
		createDependency,
		removeDependency
	};
}

export type IssueLinks = ReturnType<typeof createIssueLinks>;
