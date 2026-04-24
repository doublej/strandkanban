import type { Server, ServerWebSocket } from "bun";
import { createWorktree, listWorktrees, removeWorktree } from "./worktree";
import type { AgentQueue } from "./queue-manager";
import type { AgentSession } from "./session-types";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

export type WSData = { sessionId?: string };

export type HttpConfig = {
  port: number;
  beadsMcpEnabled: boolean;
  getSessionsCount: () => number;
  listSdkSessions: (cwd: string) => unknown[];
  getSessionHistory: (cwd: string, sessionId: string) => unknown[];
  handleUpgrade: (req: Request, server: Server) => boolean;
  queue: AgentQueue;
  sessions: Map<string, AgentSession>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Content-Type": "application/json",
};

export function createHttpHandler(config: HttpConfig) {
  return async function fetch(req: Request, server: Server): Promise<Response | undefined> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({
        status: "ok",
        activeSessions: config.getSessionsCount(),
        beadsMcpEnabled: config.beadsMcpEnabled,
      }), { headers: { "Content-Type": "application/json" } });
    }

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/sessions") {
      const cwd = url.searchParams.get("cwd");
      if (!cwd) {
        return new Response(JSON.stringify({ error: "cwd required" }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        const sessions = config.listSdkSessions(cwd);
        return new Response(JSON.stringify({ sessions }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // Session history endpoint: /sessions/:id/history?cwd=...
    const historyMatch = url.pathname.match(/^\/sessions\/([^/]+)\/history$/);
    if (historyMatch) {
      const sessionId = historyMatch[1];
      const cwd = url.searchParams.get("cwd");
      if (!cwd) {
        return new Response(JSON.stringify({ error: "cwd required" }), {
          status: 400, headers: corsHeaders,
        });
      }
      try {
        const messages = config.getSessionHistory(cwd, sessionId);
        return new Response(JSON.stringify({ messages }), { headers: corsHeaders });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
          status: 500, headers: corsHeaders,
        });
      }
    }

    if (url.pathname === "/queue" && req.method === "GET") {
      const cwd = url.searchParams.get("cwd");
      const items = cwd ? config.queue.getItemsForCwd(cwd) : [];
      return new Response(JSON.stringify({ items }), {
        headers: corsHeaders,
      });
    }

    // --- Agent control endpoints ---
    if (url.pathname === "/agents") {
      if (req.method === "POST") return handleAgentEnqueue(req, config);
      if (req.method === "GET") return handleAgentList(url, config);
    }
    const agentMatch = url.pathname.match(/^\/agents\/([^/]+)$/);
    if (agentMatch) {
      const sessionId = agentMatch[1];
      if (req.method === "GET") return handleAgentGet(sessionId, config);
      if (req.method === "DELETE") return handleAgentInterrupt(sessionId, config);
    }
    const messageMatch = url.pathname.match(/^\/agents\/([^/]+)\/message$/);
    if (messageMatch && req.method === "POST") {
      return handleAgentMessage(messageMatch[1], req, config);
    }

    // --- Worktree endpoints ---
    if (url.pathname === "/worktrees") {
      if (req.method === "POST") {
        return await handleWorktreeCreate(req);
      }
      if (req.method === "GET") {
        return await handleWorktreeList(url);
      }
      if (req.method === "DELETE") {
        return await handleWorktreeRemove(req);
      }
    }

    if (config.handleUpgrade(req, server)) {
      return undefined;
    }
    return new Response("WebSocket only", { status: 426 });
  };
}

async function handleWorktreeCreate(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) {
    return new Response(JSON.stringify({ error: "repoPath and ticketId required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    const path = await createWorktree(body.repoPath, body.ticketId);
    return new Response(JSON.stringify({ path }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}

async function handleWorktreeList(url: URL): Promise<Response> {
  const repoPath = url.searchParams.get("repoPath");
  if (!repoPath) {
    return new Response(JSON.stringify({ error: "repoPath required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    const worktrees = await listWorktrees(repoPath);
    return new Response(JSON.stringify({ worktrees }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}

type EnqueueBody = {
  ticketId?: string;
  agentName?: string;
  cwd?: string;
  title?: string;
  description?: string;
  priority?: number;
  issueType?: string;
  model?: string;
  useWorktree?: boolean;
};

async function handleAgentEnqueue(req: Request, config: HttpConfig): Promise<Response> {
  const body = (await req.json()) as EnqueueBody;
  if (!body.ticketId || !body.cwd) {
    return new Response(JSON.stringify({ error: "ticketId and cwd required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  const item = {
    ticketId: body.ticketId,
    agentName: body.agentName ?? `${body.ticketId}-agent`,
    cwd: body.cwd,
    title: body.title ?? body.ticketId,
    description: body.description ?? "",
    priority: body.priority ?? 2,
    issueType: body.issueType ?? "task",
    model: body.model,
    useWorktree: body.useWorktree ?? false,
    enqueuedAt: new Date().toISOString(),
  };
  config.queue.enqueue(item);
  return new Response(JSON.stringify({ queued: true, ticketId: item.ticketId, enqueuedAt: item.enqueuedAt }), {
    headers: corsHeaders,
  });
}

function handleAgentList(url: URL, config: HttpConfig): Response {
  const cwd = url.searchParams.get("cwd");
  if (!cwd) {
    return new Response(JSON.stringify({ error: "cwd required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  const active = config.queue.getActiveSessions().filter((s) => s.projectCwd === cwd);
  const queued = config.queue.getItemsForCwd(cwd);
  return new Response(JSON.stringify({ active, queued }), { headers: corsHeaders });
}

function handleAgentGet(sessionId: string, config: HttpConfig): Response {
  const session = config.sessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "session not found" }), {
      status: 404, headers: corsHeaders,
    });
  }
  return new Response(JSON.stringify({
    sessionId: session.id,
    agentName: session.agentName,
    cwd: session.cwd,
    projectCwd: session.projectCwd ?? session.cwd,
    ticketId: session.ticketId,
    worktreePath: session.worktreePath,
    isRunning: session.isRunning,
    isManager: !!session.isManager,
    model: session.model,
    sdkSessionId: session.sdkSessionId,
    usage: session.usage,
  }), { headers: corsHeaders });
}

function handleAgentInterrupt(sessionId: string, config: HttpConfig): Response {
  const session = config.sessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "session not found" }), {
      status: 404, headers: corsHeaders,
    });
  }
  session.abortController.abort();
  return new Response(JSON.stringify({ interrupted: true, sessionId }), { headers: corsHeaders });
}

async function handleAgentMessage(sessionId: string, req: Request, config: HttpConfig): Promise<Response> {
  const session = config.sessions.get(sessionId);
  if (!session) {
    return new Response(JSON.stringify({ error: "session not found" }), {
      status: 404, headers: corsHeaders,
    });
  }
  const body = (await req.json()) as { text?: string };
  if (!body.text) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  const userMsg: SDKUserMessage = {
    type: "user",
    session_id: session.id,
    parent_tool_use_id: null,
    message: { role: "user", content: body.text },
  };
  if (session.inputResolver) session.inputResolver(userMsg);
  else session.inputQueue.push(userMsg);
  return new Response(JSON.stringify({ delivered: true }), { headers: corsHeaders });
}

async function handleWorktreeRemove(req: Request): Promise<Response> {
  const body = await req.json() as { repoPath?: string; ticketId?: string };
  if (!body.repoPath || !body.ticketId) {
    return new Response(JSON.stringify({ error: "repoPath and ticketId required" }), {
      status: 400, headers: corsHeaders,
    });
  }
  try {
    await removeWorktree(body.repoPath, body.ticketId);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: corsHeaders,
    });
  }
}
