import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationWindow, centeredWindow } from "../src/code-search/snippets.js";

describe("declarationWindow", () => {
  const content = ["a", "b", "c", "d", "e"].join("\n");

  it("returns declaration lines capped at snippetLines", () => {
    assert.deepEqual(declarationWindow(content, 2, 5, 3), {
      start_line: 2,
      text: ["b", "c", "d"].join("\n"),
    });
  });

  it("returns null when line is past the file end", () => {
    assert.equal(declarationWindow(content, 9, 12, 4), null);
  });

  it("clamps to the file end", () => {
    assert.deepEqual(declarationWindow(content, 4, 99, 4), {
      start_line: 4,
      text: ["d", "e"].join("\n"),
    });
  });
});

describe("centeredWindow", () => {
  const content = ["a", "b", "c", "d", "e"].join("\n");

  it("centers the window on the line", () => {
    assert.deepEqual(centeredWindow(content, 3, 3), {
      start_line: 2,
      text: ["b", "c", "d"].join("\n"),
    });
  });

  it("clamps to the top of the file", () => {
    assert.deepEqual(centeredWindow(content, 1, 3), {
      start_line: 1,
      text: ["a", "b", "c"].join("\n"),
    });
  });

  it("clamps to the bottom of the file", () => {
    assert.deepEqual(centeredWindow(content, 5, 3), {
      start_line: 3,
      text: ["c", "d", "e"].join("\n"),
    });
  });
});
