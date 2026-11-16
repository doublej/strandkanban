/**
 * MCP tools for the manager agent.
 * Direct access to board state, queue, and agent sessions.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { join } from "path";
import { beads, unwrapEnvelopeText } from "../beads/client";
import type { AgentSession } from "./session-types";
import type { AgentQueue } from "./queue-manager";

export function createManagerToolsServer(
	cwd: string,
	sessions: Map<string, AgentSession>,
	queue: AgentQueue,
) {
	return createSdkMcpServer({
		name: "beads-manager",
		version: "1.0.0",
		tools: [
			// --- Board tools ---
			tool(
				"list_issues",
				"List all issues with status, priority, assignee, and dependencies. Summary fields only — use get_issue for the full body of one issue.",
				{},
				async () => {
					try {
						// --brief drops description/design/acceptance/notes/payload. The manager
						// reads the whole board to decide what to dispatch; carrying every body
						// through that call is most of the payload and none of the decision.
						const result = unwrapEnvelopeText(await beads(cwd).read(["list", "--json", "--brief"]));
						return { content: [{ type: "text" as const, text: result || "No issues found" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"ready",
				"List work that is ready to start right now — open issues with no unresolved blockers. Prefer this over list_issues when deciding what to dispatch.",
				{},
				async () => {
					try {
						const result = unwrapEnvelopeText(await beads(cwd).read(["ready", "--json", "--brief"]));
						return { content: [{ type: "text" as const, text: result === "[]" ? "No ready work" : result }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"create_issue",
				"Create a new issue on the board.",
				{
					title: z.string().describe("Issue title"),
					description: z.string().optional().describe("Issue description"),
					priority: z.number().optional().describe("Priority (0 highest, 4 lowest)"),
					issue_type: z.string().optional().describe("Issue type, e.g. task, bug, feature, epic"),
					labels: z.array(z.string()).optional().describe("Labels to attach"),
				},
				async ({ title, description, priority, issue_type, labels }) => {
					try {
						const { id } = await beads(cwd).create(title, { description, priority, issue_type, labels });
						return { content: [{ type: "text" as const, text: `Created ${id ?? "issue"}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"update_issue",
				"Update an issue's status, priority, assignee, or title.",
				{
					id: z.string().describe("Issue ID"),
					status: z.string().optional().describe("New status: open, in_progress, blocked, closed"),
					priority: z.number().optional().describe("Priority (0 highest, 4 lowest)"),
					assignee: z.string().optional().describe("Assignee"),
					title: z.string().optional().describe("New title"),
				},
				async ({ id, status, priority, assignee, title }) => {
					try {
						await beads(cwd).update(id, { status, priority, assignee, title });
						return { content: [{ type: "text" as const, text: `Updated ${id}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"search_issues",
				"Search issues by text across title and ID, including closed ones.",
				{ query: z.string().describe("Search text") },
				async ({ query }) => {
					try {
						const result = unwrapEnvelopeText(await beads(cwd).read(["search", query, "--json"]));
						return { content: [{ type: "text" as const, text: result === "[]" ? "No matches" : result }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"board_stats",
				"Board-level counts: open, in progress, blocked, ready, closed, and epic closure eligibility.",
				{},
				async () => {
					try {
						const result = unwrapEnvelopeText(await beads(cwd).read(["stats", "--json"]));
						return { content: [{ type: "text" as const, text: result }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"epic_status",
				"Show epic completion status across the board.",
				{},
				async () => {
					try {
						return { content: [{ type: "text" as const, text: await beads(cwd).read(["epic", "status"]) || "No epics" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"dep_tree",
				"Show the dependency tree rooted at an issue — what it is waiting on, and how deep.",
				{ id: z.string().describe("Issue ID") },
				async ({ id }) => {
					try {
						return { content: [{ type: "text" as const, text: await beads(cwd).read(["dep", "tree", id]) }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"list_worktrees",
				"List git worktrees for this project — which isolated checkouts exist for parallel workers.",
				{},
				async () => {
					try {
						return { content: [{ type: "text" as const, text: await beads(cwd).read(["worktree", "list"]) || "No worktrees" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"get_issue",
				"Get detailed information about a single issue.",
				{ id: z.string().describe("Issue ID") },
				async ({ id }) => {
					try {
						const issue = await beads(cwd).issue(id);
						return { content: [{ type: "text" as const, text: issue ? JSON.stringify(issue) : "Issue not found" }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"close_issue",
				"Close an issue with a reason. bd refuses to close an issue another actor (e.g. a worker) has claimed, or one with open blockers or children.",
				{
					id: z.string().describe("Issue ID"),
					reason: z.string().describe("Reason for closing"),
					force: z.boolean().optional().describe("Override bd's refusal. Only after confirming the claim holder is done and the blockers/children don't matter."),
				},
				async ({ id, reason, force }) => {
					try {
						await beads(cwd).close(id, reason, force);
						return { content: [{ type: "text" as const, text: `Closed ${id}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_comment",
				"Add a comment to an issue.",
				{
					id: z.string().describe("Issue ID"),
					text: z.string().describe("Comment text"),
				},
				async ({ id, text }) => {
					try {
						await beads(cwd).addComment(id, text);
						return { content: [{ type: "text" as const, text: `Comment added to ${id}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_dependency",
				"Add a dependency between issues.",
				{
					from: z.string().describe("Source issue ID"),
					to: z.string().describe("Target issue ID"),
					type: z.string().default("blocks").describe("Dependency type"),
				},
				async ({ from, to, type }) => {
					try {
						await beads(cwd).addDep(from, to, type);
						return { content: [{ type: "text" as const, text: `${from} now depends on ${to}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"remove_dependency",
				"Remove a dependency between issues.",
				{
					from: z.string().describe("Source issue ID"),
					to: z.string().describe("Target issue ID"),
				},
				async ({ from, to }) => {
					try {
						await beads(cwd).removeDep(from, to);
						return { content: [{ type: "text" as const, text: `${from} no longer depends on ${to}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"add_label",
				"Add a label to an issue.",
				{
					id: z.string().describe("Issue ID"),
					label: z.string().describe("Label to add"),
				},
				async ({ id, label }) => {
					try {
						await beads(cwd).update(id, { addLabels: [label] });
						return { content: [{ type: "text" as const, text: `Added label ${label} to ${id}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"remove_label",
				"Remove a label from an issue.",
				{
					id: z.string().describe("Issue ID"),
					label: z.string().describe("Label to remove"),
				},
				async ({ id, label }) => {
					try {
						await beads(cwd).update(id, { removeLabels: [label] });
						return { content: [{ type: "text" as const, text: `Removed label ${label} from ${id}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			// --- Queue tools ---
			tool(
				"enqueue_ticket",
				"Add a ticket to the agent queue for processing by a worker agent.",
				{
					ticket_id: z.string().describe("Issue ID to enqueue"),
					model: z.string().optional().describe("Model override for the worker"),
					use_worktree: z.boolean().optional().describe("Use a git worktree for isolation. Defaults to automatic: enabled when the repo cwd is already occupied by another worker."),
				},
				async ({ ticket_id, model, use_worktree }) => {
					try {
						// Fetch issue details
						const issue = await beads(cwd).issue(ticket_id);
						const agentName = `${ticket_id}-agent`;
						const resolvedUseWorktree = use_worktree ?? queue.hasRunningWorkerInCwd(cwd);

						queue.enqueue({
							ticketId: ticket_id,
							agentName,
							cwd,
							title: issue?.title || ticket_id,
							description: issue?.description || "",
							priority: issue?.priority ?? 2,
							issueType: issue?.issue_type || "task",
							model,
							useWorktree: resolvedUseWorktree,
							enqueuedAt: new Date().toISOString(),
						});

						const mode = resolvedUseWorktree ? "using a worktree" : "in the main repo";
						const remaining = queue.getItems().length;
						const suffix = remaining > 0
							? `(position ${remaining})`
							: "(dispatching now)";
						return { content: [{ type: "text" as const, text: `Enqueued ${ticket_id} ${mode} ${suffix}` }] };
					} catch (err) {
						return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
					}
				}
			),

			tool(
				"cancel_queued",
				"Remove a ticket from the queue.",
				{ ticket_id: z.string().describe("Ticket ID to remove") },
				async ({ ticket_id }) => {
					const removed = queue.cancel(ticket_id);
					return { content: [{ type: "text" as const, text: removed ? `Removed ${ticket_id} from queue` : `${ticket_id} not found in queue` }] };
				}
			),

			tool(
				"reorder_queue",
				"Move a queued ticket to a new position.",
				{
					ticket_id: z.string().describe("Ticket ID to move"),
					position: z.number().describe("Target position (0-based)"),
				},
				async ({ ticket_id, position }) => {
					const items = queue.getItems();
					const fromIndex = items.findIndex(i => i.ticketId === ticket_id);
					if (fromIndex === -1) {
						return { content: [{ type: "text" as const, text: `${ticket_id} not found in queue` }], isError: true };
					}
					queue.reorder(fromIndex, position);
					return { content: [{ type: "text" as const, text: `Moved ${ticket_id} to position ${position}` }] };
				}
			),

			tool(
				"list_queue",
				"List all items currently in the agent queue.",
				{},
				async () => {
					const items = queue.getItems();
					if (items.length === 0) {
						return { content: [{ type: "text" as const, text: "Queue is empty" }] };
					}
					const lines = items.map((item, i) =>
						`${i + 1}. ${item.ticketId} — ${item.title} (priority: ${item.priority}, type: ${item.issueType})`
					);
					return { content: [{ type: "text" as const, text: lines.join("\n") }] };
				}
			),

			// --- Agent tools ---
			tool(
				"list_running_agents",
				"List all currently active agent sessions.",
				{},
				async () => {
					const agents: string[] = [];
					for (const [, session] of sessions) {
						if (session.isRunning && session.agentName) {
							agents.push(`${session.agentName} — cwd: ${session.cwd}, running: ${session.isRunning}`);
						}
					}
					return { content: [{ type: "text" as const, text: agents.length > 0 ? agents.join("\n") : "No running agents" }] };
				}
			),

			tool(
				"stop_agent",
				"Stop a running agent session.",
				{ name_or_ticket_id: z.string().describe("Agent name or ticket ID") },
				async ({ name_or_ticket_id }) => {
					for (const [id, session] of sessions) {
						const matches = session.agentName === name_or_ticket_id
							|| session.agentName === `${name_or_ticket_id}-agent`;
						if (matches) {
							session.abortController.abort();
							sessions.delete(id);
							return { content: [{ type: "text" as const, text: `Stopped agent ${session.agentName}` }] };
						}
					}
					return { content: [{ type: "text" as const, text: `Agent ${name_or_ticket_id} not found` }], isError: true };
				}
			),

			// --- Dispatch tool ---
			tool(
				"dispatch_queue",
				"Start processing the queue. Dispatches the next queued ticket to a worker agent if a CWD slot is free.",
				{},
				async () => {
					await queue.maybeStartNext();
					const items = queue.getItems();
					return { content: [{ type: "text" as const, text: items.length > 0
						? `Queue has ${items.length} remaining items. Dispatching if slot available.`
						: "Queue is empty — nothing to dispatch." }] };
				}
			),

			// --- Memory tools ---
			tool(
				"read_memory",
				"Read the manager's long-term memory file (CLAUDE-MANAGER.md).",
				{},
				async () => {
					const memPath = join(cwd, "CLAUDE-MANAGER.md");
					try {
						const content = await Bun.file(memPath).text();
						return { content: [{ type: "text" as const, text: content || "(empty)" }] };
					} catch {
						return { content: [{ type: "text" as const, text: "(no memory file yet)" }] };
					}
				}
			),

			tool(
				"write_memory",
				"Write to the manager's long-term memory file (CLAUDE-MANAGER.md). Overwrites the entire file.",
				{ content: z.string().describe("Full content to write") },
				async ({ content }) => {
					const memPath = join(cwd, "CLAUDE-MANAGER.md");
					await Bun.write(memPath, content);
					return { content: [{ type: "text" as const, text: "Memory updated." }] };
				}
			),
		],
	});
}
