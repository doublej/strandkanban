import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { ok, wrap, ApiError } from '$lib/server/response';

/** Operational-state labels follow the `<dimension>:<value>` convention (alphanumeric, dash, underscore). */
const TOKEN = /^[a-zA-Z0-9_-]+$/;

export const POST: RequestHandler = wrap(async ({ params, request, url }) => {
	const body = await request.json().catch(() => ({}));
	const dimension = String(body?.dimension ?? '').trim();
	const value = String(body?.value ?? '').trim();
	const reason = body?.reason ? String(body.reason) : undefined;

	if (!TOKEN.test(dimension)) throw new ApiError('Invalid dimension (use letters, digits, - or _)');
	if (!TOKEN.test(value)) throw new ApiError('Invalid value (use letters, digits, - or _)');

	const cwd = requireProjectCwd(url);
	await beads(cwd).setState(params.id, dimension, value, reason);
	return ok({ updated: true });
});
