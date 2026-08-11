import type { Issue, TableColumnKey } from '$lib/types';

export type EditableColumn = 'title' | 'status' | 'priority' | 'type' | 'assignee';

const EDITABLE_COLUMNS: Set<TableColumnKey> = new Set(['title', 'status', 'priority', 'type', 'assignee']);
export const TYPE_OPTS = ['task', 'bug', 'feature', 'epic', 'chore'];

export interface TableEditContext {
	getIssues: () => Issue[];
	onupdate: (id: string, updates: Partial<Issue>) => void;
}

/** Double-click-to-edit for the table's editable cells. One cell at a time. */
export function createTableEdit(ctx: TableEditContext) {
	let cell = $state<{ issueId: string; column: EditableColumn } | null>(null);
	let value = $state<string>('');

	function isEditable(column: TableColumnKey): boolean {
		return EDITABLE_COLUMNS.has(column);
	}

	function isEditing(issueId: string, column: TableColumnKey): boolean {
		return cell?.issueId === issueId && cell?.column === column;
	}

	function startEdit(issue: Issue, column: EditableColumn) {
		// Get current value based on column
		let current: string;
		switch (column) {
			case 'title':
				current = issue.title;
				break;
			case 'status':
				current = issue.status;
				break;
			case 'priority':
				current = String(issue.priority);
				break;
			case 'type':
				current = issue.issue_type;
				break;
			case 'assignee':
				current = issue.assignee ?? '';
				break;
		}
		cell = { issueId: issue.id, column };
		value = current;
	}

	function cancelEdit() {
		cell = null;
		value = '';
	}

	function commitEdit() {
		if (!cell) return;
		const issue = ctx.getIssues().find((i) => i.id === cell!.issueId);
		if (!issue) {
			cancelEdit();
			return;
		}

		let updates: Partial<Issue> = {};

		switch (cell.column) {
			case 'title':
				if (value.trim() && value !== issue.title) {
					updates.title = value.trim();
				}
				break;
			case 'status':
				if (value !== issue.status) {
					updates.status = value as Issue['status'];
				}
				break;
			case 'priority':
				const newPriority = Number(value) as Issue['priority'];
				if (newPriority !== issue.priority) {
					updates.priority = newPriority;
				}
				break;
			case 'type':
				if (value !== issue.issue_type) {
					updates.issue_type = value;
				}
				break;
			case 'assignee':
				const newAssignee = value.trim() || undefined;
				if (newAssignee !== issue.assignee) {
					updates.assignee = newAssignee;
				}
				break;
		}

		if (Object.keys(updates).length > 0) {
			ctx.onupdate(cell.issueId, updates);
		}

		cancelEdit();
	}

	function onCellDblClick(e: MouseEvent, issue: Issue, column: TableColumnKey) {
		if (!isEditable(column)) return;
		e.stopPropagation();
		startEdit(issue, column as EditableColumn);
	}

	function onEditKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			cancelEdit();
		} else if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			e.stopPropagation();
			commitEdit();
		}
	}

	function onEditBlur() {
		// Small delay to allow click on dropdown options to register
		setTimeout(() => {
			if (cell) commitEdit();
		}, 150);
	}

	return {
		get value() { return value; },
		set value(v: string) { value = v; },
		isEditable,
		isEditing,
		onCellDblClick,
		onEditKeydown,
		onEditBlur
	};
}

export type TableEdit = ReturnType<typeof createTableEdit>;
