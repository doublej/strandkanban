import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { ok, wrap } from '$lib/server/response';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json().catch(() => ({}));
	const reason = body?.reason || 'Completed';

	const cwd = requireProjectCwd(url);
	await beads(cwd).close(params.id, reason, body?.force === true);
	return ok({ closed: true });
});
