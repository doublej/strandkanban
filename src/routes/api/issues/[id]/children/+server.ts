import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { ok, wrap } from '$lib/server/response';

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const issues = await beads(cwd).issues();
	const children = issues
		.filter((issue) =>
			issue.dependencies?.some((d) => d.id === params.id && d.dependency_type === 'parent-child'),
		)
		.map((c) => ({ id: c.id, title: c.title, status: c.status }));
	return ok({ children });
});
