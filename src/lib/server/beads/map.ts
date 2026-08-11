/**
 * Pure mapping from bd's export (JSONL) shape onto the app's `Issue` shape.
 * No I/O — moved out of the old `$lib/db` so the beads client can stay transport-only.
 */
import type { Issue, Attachment, AgentModel, AgentEffort } from '../../types';

/** Scalar issue fields shared by the `bd sql` and `bd export` (ExportIssue) shapes. */
export interface IssueScalarFields {
	estimated_minutes?: number | null;
	external_ref?: string | null;
	spec_id?: string | null;
	ephemeral?: number | boolean | null;
	wisp_type?: string | null;
	pinned?: number | boolean | null;
	due_at?: string | null;
	defer_until?: string | null;
	started_at?: string | null;
	agent_state?: string | null;
	close_reason?: string | null;
}

/** Map shared bd-1.0 issue columns onto the Issue shape. */
function mapIssueFields(row: IssueScalarFields) {
	return {
		estimated_minutes: row.estimated_minutes ?? undefined,
		external_ref: row.external_ref || undefined,
		spec_id: row.spec_id || undefined,
		ephemeral: row.ephemeral ? true : undefined,
		wisp_type: row.wisp_type || undefined,
		pinned: row.pinned ? true : undefined,
		due_at: row.due_at || undefined,
		defer_until: row.defer_until || undefined,
		started_at: row.started_at || undefined,
		agent_state: row.agent_state || undefined,
		close_reason: row.close_reason || undefined,
	};
}

interface IssueMetadata {
	agent_model?: AgentModel;
	agent_effort?: AgentEffort;
}

function parseMetadata(raw: string | object | null | undefined): IssueMetadata {
	if (!raw) return {};
	if (typeof raw === 'object') return raw as IssueMetadata;
	try {
		return JSON.parse(raw) as IssueMetadata;
	} catch {
		return {};
	}
}

export interface ExportDep {
	issue_id: string;
	depends_on_id: string;
	type: string;
}

export interface ExportComment {
	id: string;
	author: string;
	text: string;
	created_at: string;
}

/** One issue line from `bd export` (JSONL). bd omits empty/null fields, so most are optional. */
export interface ExportIssue extends IssueScalarFields {
	_type?: string;
	id: string;
	title: string;
	description?: string;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	status: string;
	priority: number;
	issue_type: string;
	assignee?: string;
	created_at: string;
	updated_at?: string;
	closed_at?: string;
	metadata?: string | object;
	labels?: string[];
	dependencies?: ExportDep[];
	comments?: ExportComment[];
}

export interface DepView {
	id: string;
	title: string;
	status: string;
	dependency_type: string;
}

/** Lexical string compare (ISO-8601 timestamps sort chronologically this way). */
export function cmp(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

export function mapExportIssue(
	r: ExportIssue,
	seqMap: Map<string, number>,
	depsMap: Map<string, DepView[]>,
	dependentsMap: Map<string, DepView[]>,
	attachmentsMap: Map<string, Attachment[]>,
	slim = false
): Issue {
	const meta = parseMetadata(r.metadata);
	const dependencies = depsMap.get(r.id) ?? [];
	const dependents = dependentsMap.get(r.id) ?? [];
	if (slim) {
		// Detail-panel-only fields (design, acceptance_criteria, notes, external_ref,
		// spec_id, agent_*) and the separately-fetched comments/attachments are dropped —
		// ~1.8MB on a 2200-issue board. The panel refetches the full issue via ?ids=.
		// description/close_reason/labels/dependencies stay: cards render them and client
		// search matches description.
		const { external_ref: _e, spec_id: _s, agent_state: _a, ...scalars } = mapIssueFields(r);
		return {
			id: r.id,
			seq: seqMap.get(r.id) ?? 0,
			title: r.title,
			description: r.description ?? '',
			status: r.status as Issue['status'],
			priority: r.priority as Issue['priority'],
			issue_type: r.issue_type,
			assignee: r.assignee || undefined,
			created_at: r.created_at,
			updated_at: r.updated_at,
			closed_at: r.closed_at || undefined,
			labels: r.labels ?? [],
			dependencies,
			dependents,
			dependency_count: dependencies.length,
			dependent_count: dependents.length,
			...scalars
		};
	}
	return {
		id: r.id,
		seq: seqMap.get(r.id) ?? 0,
		title: r.title,
		description: r.description ?? '',
		design: r.design || undefined,
		acceptance_criteria: r.acceptance_criteria || undefined,
		notes: r.notes || undefined,
		status: r.status as Issue['status'],
		priority: r.priority as Issue['priority'],
		issue_type: r.issue_type,
		assignee: r.assignee || undefined,
		created_at: r.created_at,
		updated_at: r.updated_at,
		closed_at: r.closed_at || undefined,
		labels: r.labels ?? [],
		dependencies,
		dependents,
		dependency_count: dependencies.length,
		dependent_count: dependents.length,
		attachments: attachmentsMap.get(r.id) ?? [],
		comments: [...(r.comments ?? [])]
			.sort((a, b) => cmp(a.created_at, b.created_at))
			.map((c) => ({ id: c.id, author: c.author, text: c.text, created_at: c.created_at })),
		agent_model: meta.agent_model,
		agent_effort: meta.agent_effort,
		...mapIssueFields(r)
	};
}
