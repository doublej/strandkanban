import { expect, test } from 'bun:test';
import { beads, createArgs, isFresh, parseExport, unwrapBdJson, updateArgs } from './client';

test('createArgs passes values as separate argv entries, never quoted', () => {
	expect(createArgs("it's a $(rm -rf /) title", { priority: 1, deps: ['a', 'b'], estimate: 4.6 })).toEqual([
		'create',
		"it's a $(rm -rf /) title",
		'--json',
		'--priority',
		'1',
		'--deps',
		'a,b',
		'--estimate',
		'5'
	]);
});

test('createArgs omits absent options', () => {
	expect(createArgs('bare')).toEqual(['create', 'bare', '--json']);
});

test('updateArgs collapses labels and metadata into one invocation', () => {
	expect(
		updateArgs('bd-1', {
			status: 'closed',
			addLabels: ['x', 'y'],
			removeLabels: ['z'],
			setMetadata: { agent_model: 'opus' },
			unsetMetadata: ['agent_effort']
		})
	).toEqual([
		'update',
		'bd-1',
		'--status',
		'closed',
		'--remove-label',
		'z',
		'--add-label',
		'x',
		'--add-label',
		'y',
		'--set-metadata',
		'agent_model=opus',
		'--unset-metadata',
		'agent_effort'
	]);
});

test('updateArgs returns null when there is nothing to change', () => {
	expect(updateArgs('bd-1', {})).toBeNull();
	expect(updateArgs('bd-1', { addLabels: [], removeLabels: [] })).toBeNull();
});

test('updateArgs keeps falsy-but-set values', () => {
	expect(updateArgs('bd-1', { priority: 0, description: '', ephemeral: false })).toEqual([
		'update',
		'bd-1',
		'--description',
		'',
		'--priority',
		'0',
		'--persistent'
	]);
});

test('unwrapBdJson unwraps the 1.0 envelope and passes plain payloads through', () => {
	expect(unwrapBdJson('{"schema_version":1,"data":{"id":"bd-1"}}')).toEqual({ id: 'bd-1' });
	expect(unwrapBdJson('{"id":"bd-1"}')).toEqual({ id: 'bd-1' });
	expect(unwrapBdJson('[{"id":"bd-1"}]')).toEqual([{ id: 'bd-1' }]);
});

test('parseExport skips banners, blanks and memory beads', () => {
	const rows = parseExport(
		[
			'auto-importing issues.jsonl',
			'',
			'{"_type":"memory","id":"m-1","title":"note"}',
			'not json',
			'{"id":"bd-1","title":"real","status":"open","priority":1,"issue_type":"task","created_at":"2026-01-01"}'
		].join('\n')
	);
	expect(rows.map((r) => r.id)).toEqual(['bd-1']);
});

test('isFresh requires matching generation, mtime and an unexpired entry', () => {
	const entry = { gen: 3, mtimeMs: 100, at: 1_000, rows: [] };
	expect(isFresh(entry, 3, 100, 1_000)).toBe(true);
	expect(isFresh(entry, 4, 100, 1_000)).toBe(false); // a write landed
	expect(isFresh(entry, 3, 101, 1_000)).toBe(false); // JSONL changed underneath
	expect(isFresh(entry, 3, 100, 40_000)).toBe(false); // older than the TTL
});

test('beads() memoizes one client per cwd', () => {
	expect(beads('/tmp/project-a')).toBe(beads('/tmp/project-a'));
	expect(beads('/tmp/project-a')).not.toBe(beads('/tmp/project-b'));
});
