import { z } from 'zod';
import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { ok, wrap, ApiError } from '$lib/server/response';
import { parseBody } from '$lib/server/schemas';

const AGENT_BASE = 'http://localhost:9347';

const StartAgentSchema = z.object({
	ticketId: z.string().min(1),
	agentName: z.string().optional(),
	model: z.string().optional(),
	useWorktree: z.boolean().optional(),
	title: z.string().optional(),
	description: z.string().optional(),
	priority: z.number().int().min(0).max(4).optional(),
	issueType: z.string().optional(),
});

export const POST: RequestHandler = wrap(async ({ request, url }) => {
	const body = await parseBody(request, StartAgentSchema);
	const cwd = requireProjectCwd(url);

	const res = await fetch(`${AGENT_BASE}/agents`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ ...body, cwd }),
	});
	const data = await res.json();
	if (!res.ok) throw new ApiError(data?.error ?? 'Agent server error', res.status);
	return ok(data);
});

export const GET: RequestHandler = wrap(async ({ url }) => {
	const cwd = requireProjectCwd(url);
	const res = await fetch(`${AGENT_BASE}/agents?cwd=${encodeURIComponent(cwd)}`);
	const data = await res.json();
	if (!res.ok) throw new ApiError(data?.error ?? 'Agent server error', res.status);
	return ok(data);
});
