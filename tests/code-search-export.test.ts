import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("doc-canon/code-search export", () => {
  it("is declared in package.json exports", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.exports["./code-search"], "./dist/code-search/search.js");
  });

  it("builds to a dist entry", async () => {
    const { stat } = await import("node:fs/promises");
    const entry = await stat(join(root, "dist", "code-search", "search.js"));
    assert.ok(entry.isFile());
  });
});
