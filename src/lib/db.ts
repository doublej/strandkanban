/**
 * Read-only database access via `bd sql --json`.
 * Requires bd in Dolt server mode (`bd init --server`); embedded mode does not expose `bd sql`.
 * Min bd version: see MIN_BD_VERSION in bd.ts.
 */
import { spawnSync } from 'child_process';
import { basename, join, resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import type { Issue, MutationEntry, Attachment, Comment } from './types';
import { getMimetype } from './server/attachments';
import { recordTouchedCwd } from './touched-cwds';
import { bdEnv, unwrapBdJson } from './bd';
import { parseEvent, type DbEvent } from './event-parse';
import { mapExportIssue, type DepView, type ExportIssue } from './server/beads/map';

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

/** Validate issue IDs to prevent SQL injection in interpolated queries. */
function safeId(id: string): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Invalid issue ID: ${id}`);
	return id;
}

/** Timeout for a single `bd` read (sql/export). Generous default so a large JSONL
 *  auto-import isn't SIGTERM-killed mid-import. Override via env. */
const BD_SQL_TIMEOUT_MS = (() => {
	const n = Number(process.env.BEADS_KANBAN_BD_SQL_TIMEOUT_MS);
	return Number.isFinite(n) && n > 0 ? n : 30000;
})();

/**
 * Run a SELECT via `bd sql --json`. Works against server-mode Dolt projects (bd manages
 * the Dolt server / SQLite and loads the JSONL), but rebuilds a throwaway database from
 * the JSONL on every call, so it is O(JSONL size). NOT supported on embedded-mode
 * projects (bd 1.1 exits 1 with "not yet supported in embedded mode") — callers must
 * handle that. Hot read paths use `bdExport` instead; this remains for the events feed
 * and single-purpose queries. Uses spawnSync to avoid shell-quoting issues.
 */
function bdSql<T>(query: string, cwd?: string): T[] {
	const effectiveCwd = cwd ?? getStoredCwd();
	recordTouchedCwd(effectiveCwd);

	const result = spawnSync('bd', ['sql', '--json', query], {
		cwd: effectiveCwd,
		encoding: 'utf-8',
		timeout: BD_SQL_TIMEOUT_MS,
		env: bdEnv()
	});
	// On timeout, spawnSync kills the child (signal SIGTERM, error code ETIMEDOUT) and leaves
	// whatever bd had printed so far in stderr — typically the "auto-importing … into empty
	// database" banner. Surfacing that banner as the error is misleading, so report the timeout.
	const timedOut =
		result.signal === 'SIGTERM' ||
		(result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
	if (timedOut) {
		throw new Error(
			`bd sql timed out after ${BD_SQL_TIMEOUT_MS}ms in ${effectiveCwd} — bd is likely ` +
				`re-importing the JSONL on every query. Ensure the project's Dolt server is running, ` +
				`or raise BEADS_KANBAN_BD_SQL_TIMEOUT_MS.`
		);
	}
	if (result.status !== 0 || result.error) {
		const msg = result.stderr?.trim() || result.error?.message || 'bd sql failed';
		throw new Error(msg);
	}
	return unwrapBdJson<T[]>(result.stdout.trim());
}

/**
 * Per-project `bd export` cache. An export costs ~1.3s on a big project and blocks the
 * event loop, while the read paths (2s poll, every SSE event, every single-issue read)
 * hammer it. A cached entry is used only if all three hold: the generation counter still
 * matches (every write through this process bumps it — the correctness guarantee), the
 * JSONL mtime is unchanged, and it is younger than EXPORT_TTL_MS. mtime and max-age are
 * backstops for writers this process can't observe; extra invalidation costs an export,
 * never correctness.
 *
 * ponytail: writes that bypass BOTH this process and bd's JSONL export (direct dolt
 * writes, a second server process) are only caught by the 30s max-age. Same blindness the
 * app has today; cross-process locking if that ever bites.
 */
const exportGen = new Map<string, number>();
const exportCache = new Map<string, { gen: number; mtimeMs: number; at: number; rows: ExportIssue[] }>();
const EXPORT_TTL_MS = 30_000;
const EXPORT_CACHE_MAX = 3; // project switcher keeps a couple of projects warm

/** JSONL mtime, or -1 when it can't be stat'ed (embedded mode) — a stable value there, so
 *  a missing file doesn't permanently disable the cache. */
function jsonlMtimeMs(cwd: string): number {
	try {
		return statSync(join(cwd, '.beads', 'issues.jsonl')).mtimeMs;
	} catch {
		return -1;
	}
}

/** Mark a project's cached export stale. Bumps a counter rather than deleting, so it is
 *  idempotent and safe against an export that is already in flight. */
export function invalidateExport(cwd?: string): void {
	const key = cwd ?? getStoredCwd();
	exportGen.set(key, (exportGen.get(key) ?? 0) + 1);
}

function bdExport(cwd?: string): ExportIssue[] {
	const effectiveCwd = cwd ?? getStoredCwd();
	// Captured BEFORE the export: a write landing mid-export must make the new entry stale,
	// not tag stale rows as fresh.
	const gen = exportGen.get(effectiveCwd) ?? 0;
	const mtimeMs = jsonlMtimeMs(effectiveCwd);

	const hit = exportCache.get(effectiveCwd);
	if (hit && hit.gen === gen && hit.mtimeMs === mtimeMs && Date.now() - hit.at < EXPORT_TTL_MS) {
		return hit.rows;
	}

	const rows = bdExportUncached(effectiveCwd);
	if (!exportCache.has(effectiveCwd) && exportCache.size >= EXPORT_CACHE_MAX) {
		exportCache.delete(exportCache.keys().next().value as string);
	}
	exportCache.set(effectiveCwd, { gen, mtimeMs, at: Date.now(), rows });
	return rows;
}

/**
 * Read all issues via `bd export` (JSONL). Unlike `bd sql` — which rebuilds a throwaway
 * database from the JSONL on every call (O(size), seconds) — bd serves this from the live
 * database it manages, so it is fast (~0.5s) and correct. Full-fidelity: dependencies,
 * labels and comments are inline. Empty/null columns are omitted, mapping to `undefined`.
 */
function bdExportUncached(effectiveCwd: string): ExportIssue[] {
	recordTouchedCwd(effectiveCwd);

	const result = spawnSync('bd', ['export'], {
		cwd: effectiveCwd,
		encoding: 'utf-8',
		timeout: BD_SQL_TIMEOUT_MS,
		maxBuffer: 256 * 1024 * 1024,
		env: bdEnv()
	});
	const timedOut =
		result.signal === 'SIGTERM' ||
		(result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
	if (timedOut) {
		throw new Error(
			`bd export timed out after ${BD_SQL_TIMEOUT_MS}ms in ${effectiveCwd}. Ensure the ` +
				`project's bd database is healthy, or raise BEADS_KANBAN_BD_SQL_TIMEOUT_MS.`
		);
	}
	if (result.status !== 0 || result.error) {
		const msg = result.stderr?.trim() || result.error?.message || 'bd export failed';
		throw new Error(msg);
	}

	const issues: ExportIssue[] = [];
	for (const line of result.stdout.split('\n')) {
		const t = line.trim();
		if (t[0] !== '{') continue; // skip blanks / any stray banner line
		let obj: ExportIssue;
		try {
			obj = JSON.parse(t);
		} catch {
			continue;
		}
		if (obj._type === 'memory' || !obj.id || !obj.title) continue; // memories aren't issues
		issues.push(obj);
	}
	return issues;
}

/** Lexical string compare (ISO-8601 timestamps sort chronologically this way). */
function cmp(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function pushInto<V>(map: Map<string, V[]>, key: string, val: V): void {
	const list = map.get(key);
	if (list) list.push(val);
	else map.set(key, [val]);
}

/** Issue count without paying for the mapping — served from the export cache. */
export function countIssues(cwd?: string): number {
	return bdExport(cwd).filter((r) => r.status !== 'tombstone').length;
}

export interface GetIssuesOptions {
	/** Drop detail-panel-only fields and skip the attachment directory walk. */
	slim?: boolean;
	/** 'active' omits closed issues (loaded by the board in a second pass). */
	scope?: 'all' | 'active';
}

/**
 * All issues, or — when `ids` is given — only those (accepting both the full id and the
 * unprefixed short form, like `bd show`). The narrow form skips per-row mapping and the
 * attachment scan for thousands of untouched rows, so a deep link doesn't pay for the
 * whole board.
 */
export function getAllIssues(cwd?: string, ids?: string[], opts: GetIssuesOptions = {}): Issue[] {
	const { slim = false, scope = 'all' } = opts;
	const allRows = bdExport(cwd).filter((r) => r.status !== 'tombstone');
	let rows = ids?.length
		? allRows.filter((r) => ids.some((id) => r.id === id || r.id.endsWith(`-${id}`)))
		: allRows;
	if (scope === 'active') rows = rows.filter((r) => r.status !== 'closed');
	const byId = new Map(allRows.map((r) => [r.id, r]));

	// seq mirrors `ROW_NUMBER() OVER (ORDER BY created_at)`: the oldest issue is 1.
	const seqMap = new Map<string, number>();
	[...allRows]
		.sort((a, b) => cmp(a.created_at, b.created_at) || cmp(a.id, b.id))
		.forEach((r, i) => seqMap.set(r.id, i + 1));

	// Outgoing deps (this issue depends on X) and their reverse (dependents), keeping only
	// edges whose other endpoint still exists — matching the INNER JOINs of the sql path.
	const depsMap = new Map<string, DepView[]>();
	const dependentsMap = new Map<string, DepView[]>();
	for (const r of allRows) {
		for (const d of r.dependencies ?? []) {
			const target = byId.get(d.depends_on_id);
			if (target) pushInto(depsMap, d.issue_id, { id: d.depends_on_id, title: target.title, status: target.status, dependency_type: d.type });
			const source = byId.get(d.issue_id);
			if (source) pushInto(dependentsMap, d.depends_on_id, { id: d.issue_id, title: source.title, status: source.status, dependency_type: d.type });
		}
	}

	const attachmentsMap = slim
		? new Map<string, Attachment[]>()
		: ids?.length
			? new Map(rows.map((r) => [r.id, getAttachmentsForIssue(r.id, cwd)]))
			: getAllAttachments(cwd);

	return rows
		.sort((a, b) => b.priority - a.priority || cmp(b.created_at, a.created_at))
		.map((r) => mapExportIssue(r, seqMap, depsMap, dependentsMap, attachmentsMap, slim));
}

export function getIssueById(id: string, cwd?: string): Issue | null {
	const sid = safeId(id);
	// Narrow read: skips mapping every other row plus the whole-tree attachment readdir.
	return getAllIssues(cwd, [sid]).find((issue) => issue.id === sid) ?? null;
}

/** `unsupported` marks embedded-mode projects, which have no queryable event feed. */
export function getRecentEvents(limit = 100, cwd?: string): { events: MutationEntry[]; unsupported: boolean } {
	let rows: DbEvent[];
	try {
		rows = bdSql<DbEvent>(`
			SELECT id, issue_id, event_type, actor, old_value, new_value, comment, created_at
			FROM events ORDER BY created_at DESC LIMIT ${Math.floor(limit)}
		`, cwd);
	} catch (err) {
		// bd 1.1 does not support `bd sql` on embedded-mode projects — serve an empty
		// feed there; the SSE stream (fs.watch based) still drives board refreshes.
		if (String(err).includes('not yet supported in embedded mode')) return { events: [], unsupported: true };
		throw err;
	}

	return { events: rows.flatMap(parseEvent), unsupported: false };
}

export function getComments(issueId: string, cwd?: string): Comment[] {
	// Comments are inline in `bd export`; reuse the fast issue read (sorted created_at ASC).
	return getIssueById(issueId, cwd)?.comments ?? [];
}

export function getAttachmentsForIssue(issueId: string, cwd?: string): Attachment[] {
	const dir = join(cwd ?? getStoredCwd(), '.beads', 'attachments', issueId);
	if (!existsSync(dir)) return [];

	return readdirSync(dir).map((filename) => {
		const filePath = join(dir, filename);
		const stats = statSync(filePath);
		return {
			filename,
			size: stats.size,
			mimetype: getMimetype(filename),
			created_at: stats.birthtime.toISOString(),
		};
	});
}

export function getAllAttachments(cwd?: string): Map<string, Attachment[]> {
	const attachmentsDir = join(cwd ?? getStoredCwd(), '.beads', 'attachments');
	if (!existsSync(attachmentsDir)) return new Map();

	const result = new Map<string, Attachment[]>();
	for (const issueId of readdirSync(attachmentsDir)) {
		const issueDir = join(attachmentsDir, issueId);
		const stat = statSync(issueDir);
		if (!stat.isDirectory()) continue;

		const attachments = getAttachmentsForIssue(issueId, cwd);
		if (attachments.length > 0) result.set(issueId, attachments);
	}
	return result;
}
