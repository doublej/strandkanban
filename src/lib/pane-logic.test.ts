import { describe, it, expect } from 'bun:test';
import type { Issue } from './types';
import { hasDirtyDrafts, mergeLiveIssue, labelUpdate, toDateInput, parseEstimate } from './pane-logic';

const issue = (over: Partial<Issue>): Issue => ({
	id: 'a-1', seq: 1, title: 't', description: '', status: 'open', priority: 2, issue_type: 'task', ...over
});

describe('hasDirtyDrafts', () => {
	it('is clean when nothing changed', () => {
		expect(hasDirtyDrafts({})).toBe(false);
		expect(hasDirtyDrafts({ design: { base: 'x', value: 'x' } })).toBe(false);
	});
	it('is dirty once any draft differs from its base', () => {
		expect(hasDirtyDrafts({ design: { base: 'x', value: 'x' }, notes: { base: '', value: 'n' } })).toBe(true);
	});
});

describe('mergeLiveIssue', () => {
	it('takes live list fields but keeps detail-only fields', () => {
		const detail = issue({ status: 'open', design: 'd', notes: 'n' });
		const merged = mergeLiveIssue(detail, [issue({ status: 'closed' })]);
		expect(merged.status).toBe('closed');
		expect(merged.design).toBe('d');
	});
	it('falls back to the detail copy when the issue left the list', () => {
		const detail = issue({ title: 'gone' });
		expect(mergeLiveIssue(detail, [])).toBe(detail);
	});
});

describe('labelUpdate', () => {
	it('diffs labels into add/remove', () => {
		expect(labelUpdate(['a', 'b'], ['b', 'c'])).toEqual({ labels: ['b', 'c'], addLabels: ['c'], removeLabels: ['a'] });
	});
});

describe('field parsing', () => {
	it('reads stored dates as the intended calendar day', () => {
		expect(toDateInput('2026-03-04T00:00:00Z')).toBe('2026-03-04');
		// bd 1.x writes local midnight; the local reading is the day the user picked.
		const localMidnight = new Date(2026, 9, 13).toISOString();
		expect(toDateInput(localMidnight)).toBe('2026-10-13');
		expect(toDateInput(undefined)).toBe('');
		expect(toDateInput('nope')).toBe('');
	});
	it('parses estimates: empty clears, clamps, rounds', () => {
		expect(parseEstimate('')).toBe(0);
		expect(parseEstimate('-5')).toBe(0);
		expect(parseEstimate('44.6')).toBe(45);
	});
});
