// Provider-agnostic run loop: pick an adapter, forward its events to the
// client verbatim, then run the app-level epilogue (hooks, manager
// notification, worktree marking, queue kick). No SDK types here.
import type { AgentSession } from "./session-types";
import { BLOCKED_BEADS_TOOLS } from "./beads-tools";
import { buildManagerPrompt } from "./manager-prompt";
import { extractFilePath, snapshotFile, computeDiffs } from "./file-diff";
import { buildSystemPrompt } from "./system-prompt";
import type { AgentQueue } from "./queue-manager";
import { hookExecutor } from "./hook-executor";
import { markWorktreeCompleted } from "./worktree-registry";
import { getProvider } from "./providers";
import type { McpStdioSpec } from "./providers/types";
import { log } from "../logger";

export function sendToClient(session: AgentSession, msg: object) {
  if (session.ws) {
    session.ws.send(JSON.stringify(msg));
  }
}

import type { ImageInput } from "./providers/types";
import type { ChatImagePayload } from "./session-types";

/** Queues a turn for a session, delivering it immediately if a run is live. */
export function sendInput(session: AgentSession, text: string, images?: ChatImagePayload[]) {
  const convertedImages: ImageInput[] | undefined = images?.map(img => ({
    mediaType: img.mediaType,
    data: img.data,
  }));
  if (session.agentRun) session.agentRun.send(text, convertedImages);
  else session.inputQueue.push(text);  // Images on first turn aren't queued separately
}

export type RunAgentOpts = {
  allowedTools?: string[];
  disallowedTools?: string[];
  resumeSdkSession?: string;
  beadsMcpPath?: string | null;
  queue?: AgentQueue;
  sessions?: Map<string, AgentSession>;
};

function beadsMcpSpec(session: AgentSession, beadsMcpPath?: string | null): McpStdioSpec[] {
  if (!beadsMcpPath) return [];
  return [{
    name: "beads",
    command: "uv",
    args: ["--directory", beadsMcpPath, "run", "beads-mcp"],
    env: {
      PATH: process.env.PATH || "",
      HOME: process.env.HOME || "",
      BD_CWD: session.cwd,
      ...(session.agentName && { BD_AGENT_NAME: session.agentName }),
    },
  }];
}

export async function runAgent(session: AgentSession, briefing: string, opts: RunAgentOpts) {
  session.isRunning = true;

  const projectCwd = session.projectCwd ?? session.cwd;
  const ticketId = session.ticketId ?? (session.agentName?.endsWith("-agent") ? session.agentName.slice(0, -6) : undefined);

  if (!session.isManager && session.agentName) {
    hookExecutor.executeHooks("AgentStarted", {
      cwd: projectCwd,
      agentName: session.agentName,
      ticketId,
      id: ticketId,
      worktreePath: session.worktreePath ?? "",
    }).catch(err => log.error("[hooks] AgentStarted failed:", err));
  }

  let runError: unknown = null;

  const provider = getProvider(session.provider, { sessions: opts.sessions, queue: opts.queue });
  const run = await provider.start({
    cwd: session.cwd,
    runId: session.id,
    prompt: briefing,
    model: session.model,
    agentName: session.agentName,
    isManager: session.isManager,
    multiTurn: session.isManager,
    resumeSessionId: opts.resumeSdkSession,
    permissionMode: session.permissionMode,
    sandbox: session.sandbox,
    systemPromptAppend: session.isManager ? buildManagerPrompt() : buildSystemPrompt(session),
    allowedTools: opts.allowedTools,
    disallowedTools: session.isManager
      ? opts.disallowedTools
      : session.agentName
        ? [...(opts.disallowedTools || []), ...BLOCKED_BEADS_TOOLS]
        : opts.disallowedTools,
    mcp: beadsMcpSpec(session, opts.beadsMcpPath),
    abortController: session.abortController,
    initialUsage: session.usage,
    onToolStart: async (toolName, input) => {
      const path = extractFilePath(toolName, input);
      if (path) await snapshotFile(session.fileSnapshots, session.touchedFiles, path);
    },
  });

  session.agentRun = run;
  // Turns that arrived before the run existed.
  while (session.inputQueue.length > 0) run.send(session.inputQueue.shift()!);

  try {
    for await (const event of run.events) {
      switch (event.type) {
        case "session":
          session.sdkSessionId = event.sdkSessionId;
          break;
        case "capabilities":
          // Adopt the provider's effective permission mode so the client reflects reality.
          session.permissionMode = session.permissionMode ?? (event.permissionMode as AgentSession["permissionMode"]);
          // Stamp the static provider capabilities here rather than in each adapter:
          // the UI hides the permission switcher on an empty list and the cost chip
          // when the provider reports no USD, so a forgetful adapter would silently
          // render a control that cannot work.
          sendToClient(session, {
            ...event,
            provider: provider.id,
            permissionModes: provider.permissionModes,
            costUsd: provider.costUsd,
          });
          continue;
        case "usage":
          session.usage = {
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            cacheRead: event.cacheRead,
            cacheCreation: event.cacheCreation,
          };
          break;
        case "turn_done": {
          const diffs = await computeDiffs(session.fileSnapshots, session.touchedFiles);
          sendToClient(session, { ...event, diffs });
          continue;
        }
      }
      sendToClient(session, event);
    }
  } catch (err) {
    runError = err;
    throw err;
  } finally {
    session.isRunning = false;
    session.agentRun = undefined;
    const threwError = runError !== null;
    const errorMessage = threwError
      ? (runError instanceof Error ? runError.message : String(runError))
      : undefined;

    // Notify manager when a worker completes
    if (!session.isManager && opts.sessions) {
      const outcome = threwError
        ? `encountered an error: ${errorMessage}`
        : `completed ticket ${ticketId ?? "(unknown)"}`;
      const cwdLine = session.cwd ? ` CWD: ${session.cwd}.` : "";
      const content = `[System] Agent "${session.agentName}" ${outcome}.${cwdLine} Review the ticket and dispatch follow-up work if needed.`;
      let delivered = false;
      for (const s of opts.sessions.values()) {
        if (!s.isManager) continue;
        const managerProjectCwd = s.projectCwd ?? s.cwd;
        if (managerProjectCwd !== projectCwd) continue;
        sendToClient(s, { type: "user_text", text: content });
        sendInput(s, content);
        delivered = true;
        log.info(`[agent-runner] Notified manager ${s.agentName} of ${session.agentName} ${threwError ? "error" : "completion"} (ticket ${ticketId ?? "?"})`);
        break;
      }
      if (!delivered) {
        log.warn(`[agent-runner] No manager session found for project ${projectCwd} — ${session.agentName} completion not delivered`);
      }
    }

    if (!session.isManager && session.agentName) {
      const baseCtx = {
        cwd: projectCwd,
        agentName: session.agentName,
        ticketId,
        id: ticketId,
        worktreePath: session.worktreePath ?? "",
      };
      if (threwError) {
        hookExecutor.executeHooks("AgentError", { ...baseCtx, error: errorMessage ?? "" })
          .catch(e => log.error("[hooks] AgentError failed:", e));
      } else {
        hookExecutor.executeHooks("AgentCompleted", baseCtx)
          .catch(e => log.error("[hooks] AgentCompleted failed:", e));
      }
      if (session.worktreePath && ticketId) {
        try {
          markWorktreeCompleted(projectCwd, ticketId);
        } catch (e) {
          log.warn("[worktree-registry] markWorktreeCompleted failed:", e);
        }
      }
    }

    // Auto-start next queued item when a worker finishes
    if (!session.isManager && opts.queue) {
      opts.queue.maybeStartNext();
    }
  }
}
