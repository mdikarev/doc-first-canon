import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateCanon } from "../src/validate/validate.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const fixture = (name: string): string => join(testsDir, "fixtures", name);

describe("validateCanon", () => {
  it("accepts a complete canon", () => {
    assert.deepEqual(validateCanon(fixture("happy-canon")), {
      ok: true,
      errors: [],
      warnings: [],
    });
  });

  it("rejects a missing required section", () => {
    const result = validateCanon(fixture("missing-section"));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /missing required section.*OVERVIEW\.md/i);
  });

  it("rejects a section missing template headings", () => {
    const result = validateCanon(fixture("missing-headings"));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /OVERVIEW\.md.*missing required headings.*Scope/i);
  });

  it("rejects INDEX paths that disagree with the contract", () => {
    const result = validateCanon(fixture("index-mismatch"));
    assert.equal(result.ok, false);
    assert.match(result.errors.join("\n"), /INDEX.*OVERVIEW\.md/i);
  });
});

describe("doc-canon validate", () => {
  it("uses --root and exits according to validation", () => {
    const valid = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "validate", "--root", fixture("happy-canon")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(valid.status, 0, valid.stderr);
    assert.match(valid.stdout, /valid/i);

    const invalid = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "validate", "--root", fixture("missing-section")],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /OVERVIEW\.md/i);
  });
});
