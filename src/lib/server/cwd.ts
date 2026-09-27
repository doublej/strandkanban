/**
 * Project-cwd resolution helpers for server-side handlers.
 *
 * Every endpoint that touches project data MUST call requireProjectCwd().
 * The only fallback to the stored cwd is /api/cwd GET itself, which uses
 * resolveProjectCwd().
 *
 * cwd is always derived from the URL (?project=…). Body-based cwd is forbidden.
 */
import { basename, join, resolve } from 'path';
import { homedir } from 'os';
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'fs';
import { ApiError } from './response';

/** Written by /api/projects — the set of projects the user picked in the switcher. */
const PROJECTS_FILE = join(homedir(), '.strandkanban-projects.json');

const CWD_FILE = process.env.BEADS_KANBAN_CWD_FILE || join(process.cwd(), '.beads-cwd');

/** Resolve BD_DB env var to project root. If path ends with `.beads`, strip it. */
function resolveBdDbFallback(): string | null {
	const raw = process.env.BD_DB;
	if (!raw) return null;
	const resolved = resolve(raw);
	if (!existsSync(resolved)) return null;
	if (basename(resolved) === '.beads') {
		const parent = resolve(resolved, '..');
		return existsSync(parent) ? parent : null;
	}
	return resolved;
}

const doctorRanForCwd = new Set<string>();

/** True the first time this process sees `cwd`; subsequent calls return false. Session-scoped. */
export function markDoctorRan(cwd: string): boolean {
	if (doctorRanForCwd.has(cwd)) return false;
	doctorRanForCwd.add(cwd);
	return true;
}

/** One spelling per directory: symlinked paths (e.g. ~/Documents/development → ~/dev)
 *  must not become a second project, beads instance or dolt server. */
export function canonicalPath(path: string): string {
	return existsSync(path) ? realpathSync(path) : resolve(path);
}

export function getStoredCwd(): string {
	if (existsSync(CWD_FILE)) {
		const stored = readFileSync(CWD_FILE, 'utf-8').trim();
		if (stored && existsSync(stored)) return canonicalPath(stored);
	}
	const bdDb = resolveBdDbFallback();
	if (bdDb) return bdDb;
	return process.cwd();
}

export function setStoredCwd(path: string): void {
	writeFileSync(CWD_FILE, path, 'utf-8');
}

/** Paths the user registered in the project switcher. Re-read per call rather than cached:
 *  a project registers itself on first visit, while this process is already running. */
function registeredProjects(): Set<string> {
	try {
		const parsed = JSON.parse(readFileSync(PROJECTS_FILE, 'utf-8'));
		if (!Array.isArray(parsed)) return new Set();
		return new Set(
			parsed
				.map((p: { path?: string }) => (p?.path ? canonicalPath(p.path) : ''))
				.filter(Boolean)
		);
	} catch {
		return new Set();
	}
}

/**
 * Resolve the project cwd from a request URL's ?project= param, falling back to
 * getStoredCwd().
 *
 * ?project= is URL-controlled, so it is accepted only for the project already selected or
 * one the user registered in the switcher. Anything else silently falls back: an arbitrary
 * path here would seed the per-cwd beads registry (a dolt server each) and the reaper's
 * touched-cwd list straight from a request.
 */
export function resolveProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	const stored = getStoredCwd();
	if (project) {
		const resolved = canonicalPath(project);
		const allowed = resolved === stored || registeredProjects().has(resolved);
		if (allowed && existsSync(resolved)) return resolved;
	}
	return stored;
}

export function requireProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	if (!project) throw new ApiError('cwd required', 400, 'CWD_MISSING');
	const cwd = resolveProjectCwd(url);
	return cwd;
}
