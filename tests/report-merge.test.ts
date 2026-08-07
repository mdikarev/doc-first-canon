import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { mergeCliFindings, nextFindingId } from "../src/report/merge.js";
import { readReport, writeReport } from "../src/report/io.js";
import type { Finding, Report } from "../src/report/types.js";

describe("mergeCliFindings", () => {
  it("preserves skill findings when merging cli", () => {
    const existing: Report = {
      schema_version: 1,
      generated_at: "old",
      findings: [
        {
          id: "F-001",
          kind: "drift",
          paths: ["a"],
          summary: "s",
          status: "open",
          source: "skill",
        },
        {
          id: "F-002",
          kind: "structure",
          paths: ["b"],
          summary: "s",
          status: "open",
          source: "cli",
        },
      ],
    };
    const merged = mergeCliFindings(existing, [
      {
        id: "F-003",
        kind: "structure",
        paths: ["c"],
        summary: "n",
        status: "open",
        source: "cli",
      },
    ]);
    assert.equal(
      merged.findings.some((f) => f.id === "F-001" && f.source === "skill"),
      true,
    );
    assert.equal(merged.findings.some((f) => f.id === "F-002"), false);
    assert.equal(
      merged.findings.some((f) => f.source === "cli" && f.paths[0] === "c"),
      true,
    );
  });

  it("creates a fresh report when existing is null", () => {
    const merged = mergeCliFindings(null, [
      {
        id: "F-001",
        kind: "structure",
        paths: ["x"],
        summary: "issue",
        status: "open",
        source: "cli",
      },
    ]);
    assert.equal(merged.schema_version, 1);
    assert.match(merged.generated_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.deepEqual(merged.findings, [
      {
        id: "F-001",
        kind: "structure",
        paths: ["x"],
        summary: "issue",
        status: "open",
        source: "cli",
      },
    ]);
  });

  it("updates generated_at on merge", () => {
    const existing: Report = {
      schema_version: 1,
      generated_at: "old",
      findings: [],
    };
    const merged = mergeCliFindings(existing, []);
    assert.notEqual(merged.generated_at, "old");
    assert.match(merged.generated_at, /^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("nextFindingId", () => {
  it("returns F-001 for empty findings", () => {
    assert.equal(nextFindingId([]), "F-001");
  });

  it("returns max F-NNN + 1", () => {
    const findings: Finding[] = [
      {
        id: "F-001",
        kind: "drift",
        paths: [],
        summary: "a",
        status: "open",
        source: "skill",
      },
      {
        id: "F-010",
        kind: "drift",
        paths: [],
        summary: "b",
        status: "open",
        source: "cli",
      },
    ];
    assert.equal(nextFindingId(findings), "F-011");
  });
});

describe("report io", () => {
  it("round-trips report.json under .doc-canon", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-report-"));
    try {
      const report: Report = {
        schema_version: 1,
        generated_at: new Date().toISOString(),
        findings: [
          {
            id: "F-001",
            kind: "structure",
            paths: ["docs/canon/OVERVIEW.md"],
            summary: "missing heading",
            status: "open",
            source: "cli",
          },
        ],
      };

      writeReport(root, report);
      assert.deepEqual(readReport(root), report);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns null when report.json is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-report-missing-"));
    try {
      assert.equal(readReport(root), null);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
