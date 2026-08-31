#!/usr/bin/env bun
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

const USAGE = `Usage: bun tools/pi-preview/cli.ts <extension-entry> [--scenario <file>]

Starts a real pi TUI with a scripted mock model so extension UI can be previewed
without spending inference. See tools/pi-preview/README.md.`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    scenario: { type: "string" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help || positionals.length !== 1) {
  console.log(USAGE);
  process.exit(values.help ? 0 : 1);
}

// Redirect every pi side effect (sessions, settings.json, auth.json) away from
// ~/.pi/agent, and block startup network calls. Set before the dynamic import
// below so no module in the SDK can capture the real values at load time.
const agentDir = join(tmpdir(), "pi-preview-agent");
mkdirSync(agentDir, { recursive: true });
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_OFFLINE = "1";

const { runPreview } = await import("./preview.ts");

try {
  await runPreview({
    extensionPath: resolve(positionals[0]),
    scenarioPath: values.scenario ? resolve(values.scenario) : undefined,
    cwd: process.cwd(),
    agentDir,
  });
} catch (error) {
  // A bad scenario or extension is the normal failure here; a stack trace would
  // only bury the message that says which one.
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
