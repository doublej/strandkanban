// JSON-RPC/NDJSON transport for the shared `codex app-server` child process.
// Every streaming notification carries `threadId`, so one child serves every
// session; callers subscribe per thread.
import { spawn, type ChildProcessWithoutNullStreams } from "child_process";
import { log } from "../../logger";

export type Json = Record<string, any>;

class AppServer {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private starting: Promise<void> | null = null;
  private nextId = 0;
  private pending = new Map<number, { resolve: (v: Json) => void; reject: (e: unknown) => void }>();
  private subscribers = new Map<string, (method: string, params: Json) => void>();

  ensureReady(): Promise<void> {
    if (!this.starting) this.starting = this.launch();
    return this.starting;
  }

  private async launch() {
    const proc = spawn("codex", ["app-server"], { stdio: ["pipe", "pipe", "pipe"] });
    this.proc = proc;

    let buf = "";
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      buf += chunk;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (line) this.dispatch(line);
      }
    });
    proc.stderr.setEncoding("utf8");
    proc.stderr.on("data", (chunk: string) => log.warn("[codex]", chunk.trim()));
    proc.on("exit", () => this.onExit());

    await this.request("initialize", {
      clientInfo: { name: "strandkanban", title: null, version: "0.5.0" },
      capabilities: { experimentalApi: true, requestAttestation: false },
    });
    this.notify("initialized", {});
  }

  /** The child died; fail every caller still waiting rather than hang forever. */
  private onExit() {
    const err = new Error("codex app-server exited");
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
    this.proc = null;
    this.starting = null;
  }

  private dispatch(line: string) {
    let msg: Json;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      log.warn("[codex] unparsable frame:", err);
      return;
    }

    if (msg.id !== undefined && (msg.result !== undefined || msg.error !== undefined)) {
      const waiter = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      if (!waiter) return;
      if (msg.error) waiter.reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
      else waiter.resolve(msg.result);
      return;
    }

    if (msg.id !== undefined && msg.method) {
      // Server-initiated request. We run fully autonomous, so nothing here needs
      // a real answer — but leaving it unanswered would stall the turn.
      this.send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: `Unsupported: ${msg.method}` } });
      return;
    }

    const threadId = msg.params?.threadId;
    if (msg.method && threadId) this.subscribers.get(threadId)?.(msg.method, msg.params);
  }

  private send(obj: Json) {
    this.proc?.stdin.write(JSON.stringify(obj) + "\n");
  }

  request<T = Json>(method: string, params?: unknown): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (v: Json) => void, reject });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  notify(method: string, params?: unknown) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  subscribe(threadId: string, fn: (method: string, params: Json) => void) {
    this.subscribers.set(threadId, fn);
  }

  unsubscribe(threadId: string) {
    this.subscribers.delete(threadId);
  }

  shutdown() {
    this.proc?.kill();
    this.proc = null;
    this.starting = null;
    this.subscribers.clear();
  }
}

export const appServer = new AppServer();
