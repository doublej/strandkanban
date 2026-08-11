import { test, expect } from "bun:test";
import { getProvider } from "./index";

// Every session and queue item that existed before providers did carries no
// provider field. If `undefined` ever stops resolving to claude, all of them
// become unresumable.
test("an unset provider resolves to claude", () => {
  expect(getProvider(undefined, {}).id).toBe("claude");
  expect(getProvider("claude", {}).id).toBe("claude");
  expect(getProvider("codex", {}).id).toBe("codex");
});
