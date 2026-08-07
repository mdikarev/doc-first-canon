import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkCanon } from "../src/commands/check.js";
import { readReport, writeReport } from "../src/report/io.js";
import type { Report } from "../src/report/types.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const happyCanon = join(testsDir, "fixtures", "happy-canon");

function temporaryHappyCanon(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-check-"));
  cpSync(happyCanon, root, { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("checkCanon", () => {
  it("writes inventory and a CLI-only report for a valid canon", async () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      assert.equal(await checkCanon(root), 0);
      assert.equal(existsSync(join(root, ".doc-canon", "inventory.json")), true);

      const inventory = JSON.parse(
        readFileSync(join(root, ".doc-canon", "inventory.json"), "utf8"),
      ) as { root: string; entries: unknown[] };
      assert.equal(inventory.root, root);
      assert.ok(inventory.entries.length > 0);

      const report = readReport(root);
      assert.ok(report);
      assert.deepEqual(report.findings, []);
    } finally {
      cleanup();
    }
  });

  it("preserves skill findings when refreshing CLI findings", async () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const seeded: Report = {
        schema_version: 1,
        generated_at: "old",
        findings: [
          {
            id: "F-007",
            kind: "drift",
            paths: ["src/example.ts"],
            summary: "Skill-observed drift",
            status: "open",
            source: "skill",
          },
        ],
      };
      writeReport(root, seeded);

      assert.equal(await checkCanon(root), 0);

      const report = readReport(root);
      assert.ok(report);
      assert.deepEqual(report.findings, seeded.findings);
      assert.notEqual(report.generated_at, "old");
    } finally {
      cleanup();
    }
  });
});

describe("doc-canon check and report", () => {
  it("honors --root and prints the generated report", () => {
    const { root, cleanup } = temporaryHappyCanon();
    try {
      const checked = spawnSync(
        "npx",
        ["tsx", "src/cli.ts", "check", "--root", root],
        { cwd: repoRoot, encoding: "utf8" },
      );
      assert.equal(checked.status, 0, checked.stderr);

      const printed = spawnSync(
        "npx",
        ["tsx", "src/cli.ts", "report", "--root", root],
        { cwd: repoRoot, encoding: "utf8" },
      );
      assert.equal(printed.status, 0, printed.stderr);
      assert.deepEqual(JSON.parse(printed.stdout), readReport(root));
    } finally {
      cleanup();
    }
  });

  it("report exits 1 when report.json is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-report-command-"));
    try {
      const result = spawnSync(
        "npx",
        ["tsx", "src/cli.ts", "report", "--root", root],
        { cwd: repoRoot, encoding: "utf8" },
      );
      assert.equal(result.status, 1);
      assert.match(result.stderr, /report\.json/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
