// tests/code-index-dogfood.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexPair } from "../src/code-index/io.js";
import { openCodeIndex } from "../src/code-index/reader.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-dogfood-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("code-index integration (dogfood)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    // root package.json (monorepo root)
    write(repo, "package.json", "{}");
    // code outside src/
    write(repo, "lib/util.ts", "export function util(): number { return 1; }");
    // nested workspace
    write(repo, "packages/core/package.json", "{}");
    write(repo, "packages/core/index.ts", 'import { util } from "../../lib/util";\nexport const core = util();');
    // ignored generated dir
    write(repo, "dist/bundle.js", "console.log(1);");
    // .js file in an ignored node_modules
    write(repo, "node_modules/x/index.js", "module.exports = 1;");
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("indexes both roots, ignores generated/vendored, resolves cross-root import", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 2);
    const pair = loadCodeIndexPair(repo);
    assert.deepEqual(pair.manifest.roots, ["", "packages/core"]);
    assert.equal(pair.manifest.files["dist/bundle.js"], undefined);
    assert.equal(pair.manifest.files["node_modules/x/index.js"], undefined);
    const handle = openCodeIndex(repo);
    const importRefs = handle
      .references()
      .filter((ref) => ref.kind === "import" && ref.from === "packages/core/index.ts");
    assert.ok(
      importRefs.some((ref) => ref.to === "lib/util.ts" && ref.name === "util"),
    );
  });

  it("grammar_versions bump forces rebuild with unchanged files", async () => {
    await syncCodeIndex(repo);
    // Simulate a grammar upgrade by patching the written manifest's grammar_versions.
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.grammar_versions = { ...manifest.grammar_versions, javascript: "9.9.9" };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    const after = loadCodeIndexPair(repo);
    assert.equal(after.manifest.grammar_versions.javascript, "0.25.0");
  });
});
