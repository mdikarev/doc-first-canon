import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  HARNESSES,
  detectInstalledHarnesses,
  parseHarnesses,
} from "../src/scaffold/harnesses.js";

describe("parseHarnesses", () => {
  it("parses a comma-separated list", () => {
    assert.deepEqual(parseHarnesses("cursor,claude,dsh"), [
      "cursor",
      "claude",
      "dsh",
    ]);
  });

  it("trims whitespace and deduplicates", () => {
    assert.deepEqual(parseHarnesses(" cursor , dsh, dsh "), ["cursor", "dsh"]);
  });

  it("accepts a single harness", () => {
    assert.deepEqual(parseHarnesses("dsh"), ["dsh"]);
  });

  it("fails closed on an empty value", () => {
    assert.throws(() => parseHarnesses(undefined), /--harnesses requires/);
    assert.throws(() => parseHarnesses(""), /--harnesses requires/);
    assert.throws(() => parseHarnesses("  , "), /--harnesses requires/);
  });

  it("fails closed on unknown harness names", () => {
    assert.throws(() => parseHarnesses("copilot"), /Unknown harness name/);
    assert.throws(
      () => parseHarnesses("cursor,copilot"),
      /Unknown harness name.*Accepted values: cursor, claude, dsh/,
    );
  });
});

describe("detectInstalledHarnesses", () => {
  it("detects only the skill roots present on disk", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-harness-detect-"));
    try {
      mkdirSync(join(root, ".cursor", "skills"), { recursive: true });
      mkdirSync(join(root, ".dsh", "skills"), { recursive: true });
      assert.deepEqual(detectInstalledHarnesses(root), ["cursor", "dsh"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns an empty list for a bare repo", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-harness-empty-"));
    try {
      assert.deepEqual(detectInstalledHarnesses(root), []);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exports the canonical harness order", () => {
    assert.deepEqual([...HARNESSES], ["cursor", "claude", "dsh"]);
  });
});
