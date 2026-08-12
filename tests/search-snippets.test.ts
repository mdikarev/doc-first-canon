// tests/search-snippets.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSnippetWindows } from "../src/search/snippets.js";

describe("extractSnippetWindows", () => {
  it("returns empty when query has no tokens", () => {
    assert.deepEqual(
      extractSnippetWindows("alpha beta", "   ", { snippetLines: 3, maxWindows: 2 }),
      [],
    );
  });

  it("centers a window on the matching line", () => {
    const content = ["a", "b", "match here", "d", "e"].join("\n");
    const windows = extractSnippetWindows(content, "match", {
      snippetLines: 3,
      maxWindows: 2,
    });
    assert.equal(windows.length, 1);
    assert.equal(windows[0]!.start_line, 2);
    assert.equal(windows[0]!.text, ["b", "match here", "d"].join("\n"));
  });

  it("returns up to maxWindows non-overlapping matches", () => {
    const content = ["x", "foo", "y", "z", "foo", "w"].join("\n");
    const windows = extractSnippetWindows(content, "foo", {
      snippetLines: 1,
      maxWindows: 2,
    });
    assert.equal(windows.length, 2);
    assert.equal(windows[0]!.start_line, 2);
    assert.equal(windows[1]!.start_line, 5);
  });

  it("clamps to file bounds", () => {
    const content = "only";
    const windows = extractSnippetWindows(content, "only", {
      snippetLines: 5,
      maxWindows: 1,
    });
    assert.equal(windows[0]!.start_line, 1);
    assert.equal(windows[0]!.text, "only");
  });
});
