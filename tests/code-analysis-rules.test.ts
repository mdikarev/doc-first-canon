import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { embeddedRoot } from "../src/paths.js";
import { copyManagedAssets } from "../src/scaffold/copy-managed.js";

function readEmbedded(...parts: string[]): string {
  const p = join(embeddedRoot(), ...parts);
  assert.equal(existsSync(p), true, `missing embedded asset: ${parts.join("/")}`);
  return readFileSync(p, "utf8");
}

describe("code analysis rules", () => {
  it("ships code-index-first rule in AGENTS block and pointer rule", () => {
    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /code-index search/);
    assert.match(block, /code_miss/);

    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /## Code analysis order/);
    assert.match(rule, /code-index search/);
    assert.match(rule, /code_miss/);
  });
});
