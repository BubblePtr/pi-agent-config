import { type FauxResponseStep, fauxProvider } from "@earendil-works/pi-ai";
import {
  type CreateAgentSessionRuntimeFactory,
  createAgentSessionFromServices,
  createAgentSessionRuntime,
  createAgentSessionServices,
  initTheme,
  type InlineExtension,
  InteractiveMode,
  SessionManager,
} from "@earendil-works/pi-coding-agent";

import defaultScenario from "./default-scenario.ts";
import { createScenarioRunner, loadScenario, toAssistantMessage } from "./scenario.ts";

const PROVIDER_ID = "pi-preview";
const MODEL_ID = "mock";

export type PreviewOptions = {
  /** Extension entry to preview. */
  extensionPath: string;
  /** Scenario module path; the built-in scenario is used when omitted. */
  scenarioPath?: string;
  cwd: string;
  agentDir: string;
};

export async function runPreview(options: PreviewOptions): Promise<void> {
  const turns = options.scenarioPath ? await loadScenario(options.scenarioPath) : defaultScenario;
  const nextTurn = createScenarioRunner(turns);

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

  // The faux queue is consumed one step per model call, so each step re-arms the
  // next one. Without this the provider would error out once the queue drains.
  const step: FauxResponseStep = () => {
    faux.appendResponses([step]);
    return toAssistantMessage(nextTurn());
  };
  faux.setResponses([step]);

  const previewExtension: InlineExtension = {
    name: PROVIDER_ID,
    factory: (pi) => {
      pi.registerProvider(faux.provider);
      // Inline factories load after file extensions, so this handler runs last:
      // a previewed extension that picks its own model on startup cannot drag
      // the preview onto a real, billable provider.
      pi.on("session_start", async (_event, ctx) => {
        const model = ctx.modelRegistry.find(PROVIDER_ID, MODEL_ID);
        if (model) await pi.setModel(model);
      });
    },
  };

  const createRuntime: CreateAgentSessionRuntimeFactory = async ({
    cwd,
    sessionManager,
    sessionStartEvent,
  }) => {
    const services = await createAgentSessionServices({
      cwd,
      agentDir: options.agentDir,
      resourceLoaderOptions: {
        // Preview exactly the requested extension, not the machine's whole setup.
        noExtensions: true,
        // Skills only feed the prompt, which the mock ignores; their discovery
        // diagnostics would otherwise bury the extension UI on the startup screen.
        noSkills: true,
        additionalExtensionPaths: [options.extensionPath],
        extensionFactories: [previewExtension],
      },
    });
    const model = services.modelRuntime.getModel(PROVIDER_ID, MODEL_ID);
    return {
      ...(await createAgentSessionFromServices({
        services,
        sessionManager,
        sessionStartEvent,
        model,
      })),
      services,
      diagnostics: services.diagnostics,
    };
  };

  const runtime = await createAgentSessionRuntime(createRuntime, {
    cwd: options.cwd,
    agentDir: options.agentDir,
    sessionManager: SessionManager.create(options.cwd),
  });

  const loadErrors = [
    ...runtime.diagnostics
      .filter((diagnostic) => diagnostic.type === "error")
      .map((diagnostic) => diagnostic.message),
    ...runtime.services.resourceLoader
      .getExtensions()
      .errors.map(({ path, error }) => `Failed to load extension "${path}": ${error}`),
  ];
  if (loadErrors.length > 0) {
    await runtime.dispose();
    throw new Error(loadErrors.join("\n"));
  }

  initTheme(runtime.services.settingsManager.getTheme(), true);
  await new InteractiveMode(runtime, {}).run();
}
