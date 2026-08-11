/**
 * The one typed client for the `bd` CLI.
 *
 * Every read and write in the app goes through `beads(cwd)`. Commands are spawned with
 * `execFile` and an argv array — never a shell — so no value is ever quoted or escaped.
 * Failures throw; routes run inside `wrap()`, which turns them into structured errors.
 * The two exceptions are `ping()` and `doctor()`: reporting bd's health IS their payload,
 * so they return it as data.
 */
import { execFile } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { statSync } from 'fs';
import type { Issue, Comment, MutationEntry, Attachment } from '../../types';
import { recordTouchedCwd } from '../../touched-cwds';
import { parseEvent, type DbEvent } from '../../event-parse';
import { getAllAttachments, getAttachmentsForIssue } from '../attachments';
import { cmp, mapExportIssue, type DepView, type ExportIssue } from './map';

const execFileAsync = promisify(execFile);

/** Generous default so a large JSONL auto-import isn't SIGTERM-killed mid-import. */
const DEFAULT_TIMEOUT_MS = (() => {
	const n = Number(process.env.BEADS_KANBAN_BD_SQL_TIMEOUT_MS);
	return Number.isFinite(n) && n > 0 ? n : 30_000;
})();

/** Node defaults stdout to 1MB, which ENOBUFS-kills `bd history --json` on big projects. */
const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

interface RunOpts {
	timeoutMs?: number;
	maxBuffer?: number;
}

async function runBd(cwd: string, args: string[], opts: RunOpts = {}): Promise<string> {
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	try {
		const { stdout } = await execFileAsync('bd', args, {
			cwd,
			env: { ...process.env, BD_JSON_ENVELOPE: '1' },
			timeout: timeoutMs,
			maxBuffer: opts.maxBuffer ?? DEFAULT_MAX_BUFFER,
			encoding: 'utf-8'
		});
		return stdout.trim();
	} catch (e) {
		const err = e as { stderr?: string; message?: string; killed?: boolean; signal?: string };
		if (err.killed && err.signal === 'SIGTERM') {
			throw new Error(`bd ${args[0]} timed out after ${timeoutMs}ms in ${cwd}`);
		}
		throw new Error(err.stderr?.trim() || err.message || `bd ${args[0]} failed`);
	}
}

/**
 * Parse bd JSON output, unwrapping the 1.0 envelope `{data, schema_version}` if present.
 * Pre-1.0 (or future tools that don't envelope) return their payload directly — both shapes work.
 */
export function unwrapBdJson<T = unknown>(raw: string): T {
	const parsed = JSON.parse(raw);
	if (
		parsed &&
		typeof parsed === 'object' &&
		!Array.isArray(parsed) &&
		'schema_version' in parsed &&
		'data' in parsed
	) {
		return (parsed as { data: T }).data;
	}
	return parsed as T;
}

/** If stdout is a bd JSON envelope, return the inner `.data` re-serialized; otherwise
 *  return it unchanged. For callers that hand bd's output straight to a model. */
export function unwrapEnvelopeText(stdout: string): string {
	if (!stdout.startsWith('{')) return stdout;
	try {
		return JSON.stringify(unwrapBdJson(stdout));
	} catch {
		return stdout;
	}
}

// --- argv builders (pure) ---

export interface CreateOpts {
	id?: string;
	assignee?: string;
	labels?: string[];
	description?: string;
	design?: string;
	acceptance?: string;
	priority?: number;
	issue_type?: string;
	deps?: string[];
	due?: string;
	estimate?: number;
	external_ref?: string;
}

export function createArgs(title: string, o: CreateOpts = {}): string[] {
	const args = ['create', title, '--json'];
	if (o.id) args.push('--id', o.id);
	if (o.assignee) args.push('--assignee', o.assignee);
	if (o.labels?.length) args.push('--labels', o.labels.join(','));
	if (o.description) args.push('--description', o.description);
	if (o.design) args.push('--design', o.design);
	if (o.acceptance) args.push('--acceptance', o.acceptance);
	if (o.priority !== undefined) args.push('--priority', String(o.priority));
	if (o.issue_type) args.push('--type', o.issue_type);
	if (o.deps?.length) args.push('--deps', o.deps.join(','));
	if (o.due) args.push('--due', o.due);
	if (o.estimate !== undefined) args.push('--estimate', String(Math.round(o.estimate)));
	if (o.external_ref) args.push('--external-ref', o.external_ref);
	return args;
}

export interface UpdateOpts {
	status?: string;
	title?: string;
	description?: string;
	priority?: number;
	design?: string;
	acceptance_criteria?: string;
	notes?: string;
	assignee?: string;
	appendNotes?: string;
	ephemeral?: boolean;
	due?: string;
	defer?: string;
	external_ref?: string;
	spec_id?: string;
	estimate?: number;
	addLabels?: string[];
	removeLabels?: string[];
	setMetadata?: Record<string, string>;
	unsetMetadata?: string[];
}

const UPDATE_STRING_FLAGS = [
	['status', '--status'],
	['title', '--title'],
	['description', '--description'],
	['design', '--design'],
	['acceptance_criteria', '--acceptance'],
	['notes', '--notes'],
	['assignee', '--assignee'],
	['appendNotes', '--append-notes'],
	['due', '--due'],
	['defer', '--defer'],
	['external_ref', '--external-ref'],
	['spec_id', '--spec-id']
] as const;

/**
 * One `bd update` invocation for the whole change set — labels and metadata included.
 * The old code spawned bd once per label and once per metadata key on top of the update,
 * widening the lost-update window to N spawns. `null` means there is nothing to do.
 */
export function updateArgs(id: string, u: UpdateOpts): string[] | null {
	const args = ['update', id];
	for (const [field, flag] of UPDATE_STRING_FLAGS) {
		const v = u[field];
		if (v !== undefined) args.push(flag, String(v));
	}
	if (u.priority !== undefined) args.push('--priority', String(u.priority));
	if (u.estimate !== undefined) args.push('--estimate', String(Math.round(u.estimate)));
	if (u.ephemeral === true) args.push('--ephemeral');
	if (u.ephemeral === false) args.push('--persistent');
	for (const label of u.removeLabels ?? []) args.push('--remove-label', label);
	for (const label of u.addLabels ?? []) args.push('--add-label', label);
	for (const [k, v] of Object.entries(u.setMetadata ?? {})) args.push('--set-metadata', `${k}=${v}`);
	for (const k of u.unsetMetadata ?? []) args.push('--unset-metadata', k);
	return args.length > 2 ? args : null;
}

// --- export cache ---

const EXPORT_TTL_MS = 30_000;

interface ExportEntry {
	gen: number;
	mtimeMs: number;
	at: number;
	rows: ExportIssue[];
}

/**
 * A cached export is usable only if all three hold: no write has landed through this
 * process since (gen — the correctness guarantee), the JSONL is untouched (mtime), and it
 * is younger than the TTL. The latter two are backstops for writers we can't observe.
 *
 * ponytail: writes that bypass BOTH this process and bd's JSONL export (direct dolt
 * writes, a second server process) are only caught by the 30s max-age. Same blindness the
 * app has today; cross-process locking if that ever bites.
 */
export function isFresh(e: ExportEntry, gen: number, mtimeMs: number, now: number): boolean {
	return e.gen === gen && e.mtimeMs === mtimeMs && now - e.at < EXPORT_TTL_MS;
}

/** JSONL mtime, or -1 when it can't be stat'ed (embedded mode) — a stable value there, so
 *  a missing file doesn't permanently disable the cache. */
function jsonlMtimeMs(cwd: string): number {
	try {
		return statSync(join(cwd, '.beads', 'issues.jsonl')).mtimeMs;
	} catch {
		return -1;
	}
}

/** Rows out of `bd export`'s JSONL. Skips blanks, stray banners and memory beads. */
export function parseExport(stdout: string): ExportIssue[] {
	const issues: ExportIssue[] = [];
	for (const line of stdout.split('\n')) {
		const t = line.trim();
		if (t[0] !== '{') continue;
		let obj: ExportIssue;
		try {
			obj = JSON.parse(t);
		} catch {
			continue;
		}
		if (obj._type === 'memory' || !obj.id || !obj.title) continue;
		issues.push(obj);
	}
	return issues;
}

function pushInto<V>(map: Map<string, V[]>, key: string, val: V): void {
	const list = map.get(key);
	if (list) list.push(val);
	else map.set(key, [val]);
}

/** Reject ids that aren't plain identifiers before they reach bd or a SQL string. */
function safeId(id: string): string {
	if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw new Error(`Invalid issue ID: ${id}`);
	return id;
}

export interface GetIssuesOptions {
	/** Drop detail-panel-only fields and skip the attachment directory walk. */
	slim?: boolean;
	/** 'active' omits closed issues (loaded by the board in a second pass). */
	scope?: 'all' | 'active';
}

export interface BdPing {
	ok: boolean;
	status?: string;
	total_ms?: number;
	error?: string;
}

export interface BdDoctorFinding {
	severity?: string;
	message?: string;
	fixed?: boolean;
}

export interface BdDoctorReport {
	ok: boolean;
	findings: BdDoctorFinding[];
	error?: string;
}

export class Beads {
	#gen = 0;
	#cache: ExportEntry | null = null;

	constructor(readonly cwd: string) {}

	/** Mark the cached export stale. Bumping a counter rather than deleting keeps this
	 *  idempotent and safe against an export already in flight. */
	invalidate(): void {
		this.#gen++;
	}

	/** Raw read-only bd invocation. Escape hatch for callers that own their own parsing. */
	async read(args: string[], opts?: RunOpts): Promise<string> {
		recordTouchedCwd(this.cwd);
		return runBd(this.cwd, args, opts);
	}

	/** Raw mutating bd invocation. Drops the export cache even on failure — a failed bd
	 *  may still have mutated. */
	async write(args: string[], opts?: RunOpts): Promise<string> {
		try {
			return await this.read(args, opts);
		} finally {
			this.invalidate();
		}
	}

	// --- reads ---

	/**
	 * All rows from `bd export`. Unlike `bd sql` — which rebuilds a throwaway database from
	 * the JSONL on every call — bd serves this from the live database it manages, so it is
	 * fast and full-fidelity: dependencies, labels and comments are inline.
	 */
	async export(): Promise<ExportIssue[]> {
		// Captured BEFORE the export: a write landing mid-export must make the new entry
		// stale, not tag stale rows as fresh.
		const gen = this.#gen;
		const mtimeMs = jsonlMtimeMs(this.cwd);
		const hit = this.#cache;
		if (hit && isFresh(hit, gen, mtimeMs, Date.now())) return hit.rows;

		const rows = parseExport(await this.read(['export'], { maxBuffer: 256 * 1024 * 1024 }));
		this.#cache = { gen, mtimeMs, at: Date.now(), rows };
		return rows;
	}

	/** Issue count without paying for the mapping — served from the export cache. */
	async count(): Promise<number> {
		return (await this.export()).filter((r) => r.status !== 'tombstone').length;
	}

	/**
	 * All issues, or — when `ids` is given — only those (accepting both the full id and the
	 * unprefixed short form, like `bd show`). The narrow form skips per-row mapping and the
	 * attachment scan for thousands of untouched rows, so a deep link doesn't pay for the
	 * whole board.
	 */
	async issues(ids?: string[], opts: GetIssuesOptions = {}): Promise<Issue[]> {
		const { slim = false, scope = 'all' } = opts;
		const allRows = (await this.export()).filter((r) => r.status !== 'tombstone');
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

		// Outgoing deps (this issue depends on X) and their reverse (dependents), keeping
		// only edges whose other endpoint still exists.
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
				? new Map(rows.map((r) => [r.id, getAttachmentsForIssue(r.id, this.cwd)]))
				: getAllAttachments(this.cwd);

		return rows
			.sort((a, b) => b.priority - a.priority || cmp(b.created_at, a.created_at))
			.map((r) => mapExportIssue(r, seqMap, depsMap, dependentsMap, attachmentsMap, slim));
	}

	async issue(id: string): Promise<Issue | null> {
		const sid = safeId(id);
		return (await this.issues([sid])).find((issue) => issue.id === sid) ?? null;
	}

	/** Comments are inline in `bd export`; reuse the fast issue read (sorted created_at ASC). */
	async comments(id: string): Promise<Comment[]> {
		return (await this.issue(id))?.comments ?? [];
	}

	/**
	 * Recent mutation events. `unsupported` marks embedded-mode projects: bd 1.1 has no
	 * `bd sql` there, so they have no queryable event feed.
	 */
	async recentEvents(limit = 100): Promise<{ events: MutationEntry[]; unsupported: boolean }> {
		const query = `
			SELECT id, issue_id, event_type, actor, old_value, new_value, comment, created_at
			FROM events ORDER BY created_at DESC LIMIT ${Math.floor(limit)}
		`;
		let rows: DbEvent[];
		try {
			rows = unwrapBdJson<DbEvent[]>(await this.read(['sql', '--json', query]));
		} catch (err) {
			if (String(err).includes('not yet supported in embedded mode')) return { events: [], unsupported: true };
			throw err;
		}
		return { events: rows.flatMap(parseEvent), unsupported: false };
	}

	/** Parsed JSON from a read-only `bd … --json` command (lint, history, children, …). */
	async readJson<T>(args: string[]): Promise<T> {
		return unwrapBdJson<T>(await this.read(args));
	}

	// --- writes ---

	async create(title: string, opts?: CreateOpts): Promise<{ id?: string; issue: unknown }> {
		const stdout = await this.write(createArgs(title, opts));
		const parsed = unwrapBdJson<{ id?: string }>(stdout);
		return { id: parsed.id, issue: parsed };
	}

	async update(id: string, updates: UpdateOpts): Promise<void> {
		const args = updateArgs(id, updates);
		if (args) await this.write(args);
	}

	async delete(id: string): Promise<void> {
		await this.write(['delete', id]);
	}

	async close(id: string, reason = 'Completed'): Promise<void> {
		await this.write(['close', id, '--reason', reason]);
	}

	async addDep(id: string, dependsOn: string, depType = 'blocks'): Promise<void> {
		await this.write(['dep', 'add', id, dependsOn, '--type', depType]);
	}

	async removeDep(id: string, dependsOn: string): Promise<void> {
		await this.write(['dep', 'remove', id, dependsOn]);
	}

	async addComment(id: string, text: string): Promise<void> {
		await this.write(['comments', 'add', id, text]);
	}

	/** Set an operational-state dimension. Creates an event bead + updates the
	 *  `<dimension>:<value>` label atomically. */
	async setState(id: string, dimension: string, value: string, reason?: string): Promise<void> {
		const args = ['set-state', id, `${dimension}=${value}`];
		if (reason) args.push('--reason', reason);
		await this.write(args);
	}

	/** Promote a wisp (ephemeral issue) to a permanent bead. ID is preserved. */
	async promote(id: string, reason?: string): Promise<void> {
		const args = ['promote', id];
		if (reason) args.push('--reason', reason);
		await this.write(args);
	}

	// --- health probes (report failure as data, not as a throw) ---

	async ping(): Promise<BdPing> {
		try {
			const parsed = await this.readJson<{ status?: string; total_ms?: number; error?: string }>(['ping', '--json']);
			return { ok: parsed.status === 'ok', status: parsed.status, total_ms: parsed.total_ms, error: parsed.error };
		} catch (err) {
			return { ok: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async doctor(): Promise<BdDoctorReport> {
		try {
			const stdout = await this.write(['doctor', '--fix', '--json']);
			// bd 1.1 prints human-readable fix progress before the JSON payload — slice to the first JSON line
			const jsonStart = stdout.search(/^\{/m);
			const parsed = unwrapBdJson<{ checks?: { name?: string; status?: string; message?: string }[] }>(
				jsonStart >= 0 ? stdout.slice(jsonStart) : stdout
			);
			const findings = (parsed?.checks ?? [])
				.filter((c) => c.status === 'warning' || c.status === 'error')
				.map((c) => ({ severity: c.status, message: c.name ? `${c.name}: ${c.message ?? ''}` : c.message }));
			return { ok: true, findings };
		} catch (err) {
			return { ok: false, findings: [], error: err instanceof Error ? err.message : String(err) };
		}
	}

	/**
	 * bd 1.0.5+ made JSONL auto-export opt-in (Dolt is the canonical store). The app
	 * depends on a fresh .beads/issues.jsonl for project stats, board diffs, and change
	 * detection, so opt back in when a project has it disabled.
	 */
	async ensureAutoExport(): Promise<void> {
		if ((await this.read(['config', 'get', 'export.auto'])) === 'true') return;
		await this.read(['config', 'set', 'export.auto', 'true']);
	}
}

/**
 * Memoized per-cwd client. Each instance owns its export cache, so cycling projects never
 * evicts the one you are looking at (the old shared FIFO cache did, at four projects).
 *
 * ponytail: unbounded map. Bounded in practice by the registered-project allowlist that
 * gates every cwd reaching here; add eviction if someone registers hundreds of projects.
 */
const registry = new Map<string, Beads>();

export function beads(cwd: string): Beads {
	let instance = registry.get(cwd);
	if (!instance) {
		instance = new Beads(cwd);
		registry.set(cwd, instance);
	}
	return instance;
}
