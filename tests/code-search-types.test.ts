import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CodeSearchError } from "../src/code-search/types.js";

describe("CodeSearchError", () => {
  it("is an Error carrying a code", () => {
    const e = new CodeSearchError("empty_query", "query must be non-empty");
    assert.ok(e instanceof Error);
    assert.equal(e.name, "CodeSearchError");
    assert.equal(e.code, "empty_query");
    assert.equal(e.message, "query must be non-empty");
  });

  it("accepts the fail-closed code", () => {
    const e = new CodeSearchError(
      "code_index_missing",
      "code index missing (detail); run: doc-canon code-index build",
    );
    assert.equal(e.code, "code_index_missing");
  });
});
