import type { RequestHandler } from './$types';
import { ok, wrap } from '$lib/server/response';
import { findOrphanedDoltPids, killDoltPids } from '$lib/dolt-reaper';
import { readTouchedCwds } from '$lib/touched-cwds';

export const GET: RequestHandler = wrap(async () => {
	const cwds = readTouchedCwds();
	const orphans = findOrphanedDoltPids(cwds);
	return ok({ orphaned: orphans.length, pids: orphans });
});

export const POST: RequestHandler = wrap(async () => {
	const cwds = readTouchedCwds();
	const orphans = findOrphanedDoltPids(cwds);
	const { killed, failed } = killDoltPids(orphans.map((o) => o.pid));
	return ok({ orphaned: orphans.length, pids: orphans, killed, failed });
});
