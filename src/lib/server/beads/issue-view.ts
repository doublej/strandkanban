import type { ExportIssue, Issue as SdkIssue } from 'beads-sdk';
import type { AgentEffort, AgentModel, Issue } from '$lib/types';

function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function sequenceById(rows: ExportIssue[]): Map<string, number> {
	const active = rows.filter((row) => row.status !== 'tombstone');
	const sorted = [...active].sort((a, b) => compare(a.created_at, b.created_at) || compare(a.id, b.id));
	return new Map(sorted.map((row, index) => [row.id, index + 1]));
}

function agentModel(metadata: Record<string, unknown>): AgentModel | undefined {
	return metadata.agent_model as AgentModel | undefined;
}

function agentEffort(metadata: Record<string, unknown>): AgentEffort | undefined {
	return metadata.agent_effort as AgentEffort | undefined;
}

function issueCounts(issue: SdkIssue) {
	return {
		dependency_count: issue.dependencies.length,
		dependent_count: issue.dependents.length
	};
}

function fullIssue(issue: SdkIssue, seq: number): Issue {
	const { metadata, ...fields } = issue;
	return {
		...fields,
		seq,
		...issueCounts(issue),
		agent_model: agentModel(metadata),
		agent_effort: agentEffort(metadata)
	};
}

function slimIssue(issue: SdkIssue, seq: number): Issue {
	const {
		metadata: _metadata,
		design: _design,
		acceptance_criteria: _acceptance,
		notes: _notes,
		external_ref: _externalRef,
		spec_id: _specId,
		agent_state: _agentState,
		attachments: _attachments,
		comments: _comments,
		...fields
	} = issue;
	return { ...fields, seq, ...issueCounts(issue) };
}

export function mapIssues(rows: ExportIssue[], issues: SdkIssue[], slim: boolean): Issue[] {
	const sequences = sequenceById(rows);
	return issues.map((issue) => {
		const seq = sequences.get(issue.id) ?? 0;
		return slim ? slimIssue(issue, seq) : fullIssue(issue, seq);
	});
}
