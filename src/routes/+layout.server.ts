import type { LayoutServerLoad } from './$types';
import { join } from 'path';
import { readFileSync } from 'fs';
import { resolveProjectCwd } from '$lib/db';

function getProjectName(projectDir: string): string {
	const fallback = projectDir.split('/').pop() || projectDir;
	const tomlPath = join(projectDir, 'pyproject.toml');
	let content: string;
	try { content = readFileSync(tomlPath, 'utf-8'); } catch { return fallback; }
	const match = content.match(/^name\s*=\s*"([^"]+)"/m);
	return match ? match[1] : fallback;
}

export const load: LayoutServerLoad = async ({ url }) => {
	const cwd = resolveProjectCwd(url);
	const folderName = getProjectName(cwd);
	return { cwd, folderName };
};
