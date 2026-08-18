// tests/code-index-config.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCodeIndexConfig } from "../src/code-index/config.js";
import { codeIndexConfigPath } from "../src/code-index/paths.js";

describe("loadCodeIndexConfig", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-config-"));
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("returns empty config when no file exists", () => {
    assert.deepEqual(loadCodeIndexConfig(root), {});
  });

  it("reads roots, ignore, languages", () => {
    fs.writeFileSync(
      codeIndexConfigPath(root),
      JSON.stringify({
        roots: ["src", "packages/app"],
        ignore: ["generated/**"],
        languages: { "src/gen": "typescript" },
      }),
    );
    assert.deepEqual(loadCodeIndexConfig(root), {
      roots: ["src", "packages/app"],
      ignore: ["generated/**"],
      languages: { "src/gen": "typescript" },
    });
  });

  it("throws on malformed JSON", () => {
    fs.writeFileSync(codeIndexConfigPath(root), "{not-json");
    assert.throws(() => loadCodeIndexConfig(root), /invalid code-index config/);
  });
});
