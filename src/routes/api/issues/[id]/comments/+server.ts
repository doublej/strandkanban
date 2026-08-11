import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap } from '$lib/server/response';
import { parseBody, AddCommentSchema } from '$lib/server/schemas';

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const comments = await beads(cwd).comments(params.id);
	return ok({ comments });
});

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const { text } = await parseBody(request, AddCommentSchema);
	const cwd = requireProjectCwd(url);
	await beads(cwd).addComment(params.id, text);

	const issue = await beads(cwd).issue(params.id);
	if (issue) {
		notificationStore.emit('comment_added', issue, { cwd });
		await hookExecutor.executeHooks('CommentAdded', {
			id: issue.id,
			title: issue.title,
			status: issue.status,
			cwd,
			content: text,
			sender: 'user',
		});
	}

	return ok({ added: true });
});
