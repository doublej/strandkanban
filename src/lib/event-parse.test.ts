import { expect, test } from 'bun:test';
import { parseEvent, parseJournalRecord, type DbEvent, type JournalRecord } from './event-parse';

const row = (over: Partial<DbEvent>): DbEvent => ({
	id: 1,
	issue_id: 'bd-1',
	event_type: 'updated',
	actor: 'jj',
	old_value: null,
	new_value: null,
	comment: null,
	created_at: '2026-08-09 10:00:00',
	...over
});

test('an edit that leaves priority alone emits no priority row', () => {
	const out = parseEvent(row({
		old_value: JSON.stringify({ id: 'bd-1', title: 'a', priority: 0, notes: 'x' }),
		new_value: JSON.stringify({ notes: '' })
	}));
	expect(out.map((m) => m.field)).toEqual(['notes']);
});

test('a rename yields one title row', () => {
	const out = parseEvent(row({
		old_value: JSON.stringify({ id: 'bd-1', title: 'old', priority: 2 }),
		new_value: JSON.stringify({ title: 'new' })
	}));
	expect(out).toHaveLength(1);
	expect(out[0].mutationType).toBe('title');
	expect([out[0].previousValue, out[0].newValue]).toEqual(['old', 'new']);
});

test('status_changed yields the status transition', () => {
	const out = parseEvent(row({
		event_type: 'status_changed',
		old_value: JSON.stringify({ status: 'open' }),
		new_value: JSON.stringify({ assignee: 'x', status: 'in_progress' })
	}));
	expect(out).toHaveLength(1);
	expect([out[0].previousValue, out[0].newValue]).toEqual(['open', 'in_progress']);
});

const rec = (op: JournalRecord['op'], issue: Record<string, unknown> | null, extra: Partial<JournalRecord> = {}): JournalRecord => ({
	seq: 7, ts: '2026-09-27T16:25:30Z', op, issue_id: 'demo-1', issue, ...extra
});
const open = { id: 'demo-1', title: 'first', status: 'open', priority: 2, updated_at: 'a' };

test('update diffs against the previous state and skips side-effect fields', () => {
	const next = { ...open, status: 'in_progress', labels: ['x'], updated_at: 'b', started_at: 'b' };
	const entries = parseJournalRecord(rec('update', next), open);
	expect(entries.map((e) => [e.mutationType, e.previousValue, e.newValue])).toEqual([
		['status', 'open', 'in_progress'],
		['field', '—', '["x"]'],
	]);
});

test('update without a previous state yields nothing', () => {
	expect(parseJournalRecord(rec('update', open), undefined)).toEqual([]);
});

test('close, create, dep and reopen map onto the events-table vocabulary', () => {
	expect(parseJournalRecord(rec('create', open), undefined)[0].mutationType).toBe('created');
	expect(parseJournalRecord(rec('close', { ...open, status: 'closed' }), open)[0]).toMatchObject({ mutationType: 'closed', previousValue: 'open' });
	expect(parseJournalRecord(rec('dep_add', open, { dep: { kind: 'blocks', target: 'demo-2' } }), open)[0].newValue).toBe('+demo-2');
	expect(parseJournalRecord(rec('update', open), { ...open, status: 'closed' })[0]).toMatchObject({ mutationType: 'status', previousValue: 'closed', newValue: 'open' });
});
