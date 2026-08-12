import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCanonIndex } from "../src/index/sync.js";
import { searchCanon, SearchError } from "../src/search/search.js";

describe("searchCanon", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-search-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "# Retrieval\n\ncanon search pack\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("throws empty_query on whitespace", () => {
    assert.throws(() => searchCanon(root, "  "), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal(e.code, "empty_query");
      return true;
    });
  });

  it("throws index_unavailable when missing", () => {
    assert.throws(() => searchCanon(root, "canon"), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal(e.code, "index_unavailable");
      assert.match(e.message, /doc-canon index/);
      return true;
    });
  });

  it("returns fresh hits after sync", async () => {
    await syncCanonIndex(root);
    const pack = searchCanon(root, "retrieval");
    assert.equal(pack.freshness, "fresh");
    assert.deepEqual(pack.warnings, []);
    assert.ok(pack.hits.length >= 1);
    assert.equal(pack.hits[0]!.path, "docs/canon/a.md");
    assert.ok(pack.hits[0]!.snippets.length >= 1);
  });

  it("warns stale but still returns hits", async () => {
    await syncCanonIndex(root);
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "# Retrieval\n\ncanon search pack changed\n",
    );
    const pack = searchCanon(root, "retrieval");
    assert.equal(pack.freshness, "stale");
    assert.ok(pack.warnings.includes("index_stale"));
    assert.ok(pack.hits.length >= 1);
  });

  it("returns empty hits for unknown terms", async () => {
    await syncCanonIndex(root);
    const pack = searchCanon(root, "zzznomatchzzz");
    assert.equal(pack.freshness, "fresh");
    assert.deepEqual(pack.hits, []);
  });

  it("skips hits whose files disappeared", async () => {
    fs.writeFileSync(path.join(root, "docs", "canon", "b.md"), "orphan term xyzzy");
    await syncCanonIndex(root);
    fs.rmSync(path.join(root, "docs", "canon", "b.md"));
    const pack = searchCanon(root, "xyzzy");
    assert.ok(!pack.hits.some((h) => h.path.endsWith("b.md")));
  });

  it("respects maxHits", async () => {
    fs.writeFileSync(path.join(root, "docs", "canon", "b.md"), "retrieval two");
    await syncCanonIndex(root);
    const pack = searchCanon(root, "retrieval", { maxHits: 1 });
    assert.equal(pack.hits.length, 1);
  });
});
