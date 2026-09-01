import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerMockProvider } from "./mock-provider.ts";
import type { Scenario } from "./scenario.ts";

/**
 * Fixed script for spawned children. It is deliberately independent of the
 * parent scenario: a child gets its own task and its own turn count, and the
 * point is only to let it finish successfully so the parent extension can
 * render its success UI (progress, tool uses, usage roll-up).
 */
const childScenario: Scenario = [
  {
    text: "Let me look at the repository first.",
    toolCalls: [{ name: "bash", arguments: { command: "ls -1" } }],
  },
  {
    text:
      "Done. This is a pi preset repository: it ships `defaults.json`, `AGENTS.md`, " +
      "and an `extensions/` directory, wired up through the `pi` field in `package.json`.",
  },
];

/**
 * Loaded by pi processes that a previewed extension spawns (pi-subagents and
 * friends). Children inherit the parent's `pi-preview/mock` model name, so
 * without this they die at startup with "Model not found".
 */
export default function (pi: ExtensionAPI) {
  registerMockProvider(pi, childScenario);
}
