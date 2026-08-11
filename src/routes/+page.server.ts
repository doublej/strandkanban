import type { PageServerLoad } from './$types';
import type { Issue } from '$lib/types';
import { countIssues, getAllIssues, resolveProjectCwd } from '$lib/db';

/** Above this, serializing the board into the HTML costs more than it saves (19MB of
 *  document + hydration on a 2200-issue project). The client's fetch fills it instead —
 *  the same path already used when this load fails. */
const SSR_SEED_MAX_ISSUES = 400;

/**
 * SSR-preload issues so the board ships filled in the initial HTML instead of
 * blank-then-fetch. resolveProjectCwd falls back to the stored cwd, so this works
 * with or without ?project= and sidesteps the client-side cwd race on cold load.
 * bd export works in embedded mode, so this is safe for the stored cwd.
 */
export const load: PageServerLoad = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	// ?zen= renders a fullscreen overlay over a board nobody sees yet, so export only the
	// linked issues and leave the board to the client's fetch. Seeding the whole board
	// here costs a full export plus megabytes of HTML before Zen can paint.
	const zenIds = url.searchParams.get('zen')?.split(',').map((s) => s.trim()).filter(Boolean);
	let issues: Issue[] = [];
	let zenIssues: Issue[] = [];
	try {
		if (zenIds?.length) zenIssues = getAllIssues(cwd, zenIds);
		else if (countIssues(cwd) <= SSR_SEED_MAX_ISSUES) issues = getAllIssues(cwd, undefined, { slim: true });
	} catch {
		// bd unavailable/unhealthy in the server env — fall through to empty; the
		// client's existing fetch/retry path repopulates the board.
	}
	return { cwd, issues, zenIssues };
};
