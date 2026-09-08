import assert from "node:assert/strict";
import { describe, it } from "node:test";

import autoName from "../extensions/auto-name.ts";

function installExtension() {
  const handlers = new Map();
  const names = [];
  const pi = {
    on: (event, handler) => handlers.set(event, handler),
    getSessionName: () => undefined,
    setSessionName: (name) => names.push(name),
    registerCommand: () => {},
  };
  autoName(pi);
  return { handlers, names };
}

function contextWithNaming(completion) {
  return {
    modelRegistry: {
      find: () => ({ id: "model" }),
      hasConfiguredAuth: () => true,
      complete: () => completion,
    },
    ui: { notify: () => {} },
  };
}

describe("auto-name extension", () => {
  it("returns from message_end before the naming request completes", async () => {
    const { handlers, names } = installExtension();
    let resolveName;
    const completion = new Promise((resolve) => {
      resolveName = resolve;
    });
    const ctx = contextWithNaming(completion);
    const event = { message: { role: "user", content: "Refactor the auth module" } };

    // Pi awaits message_end handlers before delivering the user message to the
    // agent loop; a slow naming model must not sit in that path.
    const settled = await Promise.race([
      Promise.resolve(handlers.get("message_end")(event, ctx)).then(() => "handler"),
      new Promise((resolve) => setTimeout(() => resolve("timeout"), 50)),
    ]);
    assert.equal(settled, "handler");
    assert.deepEqual(names, []);

    resolveName({ content: [{ type: "text", text: "Refactor auth module" }] });
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(names, ["Refactor auth module"]);
  });

  it("ignores naming failures", async () => {
    const { handlers, names } = installExtension();
    const ctx = contextWithNaming(Promise.reject(new Error("provider down")));
    const event = { message: { role: "user", content: "Anything" } };

    await handlers.get("message_end")(event, ctx);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(names, []);
  });
});
