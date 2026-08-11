import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { ok, wrap } from '$lib/server/response';

/**
 * Polling fallback for /api/events/stream. Returns the recent mutation
 * log; pass ?since=<unix-ms> to fetch only newer entries.
 */
export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
	const since = Number(url.searchParams.get('since')) || 0;
	const { events, unsupported } = await beads(cwd).recentEvents(limit);
	return ok({ events: events.filter((e) => e.timestamp > since), unsupported });
});
