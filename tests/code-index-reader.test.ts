// tests/code-index-reader.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { openCodeIndex } from "../src/code-index/reader.js";
import { codeAstIndexPath, codeIndexManifestPath } from "../src/code-index/paths.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-reader-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("openCodeIndex", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", "export class Reader { score(): number { return 1; } }");
    write(repo, "src/main.ts", 'import { Reader } from "./reader";\nexport const r: Reader = new Reader();');
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("exposes symbols and references after sync", async () => {
    await syncCodeIndex(repo);
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "Reader" && s.kind === "class"));
    assert.ok(handle.references().some((r) => r.kind === "import" && r.to === "src/reader.ts"));
  });

  it("liveHashes matches manifest hashes when unchanged", async () => {
    await syncCodeIndex(repo);
    const handle = openCodeIndex(repo);
    const live = handle.liveHashes();
    for (const [rel, meta] of Object.entries(handle.manifest.files)) {
      assert.equal(live[rel], meta.hash);
    }
  });

  it("liveHashes detects a content edit (stale)", async () => {
    await syncCodeIndex(repo);
    const handle = openCodeIndex(repo);
    fs.writeFileSync(
      path.join(repo, "src/reader.ts"),
      "export class Reader { score(): number { return 2; } }",
    );
    const live = handle.liveHashes();
    assert.notEqual(live["src/reader.ts"], handle.manifest.files["src/reader.ts"]?.hash);
  });

  it("throws when the pair is missing", () => {
    assert.throws(() => openCodeIndex(repo), /not found/);
  });

  it("throws when the pair is corrupt", async () => {
    await syncCodeIndex(repo);
    fs.writeFileSync(codeAstIndexPath(repo), JSON.stringify({ schema_version: 1 }));
    assert.throws(() => openCodeIndex(repo), /invalid/i);
  });
});
