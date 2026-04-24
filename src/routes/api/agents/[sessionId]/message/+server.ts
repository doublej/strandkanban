import { z } from 'zod';
import type { RequestHandler } from './$types';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody } from '$lib/server/schemas';

const AGENT_BASE = 'http://localhost:9347';

const MessageSchema = z.object({ text: z.string().min(1) });

export const POST: RequestHandler = wrap(async ({ params, request }) => {
	const body = await parseBody(request, MessageSchema);
	const res = await fetch(`${AGENT_BASE}/agents/${encodeURIComponent(params.sessionId)}/message`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	const data = await res.json();
	if (!res.ok) throw new ApiError(data?.error ?? 'Failed to send message', res.status);
	return ok(data);
});
