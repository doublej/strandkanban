import type { SDKUserMessage, Query, PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { ServerWebSocket } from "bun";
import type { WSData } from "./http-server";

export type { PermissionMode };

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
  inputQueue: SDKUserMessage[];
  inputResolver?: (msg: SDKUserMessage) => void;
  fileSnapshots: Map<string, string | null>;
  touchedFiles: Set<string>;
  ws: ServerWebSocket<WSData> | null;
  cleanupTimer?: Timer;
  isRunning: boolean;
  allowedTools?: string[];
  disallowedTools?: string[];
  model?: string;
  /** Current permission mode. Defaults to bypassPermissions (fully autonomous). */
  permissionMode?: PermissionMode;
  /** Live SDK Query handle for runtime control requests (setModel, setPermissionMode, interrupt). */
  agentQuery?: Query;
  isManager?: boolean;
  usage: { inputTokens: number; outputTokens: number; cacheRead: number; cacheCreation: number };
};

export type ClientMessage =
  | { type: "start"; cwd: string; agentName?: string; systemPromptAppend?: string; briefing: string; allowedTools?: string[]; disallowedTools?: string[]; resumeSessionId?: string; model?: string; isManager?: boolean }
  | { type: "resume"; sessionId: string }
  | { type: "continue"; text: string }
  | { type: "message"; text: string }
  | { type: "inject_context"; context: string }
  | { type: "interrupt" }
  | { type: "end" }
  | { type: "clear" }
  | { type: "compact" }
  | { type: "permission"; allow: boolean; message?: string }
  | { type: "set_model"; model?: string }
  | { type: "set_permission_mode"; mode: PermissionMode }
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
