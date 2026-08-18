import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tokenize } from "../src/index/tokenize.js";

describe("tokenize", () => {
  it("lowercases and splits on non letter/digit", () => {
    assert.deepEqual(tokenize("Hello, BM25!"), ["hello", "bm25"]);
  });
  it("keeps non-ASCII letters", () => {
    assert.deepEqual(tokenize("Канон-тест"), ["канон", "тест"]);
  });
  it("returns empty array for empty/separators", () => {
    assert.deepEqual(tokenize("   "), []);
    assert.deepEqual(tokenize("---"), []);
  });
  it("stems tokens identically for index and query", () => {
    assert.deepEqual(tokenize("Indexing indexed indexes"), ["index", "index", "index"]);
  });
});
