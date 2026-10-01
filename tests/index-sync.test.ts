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

  it("repairs corruption that lands in the same mtime tick as the manifest", async () => {
    await syncCanonIndex(root);
    fs.writeFileSync(bm25IndexPath(root), "{not-json");
    // Pin the manifest mtime to the corrupt artifact's own mtime: the pair is no
    // longer "rewritten after the manifest", so only the recorded size can prove
    // tampering (before the size check this exact state was trusted as fresh).
    const bm25Stat = fs.statSync(bm25IndexPath(root));
    fs.utimesSync(indexManifestPath(root), bm25Stat.atime, bm25Stat.mtime);
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.ok(loadIndexPair(root).manifest.index_id);
  });

  it("records the bm25 artifact size in the manifest", async () => {
    await syncCanonIndex(root);
    const raw = JSON.parse(fs.readFileSync(indexManifestPath(root), "utf8"));
    assert.equal(raw.bm25_size, fs.statSync(bm25IndexPath(root)).size);
  });

  it("stays fresh when the bm25 is touched but its size still matches", async () => {
    await syncCanonIndex(root);
    const id = loadIndexPair(root).manifest.index_id;
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(bm25IndexPath(root), future, future);
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "fresh");
    assert.equal(loadIndexPair(root).manifest.index_id, id);
  });

  it("upgrades a bm25_size-less manifest once, then trusts it by stat", async () => {
    await syncCanonIndex(root);
    const manifestPath = indexManifestPath(root);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    delete manifest.bm25_size;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const first = await syncCanonIndex(root);
    assert.equal(first.status, "fresh");
    const upgraded = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(upgraded.bm25_size, fs.statSync(bm25IndexPath(root)).size);
    const before = fs.readFileSync(manifestPath, "utf8");
    const second = await syncCanonIndex(root);
    assert.equal(second.status, "fresh");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
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

  it("records size and mtime in the manifest for each doc", async () => {
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    const raw = JSON.parse(fs.readFileSync(indexManifestPath(root), "utf8"));
    const meta = raw.docs["docs/canon/a.md"];
    assert.equal(typeof meta.size, "number");
    assert.ok(meta.size > 0);
    assert.equal(typeof meta.mtime_ms, "number");
  });

  it("does not rebuild when only the mtime changed (content identical)", async () => {
    await syncCanonIndex(root);
    const doc = path.join(root, "docs/canon/a.md");
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(doc, future, future);
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "fresh");
  });

  it("rebuilds when bm25-index.json is missing", async () => {
    await syncCanonIndex(root);
    fs.rmSync(bm25IndexPath(root));
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.ok(fs.existsSync(bm25IndexPath(root)));
  });

  it("upgrades a stats-less manifest on a fresh sync (one-time rewrite)", async () => {
    await syncCanonIndex(root);
    // Strip stat fields to simulate a pre-stats manifest; the bm25 artifact is
    // left untouched, so the pair must stay consistent after the upgrade.
    const manifestPath = indexManifestPath(root);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    for (const meta of Object.values(manifest.docs)) {
      delete meta.size;
      delete meta.mtime_ms;
    }
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const before = fs.readFileSync(bm25IndexPath(root), "utf8");
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "fresh");
    const upgraded = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    const meta = upgraded.docs["docs/canon/a.md"];
    assert.equal(typeof meta.size, "number");
    assert.equal(typeof meta.mtime_ms, "number");
    assert.equal(fs.readFileSync(bm25IndexPath(root), "utf8"), before);
    assert.equal(upgraded.index_id, loadIndexPair(root).bm25.index_id);
  });
});
