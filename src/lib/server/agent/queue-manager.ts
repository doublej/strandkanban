import type { QueueItem } from "./queue-types";
import type { AgentSession } from "./session-types";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./http-server";
import { beads } from "../beads/client";
import { log } from "../logger";
import { getAttachmentsDir } from "../attachments";
import { existsSync, readdirSync } from "fs";

type DispatchFn = (item: QueueItem, briefing: string) => Promise<void> | void;

type ActiveSessionSummary = {
	sessionId: string;
	name: string;
	cwd: string;
	projectCwd: string;
	isManager: boolean;
	isRunning: boolean;
	ticketId?: string;
	worktreePath?: string;
};

/** Workers allowed to run at once across all cwds. Overridden per board via set_project. */
const DEFAULT_MAX_CONCURRENT = 3;

export class AgentQueue {
	private items: QueueItem[] = [];
	private sessions: Map<string, AgentSession>;
	private dispatchFn: DispatchFn | null = null;
	private clients: Map<ServerWebSocket<WSData>, string | null> = new Map();
	/** cwds with a non-worktree dispatch in flight (awaiting briefing/runAgent start). */
	private dispatchingCwds = new Set<string>();
	/** Dispatches in flight regardless of worktree — the global cap counts these too. */
	private dispatching = 0;
	private maxConcurrent = DEFAULT_MAX_CONCURRENT;
	/** The in-flight pump pass, shared so concurrent callers await the same run rather than
	 *  returning early. `pumpRequested` replays a pass for items that arrived mid-pass. */
	private pumpPromise: Promise<void> | null = null;
	private pumpRequested = false;

	constructor(sessions: Map<string, AgentSession>) {
		this.sessions = sessions;
	}

	setMaxConcurrent(n: number) {
		if (!Number.isFinite(n) || n < 1) return;
		const changed = this.maxConcurrent !== n;
		this.maxConcurrent = Math.floor(n);
		// Raising the cap can free a slot for work already sitting in the queue.
		if (changed) this.maybeStartNext();
	}

	setDispatchFn(fn: DispatchFn) {
		this.dispatchFn = fn;
	}

	addClient(ws: ServerWebSocket<WSData>) {
		this.clients.set(ws, null);
		// No initial state — wait for set_project to avoid leaking all items.
		try {
			ws.send(JSON.stringify({ type: "queue_state", items: [] }));
			ws.send(JSON.stringify({ type: "active_sessions", cwd: null, sessions: [] }));
		} catch {}
	}

	removeClient(ws: ServerWebSocket<WSData>) {
		this.clients.delete(ws);
	}

	setClientCwd(ws: ServerWebSocket<WSData>, cwd: string) {
		if (!this.clients.has(ws)) return;
		this.clients.set(ws, cwd);
		try {
			ws.send(JSON.stringify({
				type: "queue_state",
				items: this.items.filter(i => i.cwd === cwd),
			}));
			ws.send(JSON.stringify({
				type: "active_sessions",
				cwd,
				sessions: this.buildActiveSessions().filter(s => s.projectCwd === cwd),
			}));
		} catch {}
	}

	getItemsForCwd(cwd: string): QueueItem[] {
		return this.items.filter(i => i.cwd === cwd);
	}

	enqueue(item: QueueItem) {
		this.items.push(item);
		this.broadcastState();
		this.maybeStartNext();
	}

	cancel(ticketId: string): boolean {
		const before = this.items.length;
		this.items = this.items.filter(i => i.ticketId !== ticketId);
		if (this.items.length !== before) {
			this.broadcastState();
			return true;
		}
		return false;
	}

	reorder(fromIndex: number, toIndex: number) {
		if (fromIndex < 0 || fromIndex >= this.items.length) return;
		if (toIndex < 0 || toIndex >= this.items.length) return;
		if (fromIndex === toIndex) return;

		const [moved] = this.items.splice(fromIndex, 1);
		this.items.splice(toIndex, 0, moved);
		this.broadcastState();
		this.maybeStartNext();
	}

	getItems(): QueueItem[] {
		return [...this.items];
	}

	peek(): QueueItem | undefined {
		return this.items[0];
	}

	dequeueNext(): QueueItem | undefined {
		const item = this.items.shift();
		if (item) this.broadcastState();
		return item;
	}

	broadcastState() {
		for (const [ws, cwd] of this.clients) {
			if (!cwd) continue;
			try {
				ws.send(JSON.stringify({
					type: "queue_state",
					items: this.items.filter(i => i.cwd === cwd),
				}));
			} catch {}
		}
	}

	broadcastActiveSessions() {
		const all = this.buildActiveSessions();
		for (const [ws, cwd] of this.clients) {
			if (!cwd) continue;
			try {
				ws.send(JSON.stringify({
					type: "active_sessions",
					cwd,
					sessions: all.filter(s => s.projectCwd === cwd),
				}));
			} catch {}
		}
	}

	/**
	 * Dispatch every queued item that can start right now.
	 *
	 * Scans the whole queue rather than testing only the head: an item needing an occupied
	 * cwd used to stall everything behind it, including worktree items that had nothing to
	 * wait for. Serialized by `pumping` so two callers can't both pass the concurrency check.
	 */
	async maybeStartNext(): Promise<void> {
		if (!this.dispatchFn) return;
		if (this.pumpPromise) {
			// Replay a pass afterwards so an item enqueued as this pass exits isn't stranded,
			// and hand back the in-flight run so awaiting callers see the dispatch happen.
			this.pumpRequested = true;
			return this.pumpPromise;
		}
		this.pumpPromise = (async () => {
			try {
				do {
					this.pumpRequested = false;
					await this.pump();
				} while (this.pumpRequested);
			} finally {
				this.pumpPromise = null;
			}
		})();
		return this.pumpPromise;
	}

	private async pump(): Promise<void> {
		// One `bd blocked` read per cwd per pass, not per item.
		const blockedByCwd = new Map<string, Set<string>>();
		const blockedFor = async (cwd: string): Promise<Set<string>> => {
			let set = blockedByCwd.get(cwd);
			if (!set) {
				try {
					set = await beads(cwd).blockedIds();
				} catch (err) {
					// Dependency gating is an optimization, not a correctness barrier — the
					// worker still claims the ticket itself. Dispatch rather than wedge the queue.
					log.warn(`[queue] blocked read failed for ${cwd}, dispatching without the dependency gate: ${err}`);
					set = new Set();
				}
				blockedByCwd.set(cwd, set);
			}
			return set;
		};

		while (this.items.length > 0) {
			if (this.runningWorkerCount() + this.dispatching >= this.maxConcurrent) return;

			let index = -1;
			for (let i = 0; i < this.items.length; i++) {
				const item = this.items[i];
				// Non-worktree workers are serialized per cwd. Guard against BOTH a running
				// worker and an in-flight dispatch: buildBriefing/dispatchFn below await, and
				// session.isRunning isn't set until runAgent starts, so without dispatchingCwds
				// two concurrent callers could both pass this check and launch two workers
				// into the same working tree.
				if (!item.useWorktree && (this.hasRunningWorkerInCwd(item.cwd) || this.dispatchingCwds.has(item.cwd))) continue;
				if ((await blockedFor(item.cwd)).has(item.ticketId)) continue;
				index = i;
				break;
			}
			if (index === -1) return;

			const [next] = this.items.splice(index, 1);
			this.broadcastState();

			const trackCwd = !next.useWorktree;
			if (trackCwd) this.dispatchingCwds.add(next.cwd);
			this.dispatching++;
			try {
				const briefing = await this.buildBriefing(next);
				await this.dispatchFn!(next, briefing);
			} catch (err) {
				this.items.unshift(next);
				this.broadcastState();
				log.error(`[queue] Failed to dispatch ${next.ticketId}:`, err);
				return; // a dispatch that just failed will likely fail again — don't spin
			} finally {
				// Safe to release: by the time dispatchFn resolves, runAgent has run
				// synchronously up to its first await and set isRunning=true, so
				// hasRunningWorkerInCwd now covers this cwd.
				if (trackCwd) this.dispatchingCwds.delete(next.cwd);
				this.dispatching--;
			}
		}
	}

	/** Running workers across all cwds. The manager doesn't occupy a worker slot. */
	private runningWorkerCount(): number {
		let n = 0;
		for (const session of this.sessions.values()) {
			if (session.isRunning && !session.isManager) n++;
		}
		return n;
	}

	hasRunningWorkerInCwd(cwd: string): boolean {
		for (const session of this.sessions.values()) {
			if (!session.isRunning) continue;
			if (session.isManager) continue;
			if (session.cwd === cwd) return true;
		}
		return false;
	}

	getActiveSessions(): ActiveSessionSummary[] {
		return this.buildActiveSessions();
	}

	private buildActiveSessions(): ActiveSessionSummary[] {
		const sessions: ActiveSessionSummary[] = [];
		for (const session of this.sessions.values()) {
			if (!session.isRunning) continue;
			if (!session.agentName) continue;

			sessions.push({
				sessionId: session.id,
				name: session.agentName,
				cwd: session.cwd,
				projectCwd: session.projectCwd ?? session.cwd,
				isManager: !!session.isManager,
				isRunning: session.isRunning,
				ticketId: session.ticketId ?? (session.agentName.endsWith("-agent")
					? session.agentName.slice(0, -6)
					: undefined),
				worktreePath: session.worktreePath,
			});
		}
		return sessions;
	}

	private async buildBriefing(item: QueueItem): Promise<string> {
		let comments = "";
		let attachments = "";

		// Comments ride along in the export the facade already caches — no extra bd spawn.
		try {
			const list = await beads(item.cwd).comments(item.ticketId);
			comments = list.length ? JSON.stringify(list) : "None";
		} catch (err) {
			log.warn(`briefing: comments read failed for ${item.ticketId}: ${err}`);
			comments = "None";
		}

		// bd has no attachments command; the app stores them on disk.
		try {
			const dir = getAttachmentsDir(item.ticketId, item.cwd);
			const files = existsSync(dir) ? readdirSync(dir) : [];
			attachments = files.length ? files.join(", ") : "None";
		} catch (err) {
			log.warn(`briefing: attachments read failed for ${item.ticketId}: ${err}`);
			attachments = "None";
		}

		return `<assignment id="${item.ticketId}" name="${item.agentName}">
<context>You are assigned to ticket ${item.ticketId}.</context>
<task>
<title>${item.title}</title>
<description>${item.description}</description>
<comments>${comments}</comments>
<attachments>${attachments}</attachments>
</task>
<instructions>
Start by claiming the ticket (set status to in_progress), then implement the required changes.
</instructions>
</assignment>`;
	}
}
