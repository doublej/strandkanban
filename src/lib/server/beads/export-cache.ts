/**
 * Freshness rules and parsing for the cached `bd export`. Pure except for the
 * JSONL stat — split out of client.ts so the cache logic is readable and
 * testable on its own.
 */
import { join } from 'path';
import { statSync } from 'fs';
import type { ExportIssue } from './map';

export const EXPORT_TTL_MS = 30_000;

export interface ExportEntry {
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
export function jsonlMtimeMs(cwd: string): number {
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
