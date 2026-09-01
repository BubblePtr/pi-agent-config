import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CHILD_EXTENSION_PATH = fileURLToPath(new URL("./child-extension.ts", import.meta.url));

type Settings = Record<string, unknown>;

/**
 * Add the child mock extension to pi's `extensions` setting without disturbing
 * anything else in the file — pi persists its own keys there (and pi-subagents
 * keeps a `subagents` block), and the preview re-seeds on every run.
 */
export function withChildMockExtension(settings: Settings, extensionPath: string): Settings {
  const current = settings.extensions;
  const extensions = Array.isArray(current) ? current.filter((entry) => entry !== extensionPath) : [];
  return { ...settings, extensions: [...extensions, extensionPath] };
}

/**
 * Make spawned pi children load the mock provider.
 *
 * A previewed extension can shell out to `pi` (pi-subagents does), and the child
 * inherits the parent's `pi-preview/mock` model name while knowing nothing about
 * the provider behind it. Seeding the preview's own isolated settings.json is
 * the extension-agnostic way in: any child that discovers ambient extensions
 * picks it up, and the file never leaves the throwaway agent dir.
 */
export function installChildMock(agentDir: string): void {
  const path = join(agentDir, "settings.json");
  let settings: Settings = {};
  try {
    settings = JSON.parse(readFileSync(path, "utf8")) as Settings;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new Error(`Could not read preview settings at ${path}: ${(error as Error).message}`);
    }
  }
  writeFileSync(path, `${JSON.stringify(withChildMockExtension(settings, CHILD_EXTENSION_PATH), null, 2)}\n`);
}
