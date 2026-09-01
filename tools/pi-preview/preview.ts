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

import { installChildMock } from "./child-mock.ts";
import defaultScenario from "./default-scenario.ts";
import { MODEL_ID, PROVIDER_ID, registerMockProvider } from "./mock-provider.ts";
import { loadScenario } from "./scenario.ts";

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
  installChildMock(options.agentDir);

  const previewExtension: InlineExtension = {
    name: PROVIDER_ID,
    factory: (pi) => registerMockProvider(pi, turns),
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
