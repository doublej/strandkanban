// Claude adapter. Every line that touches @anthropic-ai/claude-agent-sdk lives
// here; the rest of the agent server only sees AgentProvider / AgentEvent.
import { query, type Options, type PermissionMode, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { createBeadsToolsServer } from "../beads-tools";
import { createManagerToolsServer } from "../manager-tools";
import { listSdkSessions, getSessionHistory } from "../sdk-sessions";
import type { AgentSession } from "../session-types";
import type { AgentQueue } from "../queue-manager";
import { log } from "../../logger";
import { EventChannel, InputChannel, type UserTurn } from "./channel";
import type {
  AgentEvent,
  AgentProvider,
  AgentRun,
  ChatMessage,
  ImageInput,
  SessionSummary,
  StartOptions,
  TokenTotals,
} from "./types";

type ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const PERMISSION_MODES = ["default", "acceptEdits", "bypassPermissions", "plan"];

/**
 * In-process MCP servers need live server objects (the session map, the queue),
 * so they are handed to the adapter at construction rather than smuggled
 * through StartOptions as an untyped union member.
 */
export type ClaudeContext = {
  sessions?: Map<string, AgentSession>;
  queue?: AgentQueue;
};

export function createClaudeProvider(ctx: ClaudeContext = {}): AgentProvider {
  return {
    id: "claude",
    permissionModes: PERMISSION_MODES,
    costUsd: true,
    async ensureReady() {},
    async shutdown() {},
    async listSessions(cwd: string): Promise<SessionSummary[]> {
      return listSdkSessions(cwd);
    },
    async readHistory(cwd: string, sessionId: string): Promise<ChatMessage[]> {
      return getSessionHistory(cwd, sessionId);
    },
    async start(opts: StartOptions): Promise<AgentRun> {
      return startRun(ctx, opts);
    },
  };
}

function startRun(ctx: ClaudeContext, opts: StartOptions): AgentRun {
  const events = new EventChannel<AgentEvent>();
  const input = new InputChannel();
  const abortController = opts.abortController ?? new AbortController();
  const runId = opts.runId ?? crypto.randomUUID();
  const usage: TokenTotals = {
    inputTokens: opts.initialUsage?.inputTokens ?? 0,
    outputTokens: opts.initialUsage?.outputTokens ?? 0,
    cacheRead: opts.initialUsage?.cacheRead ?? 0,
    cacheCreation: opts.initialUsage?.cacheCreation ?? 0,
  };

  input.push(opts.prompt);

  const options: Options = {
    cwd: opts.cwd,
    abortController,
    ...(opts.model && { model: opts.model }),
    permissionMode: (opts.permissionMode ?? "bypassPermissions") as PermissionMode,
    allowDangerouslySkipPermissions: true,
    includePartialMessages: true,
    settingSources: ["user", "project"],
    allowedTools: opts.allowedTools ? [...new Set([...opts.allowedTools, "Skill"])] : undefined,
    disallowedTools: opts.disallowedTools,
    ...(opts.resumeSessionId && { resume: opts.resumeSessionId }),
    mcpServers: buildMcpServers(ctx, opts),
    hooks: buildHooks(events, opts),
  };

  if (opts.systemPromptAppend) {
    options.systemPrompt = { type: "preset", preset: "claude_code", append: opts.systemPromptAppend };
  }

  const agentQuery = query({ prompt: toSdkMessages(input, runId), options });

  void pump(agentQuery, events, usage, opts);

  return {
    events,
    send: (text: string, images?: ImageInput[]) => input.push(text, images),
    async interrupt() {
      // A graceful SDK interrupt stops the turn but keeps the session resumable.
      try {
        await agentQuery.interrupt();
      } catch (err) {
        log.warn("[agent] graceful interrupt failed, aborting:", err);
        abortController.abort();
      }
    },
    async setModel(model?: string) {
      await agentQuery.setModel(model);
    },
    async setPermissionMode(mode: string) {
      await agentQuery.setPermissionMode(mode as PermissionMode);
    },
    async close() {
      abortController.abort();
      events.end();
    },
  };
}

async function* toSdkMessages(input: AsyncIterable<UserTurn>, runId: string): AsyncIterable<SDKUserMessage> {
  for await (const turn of input) {
    // Build content array: images first (if any), then text
    const hasImages = turn.images && turn.images.length > 0;
    if (hasImages) {
      const content: Array<
        | { type: "image"; source: { type: "base64"; media_type: ImageMediaType; data: string } }
        | { type: "text"; text: string }
      > = [];
      for (const img of turn.images!) {
        content.push({
          type: "image",
          source: {
            type: "base64",
            // Browser file.type is any string; the API rejects what it doesn't support, as before.
            media_type: img.mediaType as ImageMediaType,
            data: img.data,
          },
        });
      }
      if (turn.text) {
        content.push({ type: "text", text: turn.text });
      }
      yield { type: "user", session_id: runId, parent_tool_use_id: null, message: { role: "user", content } };
    } else {
      yield { type: "user", session_id: runId, parent_tool_use_id: null, message: { role: "user", content: turn.text } };
    }
  }
}

function buildMcpServers(ctx: ClaudeContext, opts: StartOptions): Options["mcpServers"] {
  const servers: Record<string, unknown> = {};
  for (const spec of opts.mcp ?? []) {
    servers[spec.name] = { command: spec.command, args: spec.args, ...(spec.env && { env: spec.env }) };
  }
  if (opts.isManager && ctx.sessions && ctx.queue) {
    servers["beads-manager"] = createManagerToolsServer(opts.cwd, ctx.sessions, ctx.queue);
  }
  if (!opts.isManager && opts.agentName) {
    servers["beads-agent"] = createBeadsToolsServer(opts.agentName, opts.cwd);
  }
  return servers as Options["mcpServers"];
}

function buildHooks(events: EventChannel<AgentEvent>, opts: StartOptions): Options["hooks"] {
  const notice = (subtype: "subagent_start" | "subagent_end" | "tool_failure" | "notification", content: string, agentName?: string) => {
    events.push({ type: "notice", subtype, content, agentName });
  };
  return {
    PreToolUse: [{
      hooks: [async (input) => {
        const hook = input as any;
        await opts.onToolStart?.(hook.tool_name, (hook.tool_input ?? {}) as Record<string, unknown>);
        return { continue: true };
      }],
    }],
    SubagentStart: [{
      hooks: [async (input) => {
        const agentType = (input as any).agent_type || "subagent";
        notice("subagent_start", `Starting subagent: ${agentType}`, agentType);
        return { continue: true };
      }],
    }],
    SubagentStop: [{
      hooks: [async (input) => {
        const agentId = (input as any).agent_id || "subagent";
        notice("subagent_end", `Subagent completed: ${agentId}`, agentId);
        return { continue: true };
      }],
    }],
    PostToolUseFailure: [{
      hooks: [async (input) => {
        const hook = input as any;
        // Interrupts aren't real failures — the user stopped the tool.
        if (!hook.is_interrupt) {
          notice("tool_failure", `${hook.tool_name} failed: ${String(hook.error ?? "").slice(0, 300)}`);
        }
        return { continue: true };
      }],
    }],
    Notification: [{
      hooks: [async (input) => {
        const hook = input as any;
        const text = hook.title ? `${hook.title}: ${hook.message}` : hook.message;
        if (text) notice("notification", String(text).slice(0, 300));
        return { continue: true };
      }],
    }],
  };
}

async function pump(
  agentQuery: ReturnType<typeof query>,
  events: EventChannel<AgentEvent>,
  usage: TokenTotals,
  opts: StartOptions
) {
  try {
    for await (const message of agentQuery) {
      if (message.type === "system" && message.subtype === "init") {
        const init = message as any;

        // Get rich slash command info from the SDK
        const slashCommands = await agentQuery.supportedCommands();
        log.info("[agent] supportedCommands:", slashCommands);
        events.push({
          type: "session",
          sdkSessionId: message.session_id,
          source: opts.resumeSessionId ? "resume" : "new",
          slashCommands: slashCommands.map((cmd) => ({
            name: cmd.name,
            description: cmd.description,
            argumentHint: cmd.argumentHint,
          })),
        });

        // Surface SDK-reported capabilities: available models, MCP server health,
        // current model/permission mode. The init message already carries most of
        // this; supportedModels() fills the model picker.
        let models: { value: string; displayName: string; description: string }[] = [];
        try {
          models = await agentQuery.supportedModels();
        } catch (err) {
          log.warn("[agent] supportedModels failed:", err);
        }
        events.push({
          type: "capabilities",
          models,
          mcpServers: init.mcp_servers ?? [],
          currentModel: init.model,
          permissionMode: init.permissionMode,
          tools: init.tools ?? [],
          plugins: init.plugins ?? [],
        });

        if (usage.inputTokens > 0 || usage.outputTokens > 0) events.push({ type: "usage", ...usage });
        continue;
      }

      if (message.type === "system") {
        // compact_boundary used to travel as its own `compacted` message; the
        // compact_done notice now carries that meaning too.
        if (message.subtype === "compact_boundary") {
          events.push({ type: "notice", subtype: "compact_done", content: "Context compacted successfully" });
        } else if (message.subtype === "status" && (message as any).status === "compacting") {
          events.push({ type: "notice", subtype: "compact_start", content: "Compacting context..." });
        }
        continue;
      }

      if (message.type === "stream_event") {
        const delta = (message as any).event?.type === "content_block_delta" ? (message as any).event.delta : null;
        if (delta?.type === "text_delta" && delta.text) events.push({ type: "text_delta", text: delta.text });
        else if (delta?.type === "thinking_delta" && delta.thinking) events.push({ type: "thinking_delta", thinking: delta.thinking });
        continue;
      }

      if (message.type === "assistant") {
        const inner = (message as any).message;
        if (inner?.usage) {
          usage.inputTokens += inner.usage.input_tokens || 0;
          usage.outputTokens += inner.usage.output_tokens || 0;
          usage.cacheRead += inner.usage.cache_read_input_tokens || 0;
          usage.cacheCreation += inner.usage.cache_creation_input_tokens || 0;
          events.push({ type: "usage", ...usage });
        }
        for (const block of (inner?.content ?? []) as any[]) {
          if (block.type === "thinking" && block.thinking) events.push({ type: "thinking", thinking: block.thinking });
          else if (block.type === "text" && block.text) events.push({ type: "text", text: block.text });
          else if (block.type === "tool_use" && block.name) events.push({ type: "tool_call", id: block.id, tool_name: block.name, input: block.input });
        }
        continue;
      }

      if (message.type === "user") {
        for (const event of userEvents((message as any).message?.content)) events.push(event);
        continue;
      }

      if (message.type === "result") {
        const r = message as any;
        events.push({
          type: "turn_done",
          subtype: r.subtype,
          total_cost_usd: r.total_cost_usd,
          modelUsage: r.modelUsage,
          num_turns: r.num_turns,
          permission_denials: r.permission_denials,
          errors: r.errors,
        });
        if (!opts.multiTurn) break;
      }
    }
    events.end();
  } catch (err) {
    events.end(err);
  }
}

function userEvents(content: unknown): AgentEvent[] {
  if (typeof content === "string") return content ? [{ type: "user_text", text: content }] : [];
  if (!Array.isArray(content)) return [];

  const out: AgentEvent[] = [];
  for (const block of content as any[]) {
    if (block.type === "tool_result" && block.tool_use_id) {
      out.push({ type: "tool_result", tool_use_id: block.tool_use_id, result: blockText(block.content ?? block.text) });
    }
  }
  const text = (content as any[]).filter((b) => b.type === "text" && b.text).map((b) => b.text).join("\n");
  if (text) out.push({ type: "user_text", text });
  return out;
}

/** Tool results arrive as a string, or as content blocks the UI shows as text. */
function blockText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.filter((b: any) => b?.type === "text" && b.text).map((b: any) => b.text).join("\n");
  return raw == null ? "" : String(raw);
}
