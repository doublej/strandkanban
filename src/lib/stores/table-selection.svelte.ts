import type { Issue } from '$lib/types';
import { getPriorityConfig, copyToClipboard } from '$lib/utils';

export interface TableSelectionContext {
	getRows: () => Issue[];
	getSelectedIds: () => string[];
	onselectionchange: (ids: string[]) => void;
	onselect: (issue: Issue) => void;
	onbulkupdate: (ids: string[], updates: Partial<Issue>) => void;
	onbulkdelete: (ids: string[]) => void;
}

function formatFull(issue: Issue): string {
	const lines = [`${issue.id}  ${issue.title}`];
	const meta = [`status: ${issue.status}`, `priority: ${getPriorityConfig(issue.priority).label}`, `type: ${issue.issue_type}`];
	if (issue.assignee) meta.push(`assignee: ${issue.assignee}`);
	if (issue.labels?.length) meta.push(`labels: ${issue.labels.join(', ')}`);
	lines.push(meta.join('  |  '));
	if (issue.description?.trim()) lines.push('', issue.description.trim());
	return lines.join('\n');
}

/**
 * Table multi-select (shift-click range, ctrl/cmd-click toggle) and the bulk actions
 * on it. Selection is controlled by the parent so a sibling grid can share it.
 */
export function createTableSelection(ctx: TableSelectionContext) {
	let anchorId: string | null = null;
	let copiedKind = $state<'ids' | 'details' | null>(null);
	let copiedTimer: ReturnType<typeof setTimeout> | null = null;

	const selectedSet = $derived(new Set(ctx.getSelectedIds()));

	// Drop selections that scroll out of the current filtered/sorted view.
	$effect(() => {
		const present = new Set(ctx.getRows().map((i) => i.id));
		const ids = ctx.getSelectedIds();
		if (ids.some((id) => !present.has(id))) {
			ctx.onselectionchange(ids.filter((id) => present.has(id)));
		}
	});

	function onRowClick(e: MouseEvent, issue: Issue, index: number) {
		const rows = ctx.getRows();
		const selectedIds = ctx.getSelectedIds();
		if (e.shiftKey) {
			const anchorIdx = anchorId ? rows.findIndex((r) => r.id === anchorId) : -1;
			if (anchorIdx === -1) {
				ctx.onselectionchange([issue.id]);
				anchorId = issue.id;
			} else {
				const [lo, hi] = anchorIdx <= index ? [anchorIdx, index] : [index, anchorIdx];
				const next: string[] = [];
				for (let k = lo; k <= hi; k++) next.push(rows[k].id);
				ctx.onselectionchange(next);
			}
			return;
		}
		if (e.metaKey || e.ctrlKey) {
			const next = new Set(selectedIds);
			if (next.has(issue.id)) next.delete(issue.id);
			else next.add(issue.id);
			ctx.onselectionchange([...next]);
			anchorId = issue.id;
			return;
		}
		ctx.onselectionchange([]);
		anchorId = issue.id;
		ctx.onselect(issue);
	}

	function onRowKey(e: KeyboardEvent, issue: Issue) {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			// Opening one ticket exits multi-select (mirror onRowClick), otherwise the
			// selection grid would keep preempting the detail panel we just opened.
			ctx.onselectionchange([]);
			ctx.onselect(issue);
		}
	}

	function clearSelection() {
		ctx.onselectionchange([]);
		anchorId = null;
	}

	function applyBulkStatus(e: Event) {
		const el = e.currentTarget as HTMLSelectElement;
		if (el.value) ctx.onbulkupdate(ctx.getSelectedIds(), { status: el.value as Issue['status'] });
		el.value = '';
	}

	function applyBulkPriority(e: Event) {
		const el = e.currentTarget as HTMLSelectElement;
		if (el.value !== '') ctx.onbulkupdate(ctx.getSelectedIds(), { priority: Number(el.value) as Issue['priority'] });
		el.value = '';
	}

	function bulkDelete() {
		const selectedIds = ctx.getSelectedIds();
		if (selectedIds.length === 0) return;
		ctx.onbulkdelete(selectedIds);
		clearSelection();
	}

	// --- Copy selected rows (IDs, or full details) in visible order ---
	function selectedInOrder(): Issue[] {
		return ctx.getRows().filter((r) => selectedSet.has(r.id));
	}

	function flashCopied(kind: 'ids' | 'details') {
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedKind = kind;
		copiedTimer = setTimeout(() => (copiedKind = null), 1500);
	}

	async function copyIds() {
		const sel = selectedInOrder();
		if (sel.length === 0) return;
		await copyToClipboard(sel.map((i) => i.id).join('\n'));
		flashCopied('ids');
	}

	async function copyDetails() {
		const sel = selectedInOrder();
		if (sel.length === 0) return;
		await copyToClipboard(sel.map(formatFull).join('\n\n---\n\n'));
		flashCopied('details');
	}

	return {
		get selectedSet() { return selectedSet; },
		get copiedKind() { return copiedKind; },
		onRowClick,
		onRowKey,
		clearSelection,
		applyBulkStatus,
		applyBulkPriority,
		bulkDelete,
		copyIds,
		copyDetails
	};
}

export type TableSelection = ReturnType<typeof createTableSelection>;
