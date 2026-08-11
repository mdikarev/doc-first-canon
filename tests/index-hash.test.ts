import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { contentHash } from "../src/index/hash.js";

describe("contentHash", () => {
  it("is stable for the same content", () => {
    assert.equal(contentHash("hello"), contentHash("hello"));
  });
  it("changes when content changes", () => {
    assert.notEqual(contentHash("hello"), contentHash("hello!"));
  });
  it("uses sha256: prefix", () => {
    assert.match(contentHash("x"), /^sha256:[0-9a-f]{64}$/);
  });
});
