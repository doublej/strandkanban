// The provider seam: everything the agent server needs from a coding agent,
// with nothing SDK-specific above it. Adapters emit AgentEvent; the websocket
// layer forwards those events verbatim, so field names here ARE the wire.
export type ProviderId = "claude" | "codex" | "opencode";

/** An MCP server the provider should spawn over stdio. In-process servers are a provider's own business. */
export type McpStdioSpec = {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export type ProviderCapabilities = {
  /** Empty means the provider has no permission modes to switch between. */
  permissionModes: string[];
  /** False means the provider reports tokens but never a dollar cost. */
  costUsd: boolean;
};

export type TokenTotals = {
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreation: number;
};

export type ModelInfo = { value: string; displayName: string; description: string };
export type McpServerInfo = { name: string; status: string };
export type PluginInfo = { name: string; path: string };
export type SlashCommandInfo = { name: string; description: string; argumentHint: string };

export type RunModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  costUSD: number;
};

/** Subtypes the UI renders as inline status lines. */
export type NoticeSubtype =
  | "init"
  | "compact_start"
  | "compact_done"
  | "subagent_start"
  | "subagent_end"
  | "info"
  | "worktree_progress"
  | "error"
  | "tool_failure"
  | "notification";

/**
 * The complete provider event vocabulary. Deliberately the intersection of what
 * Claude, codex and opencode can all report — no permission requests, because
 * every adapter runs fully autonomous.
 */
export type AgentEvent =
  | { type: "session"; sdkSessionId: string; source: "new" | "resume"; slashCommands?: SlashCommandInfo[] }
  | {
      type: "capabilities";
      models: ModelInfo[];
      mcpServers: McpServerInfo[];
      currentModel?: string;
      permissionMode?: string;
      tools?: string[];
      plugins?: PluginInfo[];
    }
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; thinking: string }
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "user_text"; text: string }
  | { type: "tool_call"; id?: string; tool_name: string; input?: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; result: string }
  | ({ type: "usage" } & TokenTotals)
  | { type: "notice"; subtype: NoticeSubtype; content: string; agentName?: string }
  | {
      type: "turn_done";
      subtype: string;
      total_cost_usd?: number;
      num_turns?: number;
      modelUsage?: Record<string, RunModelUsage>;
      permission_denials?: unknown[];
      errors?: string[];
    }
  | { type: "error"; error: string };

export type StartOptions = {
  cwd: string;
  /** Correlation id the provider stamps on the turns it sends upstream. */
  runId?: string;
  /** Opening turn. Further turns arrive via AgentRun.send(). */
  prompt: string;
  model?: string;
  agentName?: string;
  isManager?: boolean;
  resumeSessionId?: string;
  permissionMode?: string;
  systemPromptAppend?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  mcp?: McpStdioSpec[];
  abortController?: AbortController;
  /** Seeds the running totals carried by `usage` events (resumed sessions). */
  initialUsage?: TokenTotals;
  /** Keep the run alive past a result instead of ending the turn. */
  multiTurn?: boolean;
  /** Fires before a tool executes, so the caller can snapshot files for diffing. */
  onToolStart?: (toolName: string, input: Record<string, unknown>) => Promise<void> | void;
};

export type AgentRun = {
  events: AsyncIterable<AgentEvent>;
  /** Mid-turn steering. */
  send(text: string): void;
  interrupt(): Promise<void>;
  setModel(model?: string): Promise<void>;
  setPermissionMode(mode: string): Promise<void>;
  close(): Promise<void>;
};

export type SessionSummary = {
  sessionId: string;
  agentName?: string;
  timestamp: string;
  summary?: string;
  preview: string[];
};

export type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  timestamp?: string;
};

export interface AgentProvider extends ProviderCapabilities {
  readonly id: ProviderId;
  ensureReady(): Promise<void>;
  start(opts: StartOptions): Promise<AgentRun>;
  listSessions(cwd: string): Promise<SessionSummary[]>;
  readHistory(cwd: string, sessionId: string): Promise<ChatMessage[]>;
  shutdown(): Promise<void>;
}
