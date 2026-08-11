/**
 * Custom beads tools that auto-inject agent name as assignee.
 * These wrap the bd CLI and enforce agent identification.
 */
import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { beads } from "../beads/client";

// Beads MCP tools to block (we replace these with our wrappers)
export const BLOCKED_BEADS_TOOLS = [
  "mcp__beads__update",
  "mcp__beads__create",
];

export function createBeadsToolsServer(agentName: string, cwd: string) {
  return createSdkMcpServer({
    name: "beads-agent",
    version: "1.0.0",
    tools: [
      tool(
        "update_issue",
        "Update a beads issue. Automatically sets assignee to this agent when claiming work (status=in_progress), unless explicitly overridden.",
        {
          issue_id: z.string().describe("Issue ID (e.g., bd-1)"),
          status: z.enum(["open", "in_progress", "hooked", "blocked", "closed"]).optional(),
          priority: z.number().min(0).max(4).optional(),
          title: z.string().optional(),
          description: z.string().optional(),
          design: z.string().optional(),
          acceptance_criteria: z.string().optional(),
          notes: z.string().optional(),
          external_ref: z.string().optional(),
          assignee: z.string().optional().describe("Override assignee (defaults to agent name when claiming work)"),
        },
        async ({ issue_id, ...fields }) => {
          try {
            await beads(cwd).update(issue_id, {
              ...fields,
              // Explicit assignee wins; otherwise auto-inject when claiming work.
              assignee: fields.assignee ?? (fields.status === "in_progress" ? agentName : undefined),
            });
            return { content: [{ type: "text" as const, text: `Updated ${issue_id}` }] };
          } catch (err) {
            return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
          }
        }
      ),

      tool(
        "create_issue",
        "Create a new beads issue. Automatically sets assignee to this agent, unless explicitly overridden.",
        {
          title: z.string().describe("Issue title"),
          description: z.string().default(""),
          design: z.string().optional(),
          acceptance: z.string().optional(),
          external_ref: z.string().optional(),
          priority: z.number().min(0).max(4).default(2),
          issue_type: z.enum(["bug", "feature", "task", "epic", "chore"]).default("task"),
          labels: z.array(z.string()).optional(),
          id: z.string().optional().describe("Explicit issue ID"),
          deps: z.array(z.string()).optional().describe("Dependencies"),
          assignee: z.string().optional().describe("Override assignee (defaults to agent name)"),
        },
        async ({ title, ...fields }) => {
          try {
            const { issue } = await beads(cwd).create(title, {
              ...fields,
              // Explicit assignee wins; otherwise the issue belongs to this agent.
              assignee: fields.assignee || agentName,
            });
            return { content: [{ type: "text" as const, text: JSON.stringify(issue) }] };
          } catch (err) {
            return { content: [{ type: "text" as const, text: `Error: ${err}` }], isError: true };
          }
        }
      ),
    ],
  });
}
