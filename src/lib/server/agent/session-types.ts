import type { ServerWebSocket } from "bun";
import type { WSData } from "./http-server";
import type { AgentRun, ProviderId } from "./providers/types";

export type AgentSession = {
  id: string;
  cwd: string;
  projectCwd?: string;
  ticketId?: string;
  worktreePath?: string;
  agentName?: string;
  systemPromptAppend?: string;
  sdkSessionId?: string;
  abortController: AbortController;
  /** Turns queued before a run exists; drained into the run once it starts. */
  inputQueue: string[];
  fileSnapshots: Map<string, string | null>;
  touchedFiles: Set<string>;
  ws: ServerWebSocket<WSData> | null;
  cleanupTimer?: Timer;
  isRunning: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: string;
  /** Which adapter runs this session. Claude when unset. */
  provider?: ProviderId;
  /** Current permission mode. Defaults to bypassPermissions (fully autonomous). */
  permissionMode?: string;
  /** Codex OS sandbox for this session. Ignored by the providers that have none. */
  sandbox?: string;
  /** Live provider run handle for runtime control (send, setModel, setPermissionMode, interrupt). */
  agentRun?: AgentRun;
  isManager?: boolean;
  usage: { inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number };
};

/** Base64-encoded image attachment for chat messages. */
export type ChatImagePayload = {
  /** MIME type: image/jpeg, image/png, image/gif, image/webp */
  mediaType: string;
  /** Base64-encoded image data */
  data: string;
};

export type ClientMessage =
  | { type: "start"; cwd: string; agentName?: string; systemPromptAppend?: string; briefing: string; allowedTools?: string[]; disallowedTools?: string[]; resumeSessionId?: string; model?: string; isManager?: boolean; provider?: ProviderId; permissionMode?: string; sandbox?: string }
  | { type: "resume"; sessionId: string }
  | { type: "continue"; text: string }
  | { type: "message"; text: string; images?: ChatImagePayload[] }
  | { type: "inject_context"; context: string }
  | { type: "interrupt" }
  | { type: "end" }
  | { type: "clear" }
  | { type: "compact" }
  | { type: "permission"; allow: boolean; message?: string }
  | { type: "set_model"; model?: string }
  | { type: "set_permission_mode"; mode: string }
  | { type: "queue_enqueue"; item: import("./queue-types").QueueItem }
  | { type: "queue_cancel"; ticketId: string }
  | { type: "queue_reorder"; fromIndex: number; toIndex: number }
  | { type: "queue_list" }
  | { type: "set_project"; cwd: string };

export type SdkSessionInfo = {
  sessionId: string;
  agentName?: string;
  timestamp: string;
  summary?: string;
  preview: string[];
};

export const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
