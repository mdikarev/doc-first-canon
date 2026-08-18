// tests/skills-stamp-guard.test.ts
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { SKILLS_STAMP } from "../src/version.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Managed assets: changing these must bump SKILLS_STAMP (see GLOSSARY skills_stamp).
// Templates under embedded/templates are not managed assets.
const MANAGED_PATHS = ["embedded/skills", "embedded/rules", "embedded/agents"];

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

describe("SKILLS_STAMP guard", () => {
  it("bumps SKILLS_STAMP whenever managed assets change", () => {
    const stampLine = `SKILLS_STAMP = "${SKILLS_STAMP}"`;
    let bumpCommit: string;
    try {
      bumpCommit = git(
        "log",
        "-1",
        "--format=%H",
        `-S${stampLine}`,
        "--",
        "src/version.ts",
      );
    } catch {
      bumpCommit = "";
    }
    assert.ok(
      bumpCommit,
      `no commit found that set ${stampLine}; bump SKILLS_STAMP in src/version.ts`,
    );

    const changedAfter = git(
      "rev-list",
      "--count",
      `${bumpCommit}..HEAD`,
      "--",
      ...MANAGED_PATHS,
    );
    assert.equal(
      changedAfter,
      "0",
      `managed assets changed after the SKILLS_STAMP ${SKILLS_STAMP} bump ` +
        `(${bumpCommit.slice(0, 7)}); bump SKILLS_STAMP in src/version.ts`,
    );

    const uncommitted = git("status", "--porcelain", "--", ...MANAGED_PATHS);
    assert.equal(
      uncommitted,
      "",
      `uncommitted managed-asset changes require a SKILLS_STAMP bump:\n${uncommitted}`,
    );
  });
});
