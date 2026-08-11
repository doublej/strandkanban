// codex adapter, speaking the `codex app-server` JSON-RPC protocol over stdio.
//
// ponytail: pinned to an experimental, version-locked protocol — `codex
// app-server` is marked [experimental] in `codex --help` and its method names
// and payload shapes can change without a semver bump. Verified against
// codex-cli 0.147.0. codex-turn.fixture.json records one real trivial turn and
// codex.test.ts replays it, so a CLI upgrade that renames a notification or
// moves a field fails the test instead of silently emptying agent panes.
import { EventChannel } from "./channel";
import { appServer, type Json } from "./codex-app-server";
import { beadsBridgeSpec } from "../mcp-bridge";
import { log } from "../../logger";
import type {
  AgentEvent,
  AgentProvider,
  AgentRun,
  ChatMessage,
  McpStdioSpec,
  SessionSummary,
  StartOptions,
} from "./types";

// Approvals stay off: the board runs agents unattended, and there is no UI to answer
// a prompt with. The sandbox is codex-only rather than a cross-provider knob — the
// other two have no OS sandbox — so it arrives per session and falls back here.
const APPROVAL_POLICY = "never";
const SANDBOX_MODE = "danger-full-access";

// --- Notification → AgentEvent -------------------------------------------

/** Pure mapping from one app-server notification to provider events. Replayed by codex.test.ts. */
export function codexEvents(method: string, params: Json): AgentEvent[] {
  switch (method) {
    case "item/agentMessage/delta":
      return params.delta ? [{ type: "text_delta", text: params.delta }] : [];

    case "item/reasoning/textDelta":
    case "item/reasoning/summaryTextDelta":
      return params.delta ? [{ type: "thinking_delta", thinking: params.delta }] : [];

    case "item/started":
      return toolCallEvent(params.item);

    case "item/completed":
      return completedEvents(params.item);

    case "thread/tokenUsage/updated": {
      const t = params.tokenUsage?.total;
      if (!t) return [];
      return [{
        type: "usage",
        inputTokens: t.inputTokens ?? 0,
        outputTokens: t.outputTokens ?? 0,
        cacheRead: t.cachedInputTokens ?? 0,
        cacheCreation: t.cacheWriteInputTokens ?? 0,
      }];
    }

    case "thread/compacted":
      return [{ type: "notice", subtype: "compact_done", content: "Context compacted successfully" }];

    case "turn/completed": {
      const turn = params.turn ?? {};
      return [{
        type: "turn_done",
        subtype: turn.status === "completed" ? "success" : (turn.status ?? "error"),
        num_turns: 1,
        ...(turn.error?.message && { errors: [turn.error.message] }),
      }];
    }

    case "error":
      return [{ type: "error", error: params.error?.message ?? String(params.error) }];

    default:
      return [];
  }
}

/** ponytail: the four tool item kinds agents actually produce; webSearch/sleep/imageGeneration render as nothing. */
function toolCallEvent(item: Json | undefined): AgentEvent[] {
  if (!item) return [];
  switch (item.type) {
    case "commandExecution":
      return [{ type: "tool_call", id: item.id, tool_name: "Bash", input: { command: item.command, cwd: item.cwd } }];
    case "mcpToolCall":
      return [{ type: "tool_call", id: item.id, tool_name: `mcp__${item.server}__${item.tool}`, input: item.arguments ?? {} }];
    case "fileChange":
      return [{ type: "tool_call", id: item.id, tool_name: "Edit", input: { files: (item.changes ?? []).map((c: Json) => c.path) } }];
    case "dynamicToolCall":
      return [{ type: "tool_call", id: item.id, tool_name: item.tool, input: item.arguments ?? {} }];
    default:
      return [];
  }
}

function completedEvents(item: Json | undefined): AgentEvent[] {
  if (!item) return [];
  switch (item.type) {
    case "agentMessage":
      return item.text ? [{ type: "text", text: item.text }] : [];
    case "reasoning": {
      const thinking = [...(item.summary ?? []), ...(item.content ?? [])].filter(Boolean).join("\n");
      return thinking ? [{ type: "thinking", thinking }] : [];
    }
    case "userMessage": {
      const text = (item.content ?? []).filter((c: Json) => c.type === "text").map((c: Json) => c.text).join("\n");
      return text ? [{ type: "user_text", text }] : [];
    }
    case "commandExecution": {
      const exit = item.exitCode ? `\n[exit ${item.exitCode}]` : "";
      return [{ type: "tool_result", tool_use_id: item.id, result: (item.aggregatedOutput ?? "") + exit }];
    }
    case "mcpToolCall":
      return [{ type: "tool_result", tool_use_id: item.id, result: mcpResultText(item) }];
    case "fileChange":
      return [{
        type: "tool_result",
        tool_use_id: item.id,
        result: (item.changes ?? []).map((c: Json) => `${c.kind} ${c.path}`).join("\n") || String(item.status ?? ""),
      }];
    case "dynamicToolCall":
      return [{
        type: "tool_result",
        tool_use_id: item.id,
        result: (item.contentItems ?? []).map((c: Json) => c.text ?? JSON.stringify(c)).join("\n"),
      }];
    default:
      return [];
  }
}

function mcpResultText(item: Json): string {
  if (item.error) return `Error: ${item.error.message ?? JSON.stringify(item.error)}`;
  const content = item.result?.content;
  if (Array.isArray(content)) {
    return content.map((c: Json) => (typeof c === "string" ? c : (c.text ?? JSON.stringify(c)))).join("\n");
  }
  return item.result ? JSON.stringify(item.result) : "";
}

// --- Provider -------------------------------------------------------------

function threadConfig(mcp: McpStdioSpec[]): Json {
  // Per-thread overrides, so the shared child never needs `-c` flags and the
  // user's ~/.codex/config.toml is never written to.
  const config: Json = {};
  for (const spec of mcp) {
    config[`mcp_servers.${spec.name}`] = {
      command: spec.command,
      args: spec.args,
      ...(spec.env && { env: spec.env }),
    };
  }
  return config;
}

export function createCodexProvider(): AgentProvider {
  return {
    id: "codex",
    // codex approvals are a different axis from Claude permission modes; the UI
    // has nothing meaningful to switch between, so it hides the switcher.
    permissionModes: [],
    // codex reports token counts but never a dollar figure.
    costUsd: false,
    ensureReady: () => appServer.ensureReady(),
    async shutdown() {
      appServer.shutdown();
    },
    async listSessions(cwd: string): Promise<SessionSummary[]> {
      await appServer.ensureReady();
      const res = await appServer.request<Json>("thread/list", { limit: 100 });
      return (res.data ?? [])
        .filter((t: Json) => t.cwd === cwd)
        .slice(0, 30)
        .map((t: Json) => ({
          sessionId: t.id,
          timestamp: new Date((t.updatedAt ?? t.createdAt ?? 0) * 1000).toISOString(),
          summary: t.name ?? undefined,
          preview: t.preview ? [t.preview] : [],
        }));
    },
    async readHistory(_cwd: string, sessionId: string): Promise<ChatMessage[]> {
      await appServer.ensureReady();
      const res = await appServer.request<Json>("thread/read", { threadId: sessionId, includeTurns: true });
      const messages: ChatMessage[] = [];
      for (const turn of res.thread?.turns ?? []) {
        for (const item of turn.items ?? []) {
          for (const event of [...toolCallEvent(item), ...completedEvents(item)]) {
            const msg = historyMessage(event);
            if (msg) messages.push(msg);
          }
        }
      }
      return messages;
    },
    start: (opts: StartOptions) => startRun(opts),
  };
}

function historyMessage(event: AgentEvent): ChatMessage | null {
  if (event.type === "text") return { role: "assistant", content: event.text };
  if (event.type === "user_text") return { role: "user", content: event.text };
  if (event.type === "tool_call") {
    return { role: "tool", content: `Using ${event.tool_name}`, toolName: event.tool_name, toolInput: event.input };
  }
  return null;
}

async function startRun(opts: StartOptions): Promise<AgentRun> {
  await appServer.ensureReady();

  const events = new EventChannel<AgentEvent>();
  const mcp = [...(opts.mcp ?? [])];
  // The external beads MCP server isn't installed here, so codex workers get
  // beads access through our own bridge or not at all.
  if (!opts.isManager && opts.agentName) mcp.push(beadsBridgeSpec(opts.cwd, opts.agentName));

  const params: Json = {
    cwd: opts.cwd,
    approvalPolicy: APPROVAL_POLICY,
    sandbox: opts.sandbox ?? SANDBOX_MODE,
    config: threadConfig(mcp),
    ...(opts.model && { model: opts.model }),
    ...(opts.systemPromptAppend && { developerInstructions: opts.systemPromptAppend }),
  };

  const started: Json = opts.resumeSessionId
    ? await appServer.request("thread/resume", { threadId: opts.resumeSessionId, ...params })
    : await appServer.request("thread/start", params);

  const threadId: string = started.thread.id;
  let model: string | undefined = opts.model ?? started.model;
  let turnId: string | null = null;
  let closed = false;
  const mcpStatus = new Map<string, string>();
  let models: { value: string; displayName: string; description: string }[] = [];

  const pushCapabilities = () => {
    events.push({
      type: "capabilities",
      models,
      mcpServers: [...mcpStatus].map(([name, status]) => ({ name, status })),
      currentModel: model,
      tools: [],
      plugins: [],
    });
  };

  events.push({ type: "session", sdkSessionId: threadId, source: opts.resumeSessionId ? "resume" : "new" });

  appServer.subscribe(threadId, (method, notifParams) => {
    if (method === "mcpServer/startupStatus/updated") {
      mcpStatus.set(notifParams.name, notifParams.status);
      // Servers churn through "starting"/"cancelled" on the way up; only settled
      // states are worth a re-render.
      if (notifParams.status === "ready" || notifParams.status === "failed") pushCapabilities();
      return;
    }
    for (const event of codexEvents(method, notifParams)) events.push(event);
    if (method === "turn/completed") {
      turnId = null;
      if (!opts.multiTurn) close();
    }
  });

  // The model picker is nice-to-have; a failure here must not sink the run.
  appServer
    .request<Json>("model/list", {})
    .then((res) => {
      models = (res.data ?? [])
        .filter((m: Json) => !m.hidden)
        .map((m: Json) => ({ value: m.id, displayName: m.displayName, description: m.description }));
      pushCapabilities();
    })
    .catch((err) => log.warn("[codex] model/list failed:", err));
  pushCapabilities();

  async function startTurn(text: string) {
    const res = await appServer.request<Json>("turn/start", {
      threadId,
      input: [{ type: "text", text, text_elements: [] }],
      ...(model && { model }),
    });
    turnId = res.turn.id;
  }

  async function deliver(text: string) {
    // Mid-turn steering carries a precondition; if the turn ended first, the
    // request fails and the text becomes a fresh turn instead.
    if (turnId) {
      try {
        await appServer.request("turn/steer", {
          threadId,
          expectedTurnId: turnId,
          input: [{ type: "text", text, text_elements: [] }],
        });
        return;
      } catch (err) {
        log.warn("[codex] steer rejected, starting a new turn:", err);
      }
    }
    await startTurn(text);
  }

  function close() {
    if (closed) return;
    closed = true;
    appServer.unsubscribe(threadId);
    events.end();
  }

  async function interrupt() {
    if (!turnId) return;
    await appServer.request("turn/interrupt", { threadId, turnId }).catch((err) => log.warn("[codex] interrupt failed:", err));
  }

  opts.abortController?.signal.addEventListener("abort", () => void interrupt().then(close));

  startTurn(opts.prompt).catch((err) => events.end(err));

  return {
    events,
    send: (text: string) => void deliver(text).catch((err) => log.warn("[codex] send failed:", err)),
    interrupt,
    // codex takes the model on turn/start; it applies from the next turn on.
    async setModel(next?: string) {
      model = next;
    },
    // No permission modes to switch between — see `permissionModes: []` above.
    async setPermissionMode() {},
    async close() {
      await interrupt();
      close();
    },
  };
}
