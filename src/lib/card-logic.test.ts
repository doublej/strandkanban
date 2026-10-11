import { describe, it, expect } from 'bun:test';
import type { Issue, Dependency } from './types';
import { depRef, relationSummary, cardLabels, wrappedCount } from './card-logic';

const seqs = new Map([['proj-a1', 12], ['proj-b2', 14]]);
const dep = (id: string, over: Partial<Dependency> = {}): Dependency => ({ id, title: `t ${id}`, status: 'open', dependency_type: 'blocks', ...over });
const issue = (over: Partial<Issue>): Issue => ({
	id: 'proj-z9', seq: 1, title: 't', description: '', status: 'open', priority: 2, issue_type: 'task', ...over
});

describe('depRef', () => {
	it('uses #seq for issues on the board', () => expect(depRef('proj-a1', seqs)).toBe('#12'));
	it('drops the external: scheme', () => expect(depRef('external:sunshine:nvenc-api', seqs)).toBe('sunshine:nvenc-api'));
	it('shortens unknown ids to their hash, keeping child suffixes', () => {
		expect(depRef('pcvr-quest-streamer-38mc.1', seqs)).toBe('38mc.1');
		expect(depRef('plain', seqs)).toBe('plain');
	});
});

describe('relationSummary', () => {
	it('names a single open blocker', () => {
		const r = relationSummary(issue({ dependencies: [dep('proj-a1'), dep('proj-b2', { status: 'closed' })] }), seqs);
		expect(r).toMatchObject({ text: 'Blocked by #12', tone: 'danger' });
		expect(r?.title).toBe('Blocked by:\n#12 t proj-a1');
	});
	it('counts several blockers and ignores non-blocking links', () => {
		const deps = [dep('proj-a1'), dep('proj-b2'), dep('x-c3', { dependency_type: 'related' })];
		expect(relationSummary(issue({ dependencies: deps }), seqs)?.text).toBe('Blocked by 2');
	});
	it('falls back to what it blocks, then to its parent', () => {
		expect(relationSummary(issue({ dependents: [dep('proj-a1'), dep('proj-b2')] }), seqs)).toMatchObject({ text: 'Blocks 2', tone: 'muted' });
		expect(relationSummary(issue({ dependencies: [dep('proj-a1', { dependency_type: 'parent-child' })] }), seqs)?.text).toBe('Child of #12');
	});
	it('is null without relevant links', () => {
		expect(relationSummary(issue({}), seqs)).toBeNull();
		expect(relationSummary(issue({ dependencies: [dep('proj-a1', { status: 'closed' })] }), seqs)).toBeNull();
	});
});

describe('cardLabels', () => {
	it('splits key:value states and puts them first', () => {
		expect(cardLabels(['perf', 'agent:local', 'wifi', 'effort:high'])).toEqual([
			{ key: 'agent', text: 'local' }, { key: 'effort', text: 'high' }, { text: 'perf' }, { text: 'wifi' }
		]);
	});
});

describe('wrappedCount', () => {
	it('counts items below the first line', () => {
		expect(wrappedCount([0, 0, 0])).toBe(0);
		expect(wrappedCount([4, 4, 22, 22])).toBe(2);
		expect(wrappedCount([])).toBe(0);
	});
});
