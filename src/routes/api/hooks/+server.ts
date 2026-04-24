import type { RequestHandler } from './$types';
import { resolveProjectCwd } from '$lib/db';
import { hookExecutor } from '$lib/server/agent/hook-executor';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const hooks = hookExecutor.getLoadedHooks(cwd);
	return ok({ cwd, hooks });
});
