import { expect, test } from 'bun:test';
import { parseEvent, type DbEvent } from './event-parse';

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
