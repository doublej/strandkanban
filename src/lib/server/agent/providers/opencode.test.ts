// Fixture recorded from one real turn against opencode 1.18.16 (free Zen model).
// If a CLI upgrade renames an event or moves a field, these assertions fail.
import { expect, test } from "bun:test";
import fixture from "./opencode.fixture.json";
import { toAgentEvents, toChatMessages, toModelRef, type DurableEvent } from "./opencode";
import type { AgentEvent, TokenTotals } from "./types";

const events = fixture as DurableEvent[];
const zero = (): TokenTotals => ({ inputTokens: 0, outputTokens: 0, cacheRead: 0, cacheCreation: 0 });

function mapAll(usage = zero()): AgentEvent[] {
  return events.flatMap((e) => toAgentEvents(e, usage));
}

test("the recorded turn still maps to the expected AgentEvent sequence", () => {
  expect(mapAll().map((e) => e.type)).toEqual(["user_text", "text", "usage", "turn_done"]);
});

test("text arrives whole on .ended, so no deltas are needed", () => {
  expect(mapAll().find((e) => e.type === "text")).toEqual({ type: "text", text: "pong" });
  expect(mapAll().some((e) => e.type === "text_delta" || e.type === "thinking_delta")).toBe(false);
});

test("step.ended accumulates into running totals and reports cost", () => {
  const usage = zero();
  const mapped = mapAll(usage);
  // reasoning tokens fold into output; input/cache come straight off the step
  expect(usage).toEqual({ inputTokens: 3627, outputTokens: 42, cacheRead: 0, cacheCreation: 0 });
  expect(mapped.find((e) => e.type === "usage")).toEqual({ type: "usage", ...usage });
  expect(mapped.find((e) => e.type === "turn_done")).toEqual({ type: "turn_done", subtype: "stop", total_cost_usd: 0 });
});

test("usage keeps accumulating across steps and a tool-loop step is not a turn end", () => {
  const usage = zero();
  const step = (finish: string): DurableEvent => ({
    id: "evt_x",
    type: "session.next.step.ended",
    data: { finish, cost: 0.5, tokens: { input: 10, output: 2, reasoning: 1, cache: { read: 3, write: 4 } } },
  });
  expect(toAgentEvents(step("tool-calls"), usage).map((e) => e.type)).toEqual(["usage"]);
  expect(toAgentEvents(step("stop"), usage).map((e) => e.type)).toEqual(["usage", "turn_done"]);
  expect(usage).toEqual({ inputTokens: 20, outputTokens: 6, cacheRead: 6, cacheCreation: 8 });
});

test("history maps to a transcript with tool results attached to their call", () => {
  const withTool: DurableEvent[] = [
    ...events,
    { id: "e1", type: "session.next.tool.called", data: { callID: "c1", tool: "bash", input: { command: "ls" } } },
    { id: "e2", type: "session.next.tool.success", data: { callID: "c1", content: [{ text: "README.md" }] } },
  ];
  const chat = toChatMessages(withTool);
  expect(chat.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
  expect(chat[0].content).toBe("Reply with exactly: pong");
  expect(chat[2]).toMatchObject({ toolName: "bash", toolInput: { command: "ls" }, toolResult: "README.md" });
});

test("model strings split on the first slash only, so openrouter ids survive", () => {
  expect(toModelRef("opencode/nemotron-3.5-lightning-free")).toEqual({
    providerID: "opencode",
    id: "nemotron-3.5-lightning-free",
  });
  expect(toModelRef("openrouter/anthropic/claude-opus-latest")).toEqual({
    providerID: "openrouter",
    id: "anthropic/claude-opus-latest",
  });
  expect(toModelRef("opencode/big-pickle#thinking")).toEqual({
    providerID: "opencode",
    id: "big-pickle",
    variant: "thinking",
  });
  // no provider to resolve against -> let the server's default stand
  expect(toModelRef("claude-opus-latest")).toBeUndefined();
  expect(toModelRef(undefined)).toBeUndefined();
});
