import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { beads } from '$lib/server/beads/client';
import { ok, wrap } from '$lib/server/response';

interface LintResult {
	id: string;
	title: string;
	type: string;
	missing: string[];
	warnings: number;
}

export const GET: RequestHandler = wrap(async ({ params, url }) => {
	const cwd = requireProjectCwd(url);
	const parsed = await beads(cwd).readJson<{ results?: LintResult[] }>(['lint', params.id, '--json']);
	const missing = parsed.results?.find((r) => r.id === params.id)?.missing ?? [];
	return ok({ missing });
});
