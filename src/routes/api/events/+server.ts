import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRecentEvents, resolveProjectCwd } from '$lib/db';

export const GET: RequestHandler = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const limit = Number(url.searchParams.get('limit')) || 100;
	const events = getRecentEvents(Math.min(limit, 500), cwd);
	return json({ events });
};
