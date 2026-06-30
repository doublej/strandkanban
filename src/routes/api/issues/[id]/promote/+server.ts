import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { promoteWisp } from '$lib/bd';
import { ok, wrap, ApiError } from '$lib/server/response';

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json().catch(() => ({}));
	const reason = body?.reason ? String(body.reason) : undefined;

	const cwd = requireProjectCwd(url);
	const result = await promoteWisp(params.id, reason, cwd);
	if (!result.success) throw new ApiError(result.error || 'Failed to promote wisp');

	return ok({ promoted: true });
});
