import { pathToFileURL } from "node:url";

import {
  type AssistantMessage,
  fauxAssistantMessage,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from "@earendil-works/pi-ai";

/** One scripted tool call. The tool runs for real, so `name` must be an enabled tool. */
export type PreviewToolCall = {
  name: string;
  arguments?: Record<string, unknown>;
};

/** One model turn: what the mock provider answers on a single agent request. */
export type PreviewTurn = {
  thinking?: string;
  text?: string;
  toolCalls?: PreviewToolCall[];
};

/** A scenario module default-exports this. */
export type Scenario = PreviewTurn[];

function fail(source: string, detail: string): never {
  throw new Error(`Invalid scenario "${source}": ${detail}`);
}

function normalizeToolCall(value: unknown, source: string, turnIndex: number): PreviewToolCall {
  if (typeof value !== "object" || value === null) {
    fail(source, `turn ${turnIndex} has a tool call that is not an object`);
  }
  const { name, arguments: args } = value as { name?: unknown; arguments?: unknown };
  if (typeof name !== "string" || name.trim() === "") {
    fail(source, `turn ${turnIndex} has a tool call without a "name"`);
  }
  if (args !== undefined && (typeof args !== "object" || args === null || Array.isArray(args))) {
    fail(source, `turn ${turnIndex} tool call "${name}" has non-object "arguments"`);
  }
  return { name, arguments: args as Record<string, unknown> | undefined };
}

/** Validate an untrusted scenario export before it reaches the provider stream. */
export function normalizeScenario(value: unknown, source: string): Scenario {
  if (!Array.isArray(value)) {
    fail(source, "default export must be an array of turns");
  }
  if (value.length === 0) {
    fail(source, "default export must contain at least one turn");
  }
  return value.map((rawTurn, turnIndex) => {
    if (typeof rawTurn !== "object" || rawTurn === null) {
      fail(source, `turn ${turnIndex} is not an object`);
    }
    const { thinking, text, toolCalls } = rawTurn as PreviewTurn;
    if (thinking !== undefined && typeof thinking !== "string") {
      fail(source, `turn ${turnIndex} has a non-string "thinking"`);
    }
    if (text !== undefined && typeof text !== "string") {
      fail(source, `turn ${turnIndex} has a non-string "text"`);
    }
    if (toolCalls !== undefined && !Array.isArray(toolCalls)) {
      fail(source, `turn ${turnIndex} has a non-array "toolCalls"`);
    }
    const calls = (toolCalls ?? []).map((call) => normalizeToolCall(call, source, turnIndex));
    if (thinking === undefined && text === undefined && calls.length === 0) {
      fail(source, `turn ${turnIndex} has no thinking, text, or toolCalls`);
    }
    return { thinking, text, toolCalls: calls.length > 0 ? calls : undefined };
  });
}

export async function loadScenario(path: string): Promise<Scenario> {
  const module = await import(pathToFileURL(path).href);
  return normalizeScenario(module.default, path);
}

/**
 * Returns the turn for each model call. Past the end of the script it answers
 * with a notice instead of throwing, so the TUI stays usable.
 */
export function createScenarioRunner(turns: Scenario): () => PreviewTurn {
  let index = 0;
  return () => {
    const turn = turns[index];
    if (turn) {
      index++;
      return turn;
    }
    return {
      text:
        `pi-preview: scenario exhausted after ${turns.length} turn(s). ` +
        "Add more turns to the scenario file to keep driving the extension UI.",
    };
  };
}

/** Render a scripted turn as the assistant message the mock provider streams back. */
export function toAssistantMessage(turn: PreviewTurn): AssistantMessage {
  const content = [
    ...(turn.thinking === undefined ? [] : [fauxThinking(turn.thinking)]),
    ...(turn.text === undefined ? [] : [fauxText(turn.text)]),
    ...(turn.toolCalls ?? []).map((call) => fauxToolCall(call.name, call.arguments ?? {})),
  ];
  // Without "toolUse" the agent treats the turn as final and never runs the tool.
  const stopReason = turn.toolCalls && turn.toolCalls.length > 0 ? "toolUse" : "stop";
  return fauxAssistantMessage(content, { stopReason });
}
