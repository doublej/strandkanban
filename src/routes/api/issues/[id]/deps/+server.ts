import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap } from '$lib/server/response';
import { parseBody, AddDependencySchema, RemoveDependencySchema } from '$lib/server/schemas';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const { depends_on, dep_type } = await parseBody(request, AddDependencySchema);
	const cwd = requireProjectCwd(url);

	await beads(cwd).addDep(params.id, depends_on, dep_type ?? 'blocks');

	const issue = await beads(cwd).issue(params.id);
	if (issue) {
		notificationStore.emit('dependency_added', issue, { cwd });
		await hookExecutor.executeHooks('DependencyAdded', {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			cwd,
		});
	}
	return ok({ added: true });
});

export const DELETE: RequestHandler = wrap(async ({ params, request, url }) => {
	const { depends_on } = await parseBody(request, RemoveDependencySchema);
	const cwd = requireProjectCwd(url);

	await beads(cwd).removeDep(params.id, depends_on);
	return ok({ removed: true });
});
