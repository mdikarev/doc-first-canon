import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCanon } from "../src/commands/check.js";
import { readReport } from "../src/report/io.js";
import { syncCanonIndex } from "../src/index/sync.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const happyCanon = join(testsDir, "fixtures", "happy-canon");

describe("check discipline findings", () => {
  it("merges a kind=discipline finding when docs changed after the index", async () => {
    const root = mkdtempSync(join(tmpdir(), "discipline-findings-"));
    try {
      cpSync(happyCanon, root, { recursive: true });
      await syncCanonIndex(root);
      const overview = join(root, "docs", "canon", "OVERVIEW.md");
      writeFileSync(overview, `${readFileSync(overview, "utf8")}\n\nExtra drift line.\n`);

      const exit = await checkCanon(root);
      assert.equal(exit, 0, "discipline findings must not change the check exit code");

      const report = readReport(root);
      assert.ok(report !== null);
      const discipline = report.findings.filter((f) => f.kind === "discipline");
      assert.ok(discipline.length >= 1, `expected a discipline finding, got ${JSON.stringify(report.findings)}`);
      assert.equal(discipline[0]!.source, "cli");
      assert.ok(discipline[0]!.summary.includes("docs/canon/OVERVIEW.md") || discipline[0]!.paths.includes("docs/canon/OVERVIEW.md"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
