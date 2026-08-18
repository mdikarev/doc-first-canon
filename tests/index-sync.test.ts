import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCanonIndex } from "../src/index/sync.js";
import { bm25IndexPath, indexManifestPath } from "../src/index/paths.js";
import { loadIndexPair } from "../src/index/io.js";
import { openCanonIndex } from "../src/index/reader.js";

function writeCanon(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("syncCanonIndex", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-sync-"));
    writeCanon(root, "docs/canon/a.md", "alpha beta");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("creates both artifacts with matching index_id", async () => {
    const first = await syncCanonIndex(root);
    assert.equal(first.status, "updated");
    assert.equal(first.indexed, 1);
    assert.ok(fs.existsSync(indexManifestPath(root)));
    assert.ok(fs.existsSync(bm25IndexPath(root)));
    const pair = loadIndexPair(root);
    assert.equal(pair.manifest.index_id, pair.bm25.index_id);
  });

  it("returns fresh without rewriting when unchanged", async () => {
    await syncCanonIndex(root);
    const before = fs.readFileSync(indexManifestPath(root), "utf8");
    const second = await syncCanonIndex(root);
    assert.equal(second.status, "fresh");
    assert.equal(fs.readFileSync(indexManifestPath(root), "utf8"), before);
  });

  it("writes and opens an empty corpus, then returns fresh", async () => {
    fs.unlinkSync(path.join(root, "docs/canon/a.md"));

    const first = await syncCanonIndex(root);
    assert.equal(first.status, "updated");
    assert.equal(first.indexed, 0);
    assert.ok(fs.existsSync(indexManifestPath(root)));
    assert.ok(fs.existsSync(bm25IndexPath(root)));
    const pair = loadIndexPair(root);
    assert.equal(pair.manifest.index_id, pair.bm25.index_id);
    assert.deepEqual(openCanonIndex(root).score("anything"), []);

    const second = await syncCanonIndex(root);
    assert.equal(second.status, "fresh");
  });

  it("rebuilds on edit with new index_id", async () => {
    await syncCanonIndex(root);
    const id1 = loadIndexPair(root).manifest.index_id;
    writeCanon(root, "docs/canon/a.md", "alpha beta gamma");
    const third = await syncCanonIndex(root);
    assert.equal(third.status, "updated");
    assert.ok(third.changed.includes("docs/canon/a.md"));
    assert.notEqual(loadIndexPair(root).manifest.index_id, id1);
  });

  it("removes deleted paths", async () => {
    writeCanon(root, "docs/canon/b.md", "only b");
    await syncCanonIndex(root);
    fs.unlinkSync(path.join(root, "docs/canon/b.md"));
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.ok(r.changed.includes("docs/canon/b.md"));
    assert.equal(loadIndexPair(root).manifest.docs["docs/canon/b.md"], undefined);
  });

  it("repairs corrupt bm25 on next sync", async () => {
    await syncCanonIndex(root);
    fs.writeFileSync(bm25IndexPath(root), "{not-json");
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.ok(loadIndexPair(root).manifest.index_id);
  });

  it("tokenizer_version bump forces rebuild with unchanged files", async () => {
    await syncCanonIndex(root);
    const manifestPath = indexManifestPath(root);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.tokenizer_version = "2";
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.equal(loadIndexPair(root).manifest.tokenizer_version, "1");
  });
});
