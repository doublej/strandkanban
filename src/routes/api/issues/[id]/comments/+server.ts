import type { RequestHandler } from './$types';
import { resolveProjectCwd, getComments, getIssueById } from '$lib/db';
import { addComment } from '$lib/bd';
import { notificationStore } from '$lib/notifications/notification-store.svelte';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap, ApiError } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = resolveProjectCwd(url);
	const comments = getComments(params.id, cwd);
	return ok({ comments });
});

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const { text } = (await request.json()) ?? {};
	if (!text?.trim()) throw new ApiError('Comment text required', 400, 'VALIDATION');

	const cwd = resolveProjectCwd(url);
	const result = await addComment(params.id, text, cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to add comment');

	const issue = getIssueById(params.id, cwd);
	if (issue) {
		notificationStore.emit('comment_added', issue);
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
