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
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { ApiError } from './response';

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

export function getStoredCwd(): string {
	if (existsSync(CWD_FILE)) {
		const stored = readFileSync(CWD_FILE, 'utf-8').trim();
		if (stored && existsSync(stored)) return stored;
	}
	const bdDb = resolveBdDbFallback();
	if (bdDb) return bdDb;
	return process.cwd();
}

export function setStoredCwd(path: string): void {
	writeFileSync(CWD_FILE, path, 'utf-8');
}

/** Resolve the project cwd from a request URL's ?project= param, falling back to getStoredCwd(). */
export function resolveProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	if (project) {
		const resolved = resolve(project);
		if (existsSync(resolved)) return resolved;
	}
	return getStoredCwd();
}

export function requireProjectCwd(url: URL): string {
	const project = url.searchParams.get('project');
	if (!project) throw new ApiError('cwd required', 400, 'CWD_MISSING');
	const cwd = resolveProjectCwd(url);
	return cwd;
}
