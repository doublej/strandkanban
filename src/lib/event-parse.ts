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
	0: 'Critical', 1: 'High', 2: 'Medium', 3: 'Low', 4: 'Someday'
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

/** One `bd events tail` line. `issue` is the full state after the change (null on delete). */
export interface JournalRecord {
	seq: number;
	ts: string;
	op: 'create' | 'update' | 'close' | 'delete' | 'dep_add' | 'dep_remove' | 'comment';
	issue_id: string;
	actor?: string;
	issue: Record<string, unknown> | null;
	dep?: { kind: string; target: string };
	comment?: { id: string; author: string; text: string };
}

/** Full-state fields that move as a side effect of another change. */
const JOURNAL_NOISE = new Set(['updated_at', 'started_at', 'closed_at', 'close_reason', 'is_blocked']);

/**
 * Map a journal record onto the events-table shape so parseEvent formats both feeds alike.
 * `prev` is the issue state from the previous record for the same id, if one was seen.
 */
export function parseJournalRecord(rec: JournalRecord, prev: Record<string, unknown> | undefined): MutationEntry[] {
	const ev = { id: rec.seq, issue_id: rec.issue_id, actor: rec.actor ?? '', created_at: rec.ts, comment: null };
	const title = (rec.issue?.title ?? prev?.title ?? rec.issue_id) as string;
	const base = { id: String(rec.seq), timestamp: Date.parse(rec.ts), ticketId: rec.issue_id, ticketTitle: title, actor: rec.actor || 'unknown' };
	const json = (v: unknown) => (v == null ? null : JSON.stringify(v));

	switch (rec.op) {
		case 'create':
			return parseEvent({ ...ev, event_type: 'created', old_value: null, new_value: json(rec.issue) });
		case 'close':
			return parseEvent({ ...ev, event_type: 'closed', old_value: json(prev), new_value: json(rec.issue) });
		case 'delete':
			return [{ ...base, mutationType: 'field', field: 'issue', previousValue: null, newValue: 'deleted' }];
		case 'comment':
			return [{ ...base, actor: rec.comment?.author || base.actor, mutationType: 'comment', field: 'comment', previousValue: null, newValue: rec.comment?.text ?? '' }];
		case 'dep_add':
		case 'dep_remove':
			return parseEvent({
				...ev,
				event_type: rec.op === 'dep_add' ? 'dependency_added' : 'dependency_removed',
				old_value: null,
				new_value: null,
				comment: `dependency: ${rec.issue_id} blocks ${rec.dep?.target ?? '?'}`
			});
		case 'update': {
			// No earlier state in view: there is nothing to diff against.
			if (!prev || !rec.issue) return [];
			const cur = rec.issue;
			const changed = [...new Set([...Object.keys(prev), ...Object.keys(cur)])]
				.filter((k) => !JOURNAL_NOISE.has(k) && json(prev[k]) !== json(cur[k]));
			if (changed.length === 0) return [];
			const reopened = prev.status === 'closed' && cur.status !== 'closed';
			return parseEvent({
				...ev,
				event_type: reopened ? 'reopened' : 'updated',
				old_value: json(prev),
				new_value: json(Object.fromEntries(changed.map((k) => [k, cur[k] ?? null])))
			});
		}
		default:
			return [];
	}
}
