import type { RequestHandler } from './$types';
import { resolveProjectCwd } from '$lib/db';
import { listActiveWorktrees } from '$lib/server/agent/worktree-registry';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const worktrees = listActiveWorktrees(cwd);
	return ok({ cwd, worktrees });
});
