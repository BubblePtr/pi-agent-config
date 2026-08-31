import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createScenarioRunner,
  normalizeScenario,
  toAssistantMessage,
} from "../tools/pi-preview/scenario.ts";

describe("normalizeScenario", () => {
  it("accepts a turn list and keeps its order", () => {
    const turns = normalizeScenario([{ text: "one" }, { text: "two" }], "s.ts");
    assert.deepEqual(
      turns.map((turn) => turn.text),
      ["one", "two"],
    );
  });

  it("rejects a scenario whose turn carries no renderable content", () => {
    assert.throws(
      () => normalizeScenario([{ text: "ok" }, {}], "s.ts"),
      /s\.ts.*turn 1/s,
    );
  });

  it("rejects a tool call without a name", () => {
    assert.throws(
      () => normalizeScenario([{ toolCalls: [{ arguments: {} }] }], "s.ts"),
      /s\.ts.*turn 0/s,
    );
  });

  it("rejects a non-array default export", () => {
    assert.throws(() => normalizeScenario({ turns: [] }, "s.ts"), /array of turns/);
  });
});

describe("createScenarioRunner", () => {
  it("walks the script once per model call", () => {
    const nextTurn = createScenarioRunner([{ text: "one" }, { text: "two" }]);
    assert.equal(nextTurn().text, "one");
    assert.equal(nextTurn().text, "two");
  });

  it("keeps the session usable after the script runs out", () => {
    const nextTurn = createScenarioRunner([{ text: "only" }]);
    nextTurn();
    const exhausted = nextTurn();
    assert.match(exhausted.text ?? "", /scenario exhausted/i);
    assert.equal(exhausted.toolCalls, undefined);
    // Still answers on every later call instead of erroring the stream.
    assert.match(nextTurn().text ?? "", /scenario exhausted/i);
  });
});

describe("toAssistantMessage", () => {
  it("stops with toolUse so the agent runs the scripted tool call", () => {
    const message = toAssistantMessage({
      text: "listing",
      toolCalls: [{ name: "bash", arguments: { command: "echo hi" } }],
    });
    assert.equal(message.stopReason, "toolUse");
    assert.deepEqual(
      message.content.map((block) => block.type),
      ["text", "toolCall"],
    );
    assert.deepEqual(message.content[1].arguments, { command: "echo hi" });
  });

  it("stops with stop for a text-only turn", () => {
    assert.equal(toAssistantMessage({ text: "done" }).stopReason, "stop");
  });
});
