import type { RequestHandler } from './$types';
import { requireProjectCwd } from '$lib/server/cwd';
import { lintIssue } from '$lib/bd';
import { unwrapBdJson } from '$lib/bd';
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
	const result = await lintIssue(params.id, cwd);
	// Lint is advisory: on failure return an empty result rather than erroring the panel.
	if (!result.success || !result.stdout) return ok({ missing: [] as string[] });

	try {
		const parsed = unwrapBdJson<{ results?: LintResult[] }>(result.stdout);
		const missing = parsed.results?.find((r) => r.id === params.id)?.missing ?? [];
		return ok({ missing });
	} catch {
		return ok({ missing: [] as string[] });
	}
});
