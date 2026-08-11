/**
 * Stdio MCP server exposing the beads agent tools to any provider.
 *
 * Claude gets these in-process via beads-tools.ts. Providers that only speak
 * stdio MCP (codex, opencode) get the same two tools here, with identical names
 * and schemas, so a ticket behaves the same whichever provider runs it.
 *
 * Run directly: BD_CWD=<repo> BD_AGENT_NAME=<agent> bun run mcp-bridge.ts
 */
import { fileURLToPath } from "url";
import { beads } from "../beads/client";
import type { McpStdioSpec } from "./providers/types";

const TOOLS = [
  {
    name: "update_issue",
    description:
      "Update a beads issue. Automatically sets assignee to this agent when claiming work (status=in_progress), unless explicitly overridden.",
    inputSchema: {
      type: "object",
      properties: {
        issue_id: { type: "string", description: "Issue ID (e.g., bd-1)" },
        status: { type: "string", enum: ["open", "in_progress", "hooked", "blocked", "closed"] },
        priority: { type: "number", minimum: 0, maximum: 4 },
        title: { type: "string" },
        description: { type: "string" },
        design: { type: "string" },
        acceptance_criteria: { type: "string" },
        notes: { type: "string" },
        external_ref: { type: "string" },
        assignee: { type: "string", description: "Override assignee (defaults to agent name when claiming work)" },
      },
      required: ["issue_id"],
    },
  },
  {
    name: "create_issue",
    description: "Create a new beads issue. Automatically sets assignee to this agent, unless explicitly overridden.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Issue title" },
        description: { type: "string", default: "" },
        design: { type: "string" },
        acceptance: { type: "string" },
        external_ref: { type: "string" },
        priority: { type: "number", minimum: 0, maximum: 4, default: 2 },
        issue_type: { type: "string", enum: ["bug", "feature", "task", "epic", "chore"], default: "task" },
        labels: { type: "array", items: { type: "string" } },
        id: { type: "string", description: "Explicit issue ID" },
        deps: { type: "array", items: { type: "string" }, description: "Dependencies" },
        assignee: { type: "string", description: "Override assignee (defaults to agent name)" },
      },
      required: ["title"],
    },
  },
];

/** How a provider should spawn this bridge. */
export function beadsBridgeSpec(cwd: string, agentName: string): McpStdioSpec {
  return {
    name: "beads-agent",
    command: process.execPath,
    args: ["run", fileURLToPath(import.meta.url)],
    env: {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || "",
      BD_CWD: cwd,
      BD_AGENT_NAME: agentName,
    },
  };
}

async function callTool(name: string, args: Record<string, any>, cwd: string, agentName: string): Promise<string> {
  if (name === "update_issue") {
    const { issue_id, ...fields } = args;
    await beads(cwd).update(issue_id, {
      ...fields,
      // Explicit assignee wins; otherwise auto-inject when claiming work.
      assignee: fields.assignee ?? (fields.status === "in_progress" ? agentName : undefined),
    });
    return `Updated ${issue_id}`;
  }
  if (name === "create_issue") {
    const { title, ...fields } = args;
    // JSON Schema `default` is advisory, so apply the same defaults beads-tools.ts gets from zod.
    const { issue } = await beads(cwd).create(title, {
      description: "",
      priority: 2,
      issue_type: "task",
      ...fields,
      // Explicit assignee wins; otherwise the issue belongs to this agent.
      assignee: fields.assignee || agentName,
    });
    return JSON.stringify(issue);
  }
  throw new Error(`Unknown tool: ${name}`);
}

async function handle(msg: any, cwd: string, agentName: string): Promise<object | null> {
  switch (msg.method) {
    case "initialize":
      return {
        // Echo the client's version so we never fail negotiation over a bump we don't care about.
        protocolVersion: msg.params?.protocolVersion ?? "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "beads-agent", version: "1.0.0" },
      };
    case "tools/list":
      return { tools: TOOLS };
    case "tools/call":
      try {
        const text = await callTool(msg.params?.name, msg.params?.arguments ?? {}, cwd, agentName);
        return { content: [{ type: "text", text }] };
      } catch (err) {
        // A failing tool is a result for the model, not a crash for the server.
        return { content: [{ type: "text", text: `Error: ${err}` }], isError: true };
      }
    default:
      return null;
  }
}

async function main() {
  const cwd = process.env.BD_CWD;
  const agentName = process.env.BD_AGENT_NAME;
  if (!cwd || !agentName) {
    console.error("[mcp-bridge] BD_CWD and BD_AGENT_NAME are required");
    process.exit(1);
  }

  const write = (obj: object) => process.stdout.write(JSON.stringify(obj) + "\n");

  async function handleLine(line: string) {
    let msg: any;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    const result = await handle(msg, cwd!, agentName!);
    if (msg.id === undefined) return; // notification
    if (result) write({ jsonrpc: "2.0", id: msg.id, result });
    else write({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Method not found: ${msg.method}` } });
  }

  // Chained rather than concurrent: bd writes serialise anyway, and the client
  // gets responses in request order.
  let queue: Promise<void> = Promise.resolve();
  let buf = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk: string) => {
    buf += chunk;
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) queue = queue.then(() => handleLine(line));
    }
  });
}

if (import.meta.main) main();
