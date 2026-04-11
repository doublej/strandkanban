import type { Reroute } from '@sveltejs/kit';

/**
 * Path-prefix cwd switch.
 *
 * URL `/Users/jj/proj/foo/api/issues` → longest prefix containing `.beads/`
 * becomes the active cwd; remainder is the UI path.
 *
 * Lives in the universal hooks file because SvelteKit only loads `reroute`
 * from here (not `hooks.server.ts`). Filesystem access is server-only, so
 * fs and $lib/db are dynamically imported under `import.meta.env.SSR`.
 */
export const reroute: Reroute = async ({ url }) => {
	if (!import.meta.env.SSR) return;
	if (!url.pathname.startsWith('/Users/') && !url.pathname.startsWith('/home/')) return;

	const { existsSync, statSync } = await import('fs');
	const { setStoredCwd } = await import('$lib/db');

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
		setStoredCwd(match.cwd);
	} catch (err) {
		console.error('[reroute] setStoredCwd failed:', err);
	}

	const rest = '/' + segments.slice(match.idx).join('/');
	return rest === '/' ? '/' : rest;
};
