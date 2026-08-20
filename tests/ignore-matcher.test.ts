// tests/ignore-matcher.test.ts
// Characterization tests for the ignore matcher (fix 1): the compiled-matcher
// implementation must produce exactly the same verdicts as the previous
// per-entry micromatch.isMatch checks, including normalization and custom globs.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createIgnoreMatcher,
  isIgnored,
} from "../src/agnostic/ignore.js";

describe("isIgnored (compiled matcher)", () => {
  it("ignores default-excluded roots at any depth", () => {
    const paths = [
      "node_modules/a/b.js",
      "src/node_modules/a.js",
      "dist/out.js",
      "build/x.js",
      ".git/config",
      ".doc-canon/index-manifest.json",
      ".worktrees/w/src/a.ts",
      "a/b/.worktrees/c/d.ts",
      "packages/core/node_modules/x/index.js",
    ];
    for (const p of paths) {
      assert.equal(isIgnored(p, []), true, `expected ignored: ${p}`);
    }
  });

  it("does not ignore normal source paths", () => {
    const paths = [
      "src/a.ts",
      "docs/canon/OVERVIEW.md",
      "tests/x.test.ts",
      "package.json",
      "packages/core/index.ts",
      "node_modulesx/a.js",
    ];
    for (const p of paths) {
      assert.equal(isIgnored(p, []), false, `expected not ignored: ${p}`);
    }
  });

  it("honors custom ignoreGlobs in addition to defaults", () => {
    assert.equal(isIgnored("coverage/lcov.info", ["coverage/**"]), true);
    assert.equal(isIgnored("src/gen.ts", ["**/gen.ts"]), true);
    assert.equal(isIgnored("src/a.ts", ["coverage/**"]), false);
  });

  it("normalizes separators and leading ./", () => {
    assert.equal(isIgnored("node_modules\\x\\y.js", []), true);
    assert.equal(isIgnored("./src/a.ts", []), false);
    assert.equal(isIgnored("./node_modules/a.js", []), true);
  });

  it("createIgnoreMatcher agrees with isIgnored", () => {
    const matcher = createIgnoreMatcher(["coverage/**"]);
    assert.equal(
      matcher("coverage/lcov.info"),
      isIgnored("coverage/lcov.info", ["coverage/**"]),
    );
    assert.equal(matcher("src/a.ts"), isIgnored("src/a.ts", ["coverage/**"]));
    assert.equal(
      matcher("node_modules/x/a.js"),
      isIgnored("node_modules/x/a.js", ["coverage/**"]),
    );
  });
});
