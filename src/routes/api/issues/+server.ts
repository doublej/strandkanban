import type { RequestHandler } from './$types';
import { getAllIssues } from '$lib/db';
import { requireProjectCwd } from '$lib/server/cwd';
import { createIssue } from '$lib/bd';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody, CreateIssueSchema } from '$lib/server/schemas';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	// ?ids=a,b,c → only those issues, full fidelity (deep links + the detail panel's lazy
	// fetch of the fields the slim list omits).
	const ids = url.searchParams.get('ids')?.split(',').map((s) => s.trim()).filter(Boolean);
	if (ids?.length) return ok({ issues: getAllIssues(cwd, ids) });
	// List reads are slim; ?scope=active omits closed issues (board's first paint).
	const scope = url.searchParams.get('scope') === 'active' ? 'active' : 'all';
	return ok({ issues: getAllIssues(cwd, undefined, { slim: true, scope }) });
});

export const POST: RequestHandler = wrap(async ({ request, url }) => {
	const body = await parseBody(request, CreateIssueSchema);
	const cwd = requireProjectCwd(url);

	const result = await createIssue(
		body.title,
		{
			description: body.description,
			priority: body.priority,
			issue_type: body.issue_type,
			deps: body.deps ?? body.dependencies,
			due: body.due_at,
			estimate: body.estimated_minutes,
			external_ref: body.external_ref,
		},
		cwd,
	);
	if (!result.success || !result.issue) {
		throw new ApiError(result.error || 'Failed to create issue', 500);
	}

	const created = result.issue as {
		id: string;
		title: string;
		status: string;
		priority: number;
		assignee?: string;
	};
	notificationStore.emit('issue_created', created as never, { cwd });
	await hookExecutor.executeHooks('TicketCreated', {
		id: created.id,
		title: created.title,
		status: created.status,
		priority: created.priority,
		assignee: created.assignee,
		cwd,
	});

	return ok({ id: created.id, issue: created, warning: result.warning });
});
