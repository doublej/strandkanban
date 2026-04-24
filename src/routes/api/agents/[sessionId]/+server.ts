import type { RequestHandler } from './$types';
import { ok, wrap, ApiError } from '$lib/server/response';

const AGENT_BASE = 'http://localhost:9347';

export const GET: RequestHandler = wrap(async ({ params }) => {
	const res = await fetch(`${AGENT_BASE}/agents/${encodeURIComponent(params.sessionId)}`);
	const data = await res.json();
	if (!res.ok) throw new ApiError(data?.error ?? 'Session not found', res.status);
	return ok(data);
});

export const DELETE: RequestHandler = wrap(async ({ params }) => {
	const res = await fetch(`${AGENT_BASE}/agents/${encodeURIComponent(params.sessionId)}`, {
		method: 'DELETE',
	});
	const data = await res.json();
	if (!res.ok) throw new ApiError(data?.error ?? 'Session not found', res.status);
	return ok(data);
});
