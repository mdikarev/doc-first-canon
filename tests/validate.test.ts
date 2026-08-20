import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateCanon } from "../src/validate/validate.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const fixture = (name: string): string => join(testsDir, "fixtures", name);

function temporaryHappyCanon(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-"));
  cpSync(fixture("happy-canon"), root, { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

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

  it("rejects section paths that escape the canon root", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const contractFile = join(root, "docs", "canon", "CANON_CONTRACT.md");
      writeFileSync(
        contractFile,
        readFileSync(contractFile, "utf8").replace(
          "path: OVERVIEW.md",
          "path: ../outside.md",
        ),
      );
      writeFileSync(join(root, "docs", "outside.md"), "# Outside\n");

      const result = validateCanon(root);

      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /section.*\.\.\/outside\.md.*outside.*canon/i);
    } finally {
      cleanup();
    }
  });

  it("rejects section symlinks that escape the canon root", (context) => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const sectionFile = join(root, "docs", "canon", "OVERVIEW.md");
      const outsideFile = join(root, "outside.md");
      writeFileSync(outsideFile, readFileSync(sectionFile, "utf8"));
      unlinkSync(sectionFile);
      try {
        symlinkSync(outsideFile, sectionFile);
      } catch (error) {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        if (["EPERM", "EACCES", "ENOTSUP"].includes(code)) {
          context.skip(`symlink creation unsupported: ${code}`);
          return;
        }
        throw error;
      }

      const result = validateCanon(root);

      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /section.*OVERVIEW\.md.*outside.*canon/i);
    } finally {
      cleanup();
    }
  });

  it("rejects malformed skills_stamp values", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const contractFile = join(root, "docs", "canon", "CANON_CONTRACT.md");
      writeFileSync(
        contractFile,
        readFileSync(contractFile, "utf8").replace(
          'skills_stamp: "0.1.0"',
          'skills_stamp: "1.x"',
        ),
      );

      const result = validateCanon(root);

      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /skills_stamp.*1\.x.*dotted.*numeric/i);
    } finally {
      cleanup();
    }
  });

  it("rejects a section path that is not a file", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const sectionFile = join(root, "docs", "canon", "OVERVIEW.md");
      unlinkSync(sectionFile);
      mkdirSync(sectionFile);

      const result = validateCanon(root);

      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /OVERVIEW\.md.*not a file/i);
    } finally {
      cleanup();
    }
  });

  it("warns only above the exact max_lines boundary", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const canonRoot = join(root, "docs", "canon");
      const contractFile = join(canonRoot, "CANON_CONTRACT.md");
      const sectionFile = join(canonRoot, "OVERVIEW.md");
      const exactBoundary = readFileSync(
        join(canonRoot, "templates", "OVERVIEW.md"),
        "utf8",
      );
      writeFileSync(
        contractFile,
        readFileSync(contractFile, "utf8").replace("max_lines: 400", "max_lines: 9"),
      );
      writeFileSync(sectionFile, exactBoundary);

      const exact = validateCanon(root);
      assert.doesNotMatch(exact.warnings.join("\n"), /OVERVIEW\.md.*max_lines/i);

      writeFileSync(sectionFile, `${exactBoundary}extra line\n`);
      const above = validateCanon(root);
      assert.match(above.warnings.join("\n"), /OVERVIEW\.md.*max_lines 9/i);
    } finally {
      cleanup();
    }
  });

  it("warns on lines longer than max_line_length, skipping tables and code blocks", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const canonRoot = join(root, "docs", "canon");
      const contractFile = join(canonRoot, "CANON_CONTRACT.md");
      const sectionFile = join(canonRoot, "OVERVIEW.md");
      writeFileSync(
        contractFile,
        readFileSync(contractFile, "utf8").replace(
          "max_lines: 400",
          "max_lines: 400\n  max_line_length: 50",
        ),
      );

      writeFileSync(
        sectionFile,
        [
          "# Overview",
          "",
          "## Purpose",
          "",
          "this line is longer than fifty characters by a wide margin",
          "",
          "| a | b |",
          "| --- | --- |",
          "| this table row is also longer than fifty characters but exempt | x |",
          "",
          "```text",
          "this code block line is longer than fifty characters but exempt",
          "```",
        ].join("\n"),
      );

      const result = validateCanon(root);
      const warning = result.warnings.find((w) =>
        w.includes("max_line_length 50"),
      );
      assert.ok(warning, "expected a max_line_length warning");
      assert.match(warning!, /OVERVIEW\.md.*1 line\(s\)/i);
      assert.match(warning!, /:\s*5/); // only line 5 (the prose line) flagged
    } finally {
      cleanup();
    }
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
