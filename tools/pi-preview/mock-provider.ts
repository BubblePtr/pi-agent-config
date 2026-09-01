import { type FauxResponseStep, fauxProvider } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { createScenarioRunner, type Scenario, toAssistantMessage } from "./scenario.ts";

export const PROVIDER_ID = "pi-preview";
export const MODEL_ID = "mock";

/**
 * Register the scripted mock model on a pi session and pin the session to it.
 *
 * Used both by the preview's own inline extension and by `child-extension.ts`
 * in pi processes that an extension spawns, so a child inherits a `pi-preview/mock`
 * model name that actually resolves.
 */
export function registerMockProvider(pi: ExtensionAPI, turns: Scenario): void {
  const faux = fauxProvider({
    provider: PROVIDER_ID,
    models: [
      {
        id: MODEL_ID,
        name: "pi-preview mock",
        reasoning: true,
        input: ["text", "image"],
        contextWindow: 200_000,
        maxTokens: 16_384,
      },
    ],
    // Slow the stream down enough that streaming-driven UI is actually visible.
    tokensPerSecond: 80,
  });

  const nextTurn = createScenarioRunner(turns);
  // The faux queue is consumed one step per model call, so each step re-arms the
  // next one. Without this the provider would error out once the queue drains.
  const step: FauxResponseStep = () => {
    faux.appendResponses([step]);
    return toAssistantMessage(nextTurn());
  };
  faux.setResponses([step]);

  pi.registerProvider(faux.provider);
  // Inline factories load after file extensions, so this handler runs last:
  // a previewed extension that picks its own model on startup cannot drag the
  // preview onto a real, billable provider.
  pi.on("session_start", async (_event, ctx) => {
    const model = ctx.modelRegistry.find(PROVIDER_ID, MODEL_ID);
    if (model) await pi.setModel(model);
  });
}
