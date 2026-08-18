// tests/code-index-sync.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexPair, tryLoadCodeIndexManifest } from "../src/code-index/io.js";
import { openCodeIndex } from "../src/code-index/reader.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-sync-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

const SOURCE = `export type Handle = { score(q: string): number };
export class Reader { score(q: string): number { return 1; } }
export function openReader(): Reader { return new Reader(); }`;

describe("syncCodeIndex", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds both artifacts and opens via reader", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.index_fingerprint, pair.ast.index_fingerprint);
    assert.equal(pair.manifest.roots.length, 1);
    assert.equal(pair.manifest.files["src/reader.ts"].language, "typescript");
    assert.ok(pair.manifest.files["src/reader.ts"].symbols > 0);
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "Reader"));
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const manifest1 = JSON.stringify(pair1.manifest);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.manifest), manifest1);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("returns fresh and does not rewrite when unchanged", async () => {
    await syncCodeIndex(repo);
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const before = fs.readFileSync(manifestPath, "utf8");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "fresh");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
  });

  it("rebuilds on edit", async () => {
    await syncCodeIndex(repo);
    write(repo, "src/reader.ts", SOURCE + "\nexport const extra = 1;");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.ok(r.changed.includes("src/reader.ts"));
  });

  it("rebuilds on delete", async () => {
    await syncCodeIndex(repo);
    fs.unlinkSync(path.join(repo, "src/reader.ts"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 0);
  });

  it("works on a repo without package.json (extension fallback)", async () => {
    fs.unlinkSync(path.join(repo, "package.json"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
  });
});
