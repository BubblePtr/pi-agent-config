import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

describe("pi-agent-config package", () => {
  it("is discoverable as a pi-package", () => {
    assert.ok(pkg.keywords.includes("pi-package"));
    assert.ok(pkg.pi);
    assert.ok(Array.isArray(pkg.pi.extensions));
  });

  it("ships the preset files the extension reads", () => {
    assert.equal(existsSync(join(root, "AGENTS.md")), true);
    assert.equal(existsSync(join(root, "defaults.json")), true);
    assert.equal(existsSync(join(root, "extensions/defaults.ts")), true);
  });

  it("declares existing resources after npm install", () => {
    const missing = [];
    for (const key of ["extensions", "skills", "prompts"]) {
      for (const rel of pkg.pi[key] ?? []) {
        if (!existsSync(join(root, rel))) missing.push(`${key}: ${rel}`);
      }
    }
    assert.deepEqual(
      missing,
      [],
      `pi manifest paths missing (run npm install): ${missing.join(", ")}`,
    );
  });
});
