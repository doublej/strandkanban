// opencode adapter (verified against opencode 1.18.16).
//
// Transport: ONE headless `opencode serve` child per process, shared by every run —
// cwd travels per-request as `location.directory`, so a second server would buy nothing.
// The stream is durable: every event carries an id, and `GET /api/session/:id/event?after=`
// resumes from it, so a dropped connection replays instead of losing the turn.
import { spawn, type ChildProcess } from "child_process";
import { randomUUID } from "crypto";
import { log } from "../../logger";
import { EventChannel } from "./channel";
import type {
  AgentEvent,
  AgentProvider,
  AgentRun,
  ChatMessage,
  SessionSummary,
  StartOptions,
  TokenTotals,
} from "./types";

const HOST = "127.0.0.1";
const USERNAME = "opencode";
/** The seam is autonomous — a permission prompt would hang the run with nobody to answer it. */
const ALLOW_ALL = JSON.stringify(
  Object.fromEntries(
    ["read", "edit", "glob", "grep", "list", "bash", "task", "external_directory", "todowrite", "question", "webfetch", "websearch", "lsp", "doom_loop", "skill"].map((k) => [k, "allow"]),
  ),
);

type ModelRef = { providerID: string; id: string; variant?: string };
export type DurableEvent = { id: string; type: string; data: Record<string, any> };

// --- server lifecycle ---

type Server = { port: number; auth: string; child: ChildProcess };
let server: Promise<Server> | null = null;

function ensureServer(): Promise<Server> {
  if (!server) server = startServer().catch((err) => { server = null; throw err; });
  return server;
}

function startServer(): Promise<Server> {
  // Per-boot random password. Without OPENCODE_SERVER_PASSWORD the server prints
  // "server is unsecured" and serves every local process on the box.
  const password = randomUUID();
  const child = spawn("opencode", ["serve", "--port", "0", "--hostname", HOST], {
    env: { ...process.env, OPENCODE_SERVER_PASSWORD: password, OPENCODE_SERVER_USERNAME: USERNAME, OPENCODE_PERMISSION: ALLOW_ALL },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const kill = () => child.kill();
  process.once("exit", kill);
  // `once` so the re-raise below hits the default handler (or another listener) instead of
  // looping. Without the re-raise, merely listening would suppress the host's own exit.
  for (const sig of ["SIGINT", "SIGTERM"] as const) {
    process.once(sig, () => { kill(); process.kill(process.pid, sig); });
  }
  // ponytail: a SIGKILL'd parent still orphans the child. Same exposure the dolt reaper
  // handles for dolt; give opencode the same treatment if it starts leaking in practice.

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("opencode serve did not report a port within 20s")), 20_000);
    const done = (err?: Error, port?: number) => {
      clearTimeout(timer);
      if (err) return reject(err);
      resolve({ port: port!, auth: `Basic ${Buffer.from(`${USERNAME}:${password}`).toString("base64")}`, child });
    };
    let banner = "";
    child.stdout.on("data", (chunk) => {
      banner += chunk;
      const port = banner.match(/listening on https?:\/\/[^:]+:(\d+)/)?.[1];
      if (port) done(undefined, Number(port));
    });
    child.stderr.on("data", (chunk) => log.warn(`[opencode] ${String(chunk).trim()}`));
    child.on("error", (err) => done(err));
    child.on("exit", (code) => done(new Error(`opencode serve exited with code ${code}`)));
  });
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const s = await ensureServer();
  const res = await fetch(`http://${HOST}:${s.port}${path}`, {
    ...init,
    headers: { authorization: s.auth, "content-type": "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`opencode ${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  return res;
}

/** Every JSON route wraps its payload in `{data}`. */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const text = await (await request(path, init)).text();
  return text ? (JSON.parse(text) as { data: T }).data : (undefined as T);
}

// --- pure mapping (fixture-tested) ---

/**
 * UI model strings are flat; opencode wants a `{providerID, id, variant}` triple.
 * Format: `providerID/model[#variant]`, split on the FIRST slash only — openrouter ids
 * carry slashes of their own (`openrouter/anthropic/claude-opus-latest`). A bare string
 * has no provider to resolve to, so it is dropped and the server's default model stands.
 */
export function toModelRef(model?: string): ModelRef | undefined {
  if (!model) return undefined;
  const [spec, variant] = model.split("#");
  const slash = spec.indexOf("/");
  if (slash <= 0) {
    log.warn(`[opencode] ignoring model "${model}": expected providerID/model`);
    return undefined;
  }
  return { providerID: spec.slice(0, slash), id: spec.slice(slash + 1), ...(variant && { variant }) };
}

function toolResultText(d: Record<string, any>): string {
  const parts = (d.content ?? []).map((c: any) => c?.text ?? "").filter(Boolean);
  return parts.length ? parts.join("\n") : JSON.stringify(d.structured ?? d.result ?? "");
}

/**
 * One durable event → zero or more AgentEvents. `usage` is mutated into a running total,
 * matching the cumulative `usage` events the other adapters emit.
 *
 * opencode has no delta events on this stream (text/reasoning arrive whole on `.ended`),
 * so text_delta/thinking_delta are never produced.
 */
export function toAgentEvents(e: DurableEvent, usage: TokenTotals): AgentEvent[] {
  const d = e.data ?? {};
  switch (e.type) {
    case "session.next.prompted":
      return [{ type: "user_text", text: d.prompt?.text ?? "" }];
    case "session.next.text.ended":
      return [{ type: "text", text: d.text ?? "" }];
    case "session.next.reasoning.ended":
      return [{ type: "thinking", thinking: d.text ?? "" }];
    case "session.next.tool.called":
      return [{ type: "tool_call", id: d.callID, tool_name: d.tool, input: d.input }];
    case "session.next.tool.success":
      return [{ type: "tool_result", tool_use_id: d.callID, result: toolResultText(d) }];
    case "session.next.tool.failed":
      return [{ type: "notice", subtype: "tool_failure", content: `${d.tool ?? d.callID} failed: ${String(d.error?.message ?? "").slice(0, 300)}` }];
    case "session.next.step.failed":
      return [{ type: "error", error: d.error?.message ?? "step failed" }];
    case "session.next.compaction.started":
      return [{ type: "notice", subtype: "compact_start", content: `Compacting context (${d.reason ?? "auto"})` }];
    case "session.next.compaction.ended":
      return [{ type: "notice", subtype: "compact_done", content: "Context compacted" }];
    case "session.next.step.ended":
      return stepEnded(d, usage);
    default:
      return [];
  }
}

function stepEnded(d: Record<string, any>, usage: TokenTotals): AgentEvent[] {
  const t = d.tokens ?? {};
  usage.inputTokens += t.input ?? 0;
  // Reasoning tokens are billed output; TokenTotals has no separate slot for them.
  usage.outputTokens += (t.output ?? 0) + (t.reasoning ?? 0);
  usage.cacheRead += t.cache?.read ?? 0;
  usage.cacheCreation += t.cache?.write ?? 0;
  const events: AgentEvent[] = [{ type: "usage", ...usage }];
  // ponytail: opencode has no explicit turn-done event, so a step IS the turn unless the
  // model is mid tool-loop. A future finish reason meaning "more coming" would end early.
  if (d.finish !== "tool-calls") {
    events.push({ type: "turn_done", subtype: d.finish ?? "stop", total_cost_usd: d.cost });
  }
  return events;
}

/** Durable events → chat transcript. Tool calls and their results share a callID. */
export function toChatMessages(events: DurableEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const byCallId = new Map<string, ChatMessage>();
  for (const e of events) {
    const d = e.data ?? {};
    const timestamp = d.timestamp ? new Date(d.timestamp).toISOString() : undefined;
    if (e.type === "session.next.prompt.admitted") {
      messages.push({ role: "user", content: d.prompt?.text ?? "", timestamp });
    } else if (e.type === "session.next.text.ended") {
      messages.push({ role: "assistant", content: d.text ?? "", timestamp });
    } else if (e.type === "session.next.tool.called") {
      const message: ChatMessage = { role: "tool", content: "", toolName: d.tool, toolInput: d.input, timestamp };
      byCallId.set(d.callID, message);
      messages.push(message);
    } else if (e.type === "session.next.tool.success") {
      const message = byCallId.get(d.callID);
      if (message) message.toolResult = toolResultText(d);
    }
  }
  return messages;
}

// --- streaming ---

async function* readSse(body: ReadableStream<Uint8Array>): AsyncIterable<DurableEvent> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buffer += decoder.decode(chunk, { stream: true });
    let split: number;
    while ((split = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          yield JSON.parse(line.slice(5));
        } catch {
          /* keepalive or partial frame */
        }
      }
    }
  }
}

async function pump(sessionId: string, events: EventChannel<AgentEvent>, usage: TokenTotals, abort: AbortController, after?: string): Promise<void> {
  while (!abort.signal.aborted) {
    try {
      const res = await request(`/api/session/${sessionId}/event${after ? `?after=${encodeURIComponent(after)}` : ""}`, { signal: abort.signal });
      for await (const event of readSse(res.body!)) {
        after = event.id;
        for (const mapped of toAgentEvents(event, usage)) events.push(mapped);
      }
    } catch (err) {
      if (abort.signal.aborted) break;
      log.warn(`[opencode] event stream dropped, resuming after ${after ?? "start"}: ${err}`);
    }
    if (abort.signal.aborted) break;
    // ponytail: fixed 500ms backoff, no give-up. Bounds a reconnect spin if the session
    // is gone; close() is what actually ends this loop.
    await new Promise((r) => setTimeout(r, 500));
  }
  events.end();
}

// --- provider ---

export function createOpencodeProvider(): AgentProvider {
  return {
    id: "opencode",
    // No permission modes: the server is configured allow-all, see ALLOW_ALL.
    permissionModes: [],
    // `session.next.step.ended` carries a real `cost` in USD (0 on free models).
    costUsd: true,
    async ensureReady() {
      await ensureServer();
    },
    async shutdown() {
      const running = server;
      server = null;
      if (running) (await running).child.kill();
    },
    async listSessions(cwd: string): Promise<SessionSummary[]> {
      const sessions = await api<{ id: string; title?: string; time: { created: number } }[]>(
        `/api/session?directory=${encodeURIComponent(cwd)}`,
      );
      return sessions.map((s) => ({
        sessionId: s.id,
        timestamp: new Date(s.time.created).toISOString(),
        summary: s.title,
        preview: s.title ? [s.title] : [],
      }));
    },
    async readHistory(_cwd: string, sessionId: string): Promise<ChatMessage[]> {
      return toChatMessages(await api<DurableEvent[]>(`/api/session/${sessionId}/history`));
    },
    async start(opts: StartOptions): Promise<AgentRun> {
      return startRun(opts);
    },
  };
}

async function startRun(opts: StartOptions): Promise<AgentRun> {
  const events = new EventChannel<AgentEvent>();
  const abort = opts.abortController ?? new AbortController();
  const usage: TokenTotals = {
    inputTokens: opts.initialUsage?.inputTokens ?? 0,
    outputTokens: opts.initialUsage?.outputTokens ?? 0,
    cacheRead: opts.initialUsage?.cacheRead ?? 0,
    cacheCreation: opts.initialUsage?.cacheCreation ?? 0,
  };
  const model = toModelRef(opts.model);

  let after: string | undefined;
  let sessionId = opts.resumeSessionId;
  if (sessionId) {
    // Start the stream past the history the UI already has, or every past turn replays.
    after = (await api<DurableEvent[]>(`/api/session/${sessionId}/history`)).at(-1)?.id;
  } else {
    sessionId = (
      await api<{ id: string }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ ...(model && { model }), location: { directory: opts.cwd } }),
      })
    ).id;
  }
  events.push({ type: "session", sdkSessionId: sessionId, source: opts.resumeSessionId ? "resume" : "new" });
  void emitCapabilities(events, opts.model);

  const send = (text: string) =>
    void api(`/api/session/${sessionId}/prompt`, {
      method: "POST",
      body: JSON.stringify({ prompt: { text }, delivery: "steer" }),
    }).catch((err) => events.push({ type: "error", error: String(err) }));

  // Stream first: the durable log starts at seq 1, but connecting after the prompt would
  // race the first events against the reconnect cursor.
  void pump(sessionId, events, usage, abort, after);
  send(opts.prompt);

  return {
    events,
    send,
    async interrupt() {
      await api(`/api/session/${sessionId}/interrupt`, { method: "POST" });
    },
    async setModel(next?: string) {
      const ref = toModelRef(next);
      if (ref) await api(`/api/session/${sessionId}/model`, { method: "POST", body: JSON.stringify({ model: ref }) });
    },
    async setPermissionMode() {
      /* server runs allow-all; nothing to switch */
    },
    async close() {
      abort.abort();
      events.end();
    },
  };
}

/** Model picker feed. The `value` strings here are exactly what toModelRef() parses back. */
async function emitCapabilities(events: EventChannel<AgentEvent>, currentModel?: string): Promise<void> {
  try {
    // Not `{data}`-wrapped like the /api routes are, so this one bypasses api().
    const config = (await (await request("/config/providers")).json()) as {
      providers: { id: string; name?: string; models: Record<string, { name?: string }> }[];
    };
    const models = config.providers.flatMap((p) =>
      Object.entries(p.models).map(([id, m]) => ({
        value: `${p.id}/${id}`,
        displayName: m.name ?? id,
        description: p.name ?? p.id,
      })),
    );
    events.push({ type: "capabilities", models, mcpServers: [], currentModel });
  } catch (err) {
    log.warn(`[opencode] capabilities unavailable: ${err}`);
  }
}
