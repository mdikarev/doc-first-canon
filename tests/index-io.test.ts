import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  loadIndexPair,
  saveIndexPair,
  tryLoadManifest,
} from "../src/index/io.js";
import type { Bm25State, IndexManifest } from "../src/index/types.js";

describe("index io", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-io-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  const manifest = (id: string): IndexManifest => ({
    schema_version: 1,
    index_id: id,
    built_at: "2026-08-11T00:00:00.000Z",
    corpus: "docs/canon/**",
    docs: { "docs/canon/a.md": { hash: "sha256:aa", token_count: 1 } },
  });
  const bm25 = (id: string): Bm25State => ({
    schema_version: 1,
    index_id: id,
    postings: { "docs/canon/a.md": { alpha: 1 } },
    doc_lengths: { "docs/canon/a.md": 1 },
  });

  it("round-trips a matching pair", () => {
    saveIndexPair(root, manifest("id-1"), bm25("id-1"));
    const loaded = loadIndexPair(root);
    assert.equal(loaded.manifest.index_id, "id-1");
    assert.equal(loaded.bm25.index_id, "id-1");
  });

  it("rejects index_id mismatch", () => {
    saveIndexPair(root, manifest("id-1"), bm25("id-1"));
    const p = path.join(root, ".doc-canon", "bm25-index.json");
    const raw = JSON.parse(fs.readFileSync(p, "utf8")) as Bm25State;
    raw.index_id = "other";
    fs.writeFileSync(p, JSON.stringify(raw));
    assert.throws(() => loadIndexPair(root), /index_id/);
  });

  it("rejects structurally corrupt artifacts with matching schema versions", () => {
    saveIndexPair(root, manifest("id-1"), bm25("id-1"));
    fs.writeFileSync(
      path.join(root, ".doc-canon", "bm25-index.json"),
      JSON.stringify({ schema_version: 1, index_id: "id-1", postings: [], doc_lengths: {} }),
    );

    assert.throws(() => loadIndexPair(root), /invalid bm25/);
  });

  it("tryLoadManifest returns null when missing", () => {
    assert.equal(tryLoadManifest(root), null);
  });
});
