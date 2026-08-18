import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Bm25Index } from "../src/index/bm25.js";

describe("Bm25Index", () => {
  it("ranks the doc that contains the query term higher", () => {
    const idx = Bm25Index.build(
      [
        { path: "a.md", text: "alpha alpha beta" },
        { path: "b.md", text: "gamma delta" },
      ],
      "id-1",
    );
    const hits = idx.score("alpha");
    assert.equal(hits[0]?.path, "a.md");
    assert.ok((hits[0]?.score ?? 0) > 0);
  });

  it("sums unique query terms and tie-breaks by path", () => {
    const idx = Bm25Index.build(
      [
        { path: "b.md", text: "shared" },
        { path: "a.md", text: "shared" },
      ],
      "id-2",
    );
    const hits = idx.score("shared shared");
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.path, "a.md");
    assert.equal(hits[0]?.score, hits[1]?.score);
  });

  it("returns [] for empty query", () => {
    const idx = Bm25Index.build([{ path: "a.md", text: "alpha" }], "id-3");
    assert.deepEqual(idx.score("   "), []);
  });

  it("round-trips through JSON including index_id", () => {
    const idx = Bm25Index.build(
      [{ path: "a.md", text: "canon index" }],
      "uuid-x",
    );
    const again = Bm25Index.fromJSON(idx.toJSON());
    assert.equal(again.toJSON().index_id, "uuid-x");
    assert.equal(again.documentCount(), 1);
    assert.equal(again.score("canon")[0]?.path, "a.md");
  });

  it("builds empty index", () => {
    const idx = Bm25Index.build([], "empty");
    assert.equal(idx.documentCount(), 0);
    assert.deepEqual(idx.score("anything"), []);
  });

  it("heading tokens outrank body-only tokens", () => {
    const idx = Bm25Index.build(
      [
        { path: "a.md", text: "# Index\n\nword" },
        { path: "b.md", text: "index index index" },
      ],
      "id-head",
    );
    const hits = idx.score("index");
    assert.equal(hits[0]?.path, "a.md");
  });

  it("future_plans docs are downweighted", () => {
    const idx = Bm25Index.build(
      [
        { path: "future_plans/p1.md", text: "shared topic" },
        { path: "living.md", text: "shared topic" },
      ],
      "id-live",
    );
    const hits = idx.score("shared");
    assert.equal(hits[0]?.path, "living.md");
  });

  it("serializes schema_version 2 with heading_terms", () => {
    const idx = Bm25Index.build(
      [{ path: "a.md", text: "# Title\n\nbody" }],
      "id-schema",
    );
    const state = idx.toJSON();
    assert.equal(state.schema_version, 2);
    assert.ok(Array.isArray(state.heading_terms?.["a.md"]));
  });
});
