import { readFile, writeFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import type { RequestHandler } from './$types';
import { ok, wrap, ApiError } from '$lib/server/response';
import { enrichProjects } from '$lib/server/project-stats';

const PROJECTS_FILE = join(homedir(), '.strandkanban-projects.json');

interface Project {
	path: string;
	name: string;
	lastAccess: string;
	color: string;
}

const PROJECT_COLORS = [
	'#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
	'#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
	'#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

function generateColor(path: string): string {
	let hash = 0;
	for (let i = 0; i < path.length; i++) {
		hash = ((hash << 5) - hash) + path.charCodeAt(i);
		hash |= 0;
	}
	return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

async function loadProjects(): Promise<Project[]> {
	try {
		return JSON.parse(await readFile(PROJECTS_FILE, 'utf-8'));
	} catch {
		return [];
	}
}

async function saveProjects(projects: Project[]): Promise<void> {
	await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2));
}

export const GET: RequestHandler = wrap(async () => {
	const projects = (await loadProjects()).map((p) => ({
		...p,
		color: p.color || generateColor(p.path),
	}));
	return ok({ projects: await enrichProjects(projects) });
});

export const POST: RequestHandler = wrap(async ({ request }) => {
	const { path, name, color } = (await request.json()) ?? {};
	if (!path) throw new ApiError('path required', 400, 'VALIDATION');

	const projects = await loadProjects();
	const existing = projects.find((p) => p.path === path);
	if (existing) {
		existing.lastAccess = new Date().toISOString();
		existing.name = name || existing.name;
		if (color) existing.color = color;
	} else {
		projects.push({
			path,
			name: name || path.split('/').pop() || path,
			lastAccess: new Date().toISOString(),
			color: color || generateColor(path),
		});
	}
	await saveProjects(projects);
	return ok({ projects: await enrichProjects(projects) });
});
