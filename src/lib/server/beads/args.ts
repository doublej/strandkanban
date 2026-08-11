/**
 * Pure argv builders for the `bd` CLI. No I/O — these are what `client.test.ts`
 * asserts against, so keeping them free of the transport keeps the test honest.
 */

export interface CreateOpts {
	id?: string;
	assignee?: string;
	labels?: string[];
	description?: string;
	design?: string;
	acceptance?: string;
	priority?: number;
	issue_type?: string;
	deps?: string[];
	due?: string;
	estimate?: number;
	external_ref?: string;
}

export function createArgs(title: string, o: CreateOpts = {}): string[] {
	const args = ['create', title, '--json'];
	if (o.id) args.push('--id', o.id);
	if (o.assignee) args.push('--assignee', o.assignee);
	if (o.labels?.length) args.push('--labels', o.labels.join(','));
	if (o.description) args.push('--description', o.description);
	if (o.design) args.push('--design', o.design);
	if (o.acceptance) args.push('--acceptance', o.acceptance);
	if (o.priority !== undefined) args.push('--priority', String(o.priority));
	if (o.issue_type) args.push('--type', o.issue_type);
	if (o.deps?.length) args.push('--deps', o.deps.join(','));
	if (o.due) args.push('--due', o.due);
	if (o.estimate !== undefined) args.push('--estimate', String(Math.round(o.estimate)));
	if (o.external_ref) args.push('--external-ref', o.external_ref);
	return args;
}

export interface UpdateOpts {
	status?: string;
	title?: string;
	description?: string;
	priority?: number;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	assignee?: string;
	appendNotes?: string;
	ephemeral?: boolean;
	due?: string;
	defer?: string;
	external_ref?: string;
	spec_id?: string;
	estimate?: number;
	addLabels?: string[];
	removeLabels?: string[];
	setMetadata?: Record<string, string>;
	unsetMetadata?: string[];
}

const UPDATE_STRING_FLAGS = [
	['status', '--status'],
	['title', '--title'],
	['description', '--description'],
	['design', '--design'],
	['acceptance_criteria', '--acceptance'],
	['notes', '--notes'],
	['assignee', '--assignee'],
	['appendNotes', '--append-notes'],
	['due', '--due'],
	['defer', '--defer'],
	['external_ref', '--external-ref'],
	['spec_id', '--spec-id']
] as const;

/**
 * One `bd update` invocation for the whole change set — labels and metadata included.
 * The old code spawned bd once per label and once per metadata key on top of the update,
 * widening the lost-update window to N spawns. `null` means there is nothing to do.
 */
export function updateArgs(id: string, u: UpdateOpts): string[] | null {
	const args = ['update', id];
	for (const [field, flag] of UPDATE_STRING_FLAGS) {
		const v = u[field];
		if (v !== undefined) args.push(flag, String(v));
	}
	if (u.priority !== undefined) args.push('--priority', String(u.priority));
	if (u.estimate !== undefined) args.push('--estimate', String(Math.round(u.estimate)));
	if (u.ephemeral === true) args.push('--ephemeral');
	if (u.ephemeral === false) args.push('--persistent');
	for (const label of u.removeLabels ?? []) args.push('--remove-label', label);
	for (const label of u.addLabels ?? []) args.push('--add-label', label);
	for (const [k, v] of Object.entries(u.setMetadata ?? {})) args.push('--set-metadata', `${k}=${v}`);
	for (const k of u.unsetMetadata ?? []) args.push('--unset-metadata', k);
	return args.length > 2 ? args : null;
}
