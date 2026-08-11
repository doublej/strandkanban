import { test, expect } from "bun:test";
import { codexEvents } from "./codex";
import fixture from "./codex-turn.fixture.json";

// codex-turn.fixture.json is a real `codex app-server` notification stream
// (codex-cli 0.147.0): one turn that ran a shell command and called the beads
// MCP bridge. `codex app-server` is [experimental], so this replay is what
// catches a CLI upgrade renaming a notification or moving a field.
const events = (fixture as { method: string; params: any }[]).flatMap((n) => codexEvents(n.method, n.params));

test("a real codex turn maps to the expected event sequence", () => {
  expect(events.map((e) => e.type)).toEqual([
    "user_text",
    "tool_call",
    "tool_result",
    "tool_call",
    "tool_result",
    "usage",
    "text_delta",
    "text",
    "usage",
    "turn_done",
  ]);
});

test("tool results carry the id of the call they answer", () => {
  const calls = events.filter((e) => e.type === "tool_call") as any[];
  const results = events.filter((e) => e.type === "tool_result") as any[];
  expect(calls.map((c) => c.tool_name)).toEqual(["Bash", "mcp__beads-agent__update_issue"]);
  expect(results.map((r) => r.tool_use_id)).toEqual(calls.map((c) => c.id));
  expect(results[0].result).toContain("hello-fixture");
  // The bridge's isError payload comes back as ordinary MCP text content.
  expect(results[1].result).toContain("no issue found");
});

test("token usage and turn completion carry through", () => {
  const usage = events.filter((e) => e.type === "usage").at(-1) as any;
  expect(usage).toMatchObject({ inputTokens: 40466, outputTokens: 387, cacheRead: 30208, cacheCreation: 0 });
  expect(events.at(-1)).toEqual({ type: "turn_done", subtype: "success", num_turns: 1 });
});

test("a failed turn reports its error", () => {
  expect(codexEvents("turn/completed", { turn: { status: "failed", error: { message: "boom" } } })).toEqual([
    { type: "turn_done", subtype: "failed", num_turns: 1, errors: ["boom"] },
  ]);
});
