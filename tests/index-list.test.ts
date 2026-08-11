import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { listCanonMarkdown } from "../src/index/list.js";

describe("listCanonMarkdown", () => {
  let root: string;
  before(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-list-"));
    fs.mkdirSync(path.join(root, "docs", "canon", "future_plans"), {
      recursive: true,
    });
    fs.writeFileSync(path.join(root, "docs", "canon", "A.md"), "a");
    fs.writeFileSync(
      path.join(root, "docs", "canon", "future_plans", "b.md"),
      "b",
    );
    fs.writeFileSync(path.join(root, "docs", "canon", "skip.txt"), "x");
  });
  after(() => fs.rmSync(root, { recursive: true, force: true }));

  it("lists only .md under docs/canon with posix paths", () => {
    assert.deepEqual(listCanonMarkdown(root), [
      "docs/canon/A.md",
      "docs/canon/future_plans/b.md",
    ]);
  });
});
