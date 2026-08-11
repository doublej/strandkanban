import type { AgentProvider, ProviderId } from "./types";
import { createClaudeProvider, type ClaudeContext } from "./claude";
import { createCodexProvider } from "./codex";
import { createOpencodeProvider } from "./opencode";

/** Resolves the adapter for a session. Claude when unset — every existing session. */
export function getProvider(id: ProviderId | undefined, ctx: ClaudeContext): AgentProvider {
  switch (id) {
    case "codex":
      return createCodexProvider();
    case "opencode":
      return createOpencodeProvider();
    case "claude":
    case undefined:
      return createClaudeProvider(ctx);
    default:
      throw new Error(`No adapter for provider: ${id}`);
  }
}
