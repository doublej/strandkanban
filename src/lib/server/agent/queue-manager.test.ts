import { test, expect } from "bun:test";
import { AgentQueue } from "./queue-manager";
import type { QueueItem } from "./queue-types";
import type { AgentSession } from "./session-types";
import { beads } from "../beads/client";

const CWD = "/tmp/strandkanban-queue-test";

/** Stub the two bd reads pump() makes, so the scheduler is tested without spawning bd.
 *  `beads()` memoizes per cwd, so the queue resolves this same patched instance. */
function stubBeads(blocked: string[] = []) {
	const client = beads(CWD) as unknown as {
		blockedIds: () => Promise<Set<string>>;
		comments: () => Promise<unknown[]>;
	};
	client.blockedIds = async () => new Set(blocked);
	client.comments = async () => [];
}

function item(ticketId: string, useWorktree: boolean): QueueItem {
	return {
		ticketId,
		agentName: `${ticketId}-agent`,
		cwd: CWD,
		title: ticketId,
		description: "",
		priority: 2,
		issueType: "task",
		useWorktree,
		enqueuedAt: "2026-08-12T00:00:00.000Z",
	};
}

function runningWorker(cwd: string): AgentSession {
	return { isRunning: true, isManager: false, cwd } as unknown as AgentSession;
}

/** A queue whose dispatches are recorded instead of launching agents. */
function makeQueue(sessions: Map<string, AgentSession>) {
	const queue = new AgentQueue(sessions);
	const dispatched: string[] = [];
	queue.setDispatchFn((i) => {
		dispatched.push(i.ticketId);
		// A real dispatch leaves a running worker behind; mirror that so the cap and the
		// per-cwd rule see the same world they would in production.
		sessions.set(i.ticketId, runningWorker(i.cwd));
	});
	return { queue, dispatched };
}

test("a worktree item behind a cwd-blocked head still dispatches", async () => {
	stubBeads();
	const sessions = new Map<string, AgentSession>([["busy", runningWorker(CWD)]]);
	const { queue, dispatched } = makeQueue(sessions);

	queue.enqueue(item("head", false)); // wants the occupied main cwd
	queue.enqueue(item("wt", true)); // isolated, nothing to wait for
	await queue.maybeStartNext();

	expect(dispatched).toEqual(["wt"]);
	expect(queue.getItems().map((i) => i.ticketId)).toEqual(["head"]);
});

test("blocked tickets are skipped, not dispatched", async () => {
	stubBeads(["blocked-one"]);
	const { queue, dispatched } = makeQueue(new Map());

	queue.enqueue(item("blocked-one", true));
	queue.enqueue(item("free", true));
	await queue.maybeStartNext();

	expect(dispatched).toEqual(["free"]);
});

test("the concurrency cap bounds simultaneous workers", async () => {
	stubBeads();
	const { queue, dispatched } = makeQueue(new Map());
	queue.setMaxConcurrent(2);

	for (const id of ["a", "b", "c", "d"]) queue.enqueue(item(id, true));
	await queue.maybeStartNext();

	expect(dispatched).toEqual(["a", "b"]);
	expect(queue.getItems()).toHaveLength(2);
});

test("a raised cap releases work already queued", async () => {
	stubBeads();
	const { queue, dispatched } = makeQueue(new Map());
	queue.setMaxConcurrent(1);

	for (const id of ["a", "b"]) queue.enqueue(item(id, true));
	await queue.maybeStartNext();
	expect(dispatched).toEqual(["a"]);

	queue.setMaxConcurrent(3);
	await queue.maybeStartNext();
	expect(dispatched).toEqual(["a", "b"]);
});
