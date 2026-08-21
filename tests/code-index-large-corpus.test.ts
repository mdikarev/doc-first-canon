import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex } from "../src/code-search/search.js";

// A smoke test that a large corpus (~400k symbols ≈ 24 MB source) builds and
// searches via SQLite without materializing a single giant JSON string — a
// regression guard for the storage swap from a monolithic JSON artifact to the
// embedded SQLite store. It does not attempt to cross V8's ~512 MB max-string
// limit; it only asserts the build completes and search returns the top hit.
describe("large corpus", () => {
  it("builds and searches a large corpus via SQLite without a giant JSON string", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-large-"));
    try {
      fs.mkdirSync(path.join(repo, ".git"));
      fs.writeFileSync(path.join(repo, "package.json"), "{}");
      const n = 400_000; // ~400k symbols; ~60 bytes each => ~24 MB source text
      const chunks: string[] = [];
      for (let i = 0; i < n; i++) {
        chunks.push(`export function uniqueFn${i}() { return ${i}; }`);
        if (chunks.length === 50_000) {
          fs.appendFileSync(path.join(repo, "src.ts"), chunks.join("\n") + "\n");
          chunks.length = 0;
        }
      }
      fs.appendFileSync(path.join(repo, "src.ts"), chunks.join("\n") + "\n");
      await syncCodeIndex(repo);
      assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.sqlite")));
      assert.ok(!fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.json")));
      const pack = searchCodeIndex(repo, "uniqueFn399999");
      assert.equal(pack.hits[0]?.name, "uniqueFn399999");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
