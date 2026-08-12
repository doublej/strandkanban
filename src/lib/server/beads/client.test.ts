import { expect, test } from 'bun:test';
import type { ExportIssue, Issue as SdkIssue } from 'beads-sdk';
import { beads, unwrapBdJson } from './client';
import { mapIssues } from './issue-view';

const rows: ExportIssue[] = [
	{
		id: 'bd-new',
		title: 'new',
		status: 'open',
		priority: 1,
		issue_type: 'task',
		created_at: '2026-01-02'
	},
	{
		id: 'bd-old',
		title: 'old',
		status: 'open',
		priority: 1,
		issue_type: 'task',
		created_at: '2026-01-01'
	}
];

const issue: SdkIssue = {
	id: 'bd-new',
	title: 'new',
	description: 'description',
	design: 'design',
	acceptance_criteria: 'acceptance',
	notes: 'notes',
	status: 'open',
	priority: 1,
	issue_type: 'task',
	created_at: '2026-01-02',
	labels: ['frontend'],
	dependencies: [{ id: 'bd-old', title: 'old', status: 'open', dependency_type: 'blocks' }],
	dependents: [],
	comments: [{ id: '1', author: 'jj', text: 'hello', created_at: '2026-01-02' }],
	attachments: [{ filename: 'a.txt', size: 1, mimetype: 'text/plain', created_at: '2026-01-02' }],
	metadata: { agent_model: 'opus', agent_effort: 'high' }
};

test('unwrapBdJson accepts enveloped and bare payloads', () => {
	expect(unwrapBdJson('{"schema_version":1,"data":{"id":"bd-1"}}')).toEqual({ id: 'bd-1' });
	expect(unwrapBdJson('{"id":"bd-1"}')).toEqual({ id: 'bd-1' });
});

test('mapIssues adds global sequence, counts, and agent metadata', () => {
	const [mapped] = mapIssues(rows, [issue], false);
	expect(mapped.seq).toBe(2);
	expect(mapped.dependency_count).toBe(1);
	expect(mapped.dependent_count).toBe(0);
	expect(mapped.agent_model).toBe('opus');
	expect(mapped.agent_effort).toBe('high');
	expect(mapped.attachments).toHaveLength(1);
});

test('mapIssues slim mode removes detail-only payloads', () => {
	const [mapped] = mapIssues(rows, [issue], true);
	expect(mapped).not.toHaveProperty('design');
	expect(mapped).not.toHaveProperty('acceptance_criteria');
	expect(mapped).not.toHaveProperty('notes');
	expect(mapped).not.toHaveProperty('comments');
	expect(mapped).not.toHaveProperty('attachments');
	expect(mapped.description).toBe('description');
});

test('beads() memoizes one client per cwd', () => {
	expect(beads('/tmp/project-a')).toBe(beads('/tmp/project-a'));
	expect(beads('/tmp/project-a')).not.toBe(beads('/tmp/project-b'));
});
