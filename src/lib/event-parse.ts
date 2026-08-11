import type { MutationEntry, MutationType } from './types';

export interface DbEvent {
	id: number;
	issue_id: string;
	event_type: string;
	actor: string;
	old_value: string | null;
	new_value: string | null;
	comment: string | null;
	created_at: string;
}

const priorityLabels: Record<number, string> = {
	0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Backlog'
};

/** Parse an event's old/new value JSON. bd sometimes stores a plain (non-JSON) string
 *  such as a close reason, so this must tolerate parse failures instead of throwing. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeParseVal(raw: string | null): any {
	if (!raw) return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
}

/** Fields that change on every write and carry no activity signal. */
const IGNORED = new Set(['updated_at', 'id']);

const TYPE_FOR: Record<string, MutationType> = {
	status: 'status', priority: 'priority', assignee: 'assignee', title: 'title'
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function fmt(key: string, val: any): string {
	if (val === null || val === undefined || val === '') return '—';
	if (key === 'priority') return priorityLabels[val] ?? String(val);
	const s = typeof val === 'string' ? val : JSON.stringify(val);
	return s.length > 80 ? `${s.slice(0, 80)}…` : s;
}

/** One event can touch several fields, so this yields zero or more entries. */
export function parseEvent(ev: DbEvent): MutationEntry[] {
	const oldVal = safeParseVal(ev.old_value);
	const newVal = safeParseVal(ev.new_value);
	const title = newVal?.title || oldVal?.title || ev.issue_id;
	const ts = new Date(ev.created_at.replace(' ', 'T')).getTime();

	const base = {
		id: String(ev.id),
		timestamp: ts,
		ticketId: ev.issue_id,
		ticketTitle: title,
		actor: ev.actor || 'unknown'
	};

	switch (ev.event_type) {
		case 'created':
			return [{ ...base, mutationType: 'created', field: 'issue', previousValue: null, newValue: 'created' }];
		case 'closed':
			return [{ ...base, mutationType: 'closed', field: 'status', previousValue: oldVal?.status || 'open', newValue: 'closed' }];
		case 'reopened':
			return [{ ...base, mutationType: 'status', field: 'status', previousValue: 'closed', newValue: newVal?.status || 'open' }];
		case 'status_changed':
			return [{ ...base, mutationType: 'status', field: 'status', previousValue: oldVal?.status ?? null, newValue: newVal?.status ?? 'unknown' }];
		case 'dependency_added':
		case 'dependency_removed': {
			const depMatch = ev.comment?.match(/dependency:\s*(\S+)\s+blocks\s+(\S+)/i);
			if (!depMatch) return [];
			const action = ev.event_type === 'dependency_added' ? '+' : '-';
			return [{ ...base, mutationType: 'dependency', field: 'dependency', previousValue: null, newValue: `${action}${depMatch[2]}` }];
		}
		case 'label_added':
		case 'label_removed': {
			const labelMatch = ev.comment?.match(/label:\s*(.+)/i);
			if (!labelMatch) return [];
			const labelAction = ev.event_type === 'label_added' ? '+' : '-';
			return [{ ...base, mutationType: 'label', field: 'label', previousValue: null, newValue: `${labelAction}${labelMatch[1].trim()}` }];
		}
		case 'updated':
			// new_value holds only the changed fields; old_value is the full prior issue.
			return Object.keys(newVal ?? {})
				.filter((k) => !IGNORED.has(k) && oldVal?.[k] !== newVal[k])
				.map((k) => ({
					...base,
					id: `${ev.id}:${k}`,
					mutationType: TYPE_FOR[k] ?? 'field',
					field: k,
					previousValue: fmt(k, oldVal?.[k]),
					newValue: fmt(k, newVal[k])
				}));
		default:
			return [];
	}
}
