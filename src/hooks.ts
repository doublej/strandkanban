import type { Reroute } from '@sveltejs/kit';

/**
 * Path-prefix cwd switch.
 *
 * URL `/Users/jj/proj/foo/api/issues` → longest prefix containing `.beads/`
 * becomes the active cwd; remainder is the UI path.
 *
 * Lives in the universal hooks file because SvelteKit only loads `reroute`
 * from here (not `hooks.server.ts`), so this module is part of the CLIENT
 * bundle. It must therefore never import a server module — importing
 * `$lib/db` here dragged child_process/better-sqlite3 into the browser graph
 * and broke `vite build`. The cwd file is written inline instead; the
 * canonical reader/writer pair lives in `$lib/server/cwd.ts`.
 */
export const reroute: Reroute = async ({ url }) => {
	if (!import.meta.env.SSR) return;
	if (!url.pathname.startsWith('/Users/') && !url.pathname.startsWith('/home/')) return;

	const { existsSync, statSync, writeFileSync } = await import('fs');
	const { join } = await import('path');

	const segments = url.pathname.split('/').filter(Boolean);
	let match: { cwd: string; idx: number } | null = null;
	for (let i = 1; i <= segments.length; i++) {
		const candidate = '/' + segments.slice(0, i).join('/');
		if (!existsSync(candidate)) break;
		try {
			if (!statSync(candidate).isDirectory()) break;
		} catch {
			break;
		}
		if (existsSync(candidate + '/.beads')) {
			match = { cwd: candidate, idx: i };
		}
	}
	if (!match) return;

	try {
		// Keep in sync with CWD_FILE in $lib/server/cwd.ts (can't import it — see above).
		writeFileSync(
			process.env.BEADS_KANBAN_CWD_FILE || join(process.cwd(), '.beads-cwd'),
			match.cwd,
			'utf-8'
		);
	} catch (err) {
		console.error('[reroute] storing cwd failed:', err);
	}

	const rest = '/' + segments.slice(match.idx).join('/');
	return rest === '/' ? '/' : rest;
};
