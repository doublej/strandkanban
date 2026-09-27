import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { promisify } from 'node:util';
import { bdEnv } from 'beads-sdk';
import { log } from '$lib/server/logger';
import type { MutationEntry } from '$lib/types';
import { parseJournalRecord, type JournalRecord } from '$lib/event-parse';

const execFileAsync = promisify(execFile);
const RING_SIZE = 500;
const RESTART_MS = 3000;

/**
 * True when the workspace opted into bd's events journal (`bd config set events-journal true`,
 * which writes .beads/config.yaml, or BD_EVENTS_JOURNAL=1). Read per call so toggling it
 * takes effect without a restart. A disabled journal tails as empty, so this is the only
 * way to tell "off" from "quiet".
 */
export function journalEnabled(cwd: string): boolean {
	if (process.env.BD_EVENTS_JOURNAL === '1') return true;
	try {
		return /^events-journal:\s*true\b/m.test(readFileSync(join(cwd, '.beads', 'config.yaml'), 'utf8'));
	} catch {
		return false;
	}
}

/** `events_journal_truncated` carries the oldest retained seq; resume just below it (a known gap). */
function truncatedFloor(output: string): number | null {
	const match = output.match(/events_journal_truncated[\s\S]*?"floor":\s*(\d+)/);
	return match ? Number(match[1]) : null;
}

type Listener = (rec: JournalRecord) => void;

/**
 * Per-project view of `bd events tail`: the last RING_SIZE activity entries plus live records.
 * One `--follow` child per project, shared by every open board and stopped when the last leaves.
 * ponytail: seeding replays the whole retained journal (7 days / 100k rows by default) once per
 * server run; switch to `bd serve` paging when that gets slow.
 */
class JournalFeed {
	private seq = 0;
	private ring: MutationEntry[] = [];
	private states = new Map<string, Record<string, unknown>>();
	private listeners = new Set<Listener>();
	private child: ChildProcess | null = null;
	private catchingUp: Promise<void> | null = null;
	private restartTimer: ReturnType<typeof setTimeout> | null = null;

	constructor(private readonly cwd: string) {}

	private apply(line: string): void {
		if (!line.startsWith('{')) return;
		const rec = JSON.parse(line) as JournalRecord;
		// Catch-up and follow can overlap; seq is gapless and ordered, so this makes replay idempotent.
		if (rec.seq <= this.seq) return;
		this.seq = rec.seq;
		const entries = parseJournalRecord(rec, this.states.get(rec.issue_id));
		if (rec.issue) this.states.set(rec.issue_id, rec.issue);
		else this.states.delete(rec.issue_id);
		if (entries.length) this.ring = [...entries.reverse(), ...this.ring].slice(0, RING_SIZE);
		for (const listener of this.listeners) listener(rec);
	}

	/** One-shot read of everything after the last seen seq. */
	private catchUp(): Promise<void> {
		this.catchingUp ??= this.readSince().finally(() => (this.catchingUp = null));
		return this.catchingUp;
	}

	private async readSince(): Promise<void> {
		const args = ['events', 'tail', '--since', String(this.seq), '--json'];
		const opts = { cwd: this.cwd, env: bdEnv(), maxBuffer: 256 * 1024 * 1024 };
		try {
			const { stdout } = await execFileAsync('bd', args, opts);
			for (const line of stdout.split('\n')) this.apply(line);
		} catch (err) {
			const { stdout = '', stderr = '' } = err as { stdout?: string; stderr?: string };
			const floor = truncatedFloor(stdout + stderr);
			if (floor === null) throw err;
			this.seq = floor - 1;
			await this.readSince();
		}
	}

	private startFollow(): void {
		if (this.child || this.listeners.size === 0) return;
		const child = spawn('bd', ['events', 'tail', '--since', String(this.seq), '--follow', '--json'], {
			cwd: this.cwd,
			env: bdEnv(),
			stdio: ['ignore', 'pipe', 'pipe'],
		});
		this.child = child;
		createInterface({ input: child.stdout! }).on('line', (line) => this.apply(line));
		child.on('exit', () => {
			if (this.child !== child) return;
			this.child = null;
			// Died under live boards (e.g. truncated checkpoint): catch up, then follow again.
			if (this.listeners.size > 0) {
				this.restartTimer = setTimeout(() => {
					this.catchUp()
						.catch((err) => log.error('[journal] catch-up failed', this.cwd, err))
						.finally(() => this.startFollow());
				}, RESTART_MS);
			}
		});
	}

	/** Live records only: the listener joins after catch-up, so history never replays into it. */
	subscribe(listener: Listener): () => void {
		let active = true;
		this.catchUp()
			.catch((err) => log.error('[journal] catch-up failed', this.cwd, err))
			.finally(() => {
				if (!active) return;
				this.listeners.add(listener);
				this.startFollow();
			});
		return () => {
			active = false;
			this.listeners.delete(listener);
			if (this.listeners.size > 0) return;
			if (this.restartTimer) clearTimeout(this.restartTimer);
			const child = this.child;
			this.child = null;
			child?.kill();
		};
	}

	/** Newest first. A live follower keeps the ring current; otherwise read what was missed. */
	async recent(limit: number): Promise<MutationEntry[]> {
		if (!this.child) await this.catchUp();
		return this.ring.slice(0, limit);
	}
}

const registry = new Map<string, JournalFeed>();

export function journal(cwd: string): JournalFeed {
	let feed = registry.get(cwd);
	if (!feed) {
		feed = new JournalFeed(cwd);
		registry.set(cwd, feed);
	}
	return feed;
}
