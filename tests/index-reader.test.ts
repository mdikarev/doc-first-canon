import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCanonIndex } from "../src/index/sync.js";
import { openCanonIndex } from "../src/index/reader.js";
import { bm25IndexPath } from "../src/index/paths.js";
import type { Bm25State } from "../src/index/types.js";

describe("openCanonIndex", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-reader-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "retrieval canon");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("scores after sync", async () => {
    await syncCanonIndex(root);
    const idx = openCanonIndex(root);
    assert.equal(idx.score("retrieval")[0]?.path, "docs/canon/a.md");
    assert.ok(idx.manifest.docs["docs/canon/a.md"]?.hash);
  });

  it("throws when missing", () => {
    assert.throws(() => openCanonIndex(root));
  });

  it("throws on index_id mismatch", async () => {
    await syncCanonIndex(root);
    const p = bm25IndexPath(root);
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Bm25State;
    raw.index_id = "mismatch";
    fs.writeFileSync(p, JSON.stringify(raw));
    assert.throws(() => openCanonIndex(root), /index_id/);
  });

  it("liveHashes reflects current files", async () => {
    await syncCanonIndex(root);
    const idx = openCanonIndex(root);
    const live = idx.liveHashes();
    assert.equal(
      live["docs/canon/a.md"],
      idx.manifest.docs["docs/canon/a.md"]?.hash,
    );
  });

  it("liveHashes still matches the manifest when only mtime changed", async () => {
    await syncCanonIndex(root);
    const idx = openCanonIndex(root);
    const doc = path.join(root, "docs/canon/a.md");
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(doc, future, future);
    const live = idx.liveHashes();
    assert.equal(
      live["docs/canon/a.md"],
      idx.manifest.docs["docs/canon/a.md"]?.hash,
    );
  });

  it("liveHashes detects a content edit (stale)", async () => {
    await syncCanonIndex(root);
    const idx = openCanonIndex(root);
    fs.writeFileSync(path.join(root, "docs/canon/a.md"), "retrieval canon changed");
    const live = idx.liveHashes();
    assert.notEqual(
      live["docs/canon/a.md"],
      idx.manifest.docs["docs/canon/a.md"]?.hash,
    );
  });
});
