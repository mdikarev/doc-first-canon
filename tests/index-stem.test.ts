import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stem } from "../src/index/stem.js";

describe("stem", () => {
  it("collapses English inflectional forms", () => {
    const stems = ["index", "indexes", "indexed", "indexing"].map(stem);
    assert.deepEqual(stems, ["index", "index", "index", "index"]);
  });
  it("ies -> y", () => {
    assert.equal(stem("babies"), "baby");
    assert.equal(stem("stories"), "story");
  });
  it("does not over-strip short results", () => {
    assert.equal(stem("uses"), "uses");
    assert.equal(stem("goes"), "goes");
  });
  it("collapses Russian inflectional forms", () => {
    const stems = ["индекса", "индексу", "индексом", "индексами"].map(stem);
    assert.deepEqual(stems, ["индекс", "индекс", "индекс", "индекс"]);
  });
  it("leaves short tokens unchanged", () => {
    assert.equal(stem("и"), "и");
    assert.equal(stem("a"), "a");
  });
  it("is deterministic", () => {
    assert.equal(stem("indexing"), stem("indexing"));
  });
});
