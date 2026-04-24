import type { RequestHandler } from './$types';
import { getRecentEvents, resolveProjectCwd } from '$lib/db';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const limit = Number(url.searchParams.get('limit')) || 100;
	const events = getRecentEvents(Math.min(limit, 500), cwd);
	return ok({ events });
});
