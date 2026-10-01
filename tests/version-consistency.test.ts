// tests/version-consistency.test.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PACKAGE_VERSION } from "../src/version.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(
  readFileSync(path.join(root, "package.json"), "utf8"),
) as { version: string };
const lock = JSON.parse(
  readFileSync(path.join(root, "package-lock.json"), "utf8"),
) as { version: string; packages: Record<string, { version?: string }> };

// Root-canon "current state" mentions of the shipped package version. Historical version prose
// lives in DISCREPANCIES.md (resolution logs) and future_plans/** (initiative history), so those
// are deliberately out of scope.
const CANON_VERSION_PATTERNS = [
  /`doc-canon@(\d+\.\d+\.\d+)`/g,
  /`doc-canon`\s(\d+\.\d+\.\d+)/g,
];

describe("version consistency", () => {
  it("keeps package.json version in sync with src/version.ts PACKAGE_VERSION", () => {
    assert.equal(pkg.version, PACKAGE_VERSION);
  });

  it("keeps package-lock.json in sync with the package version", () => {
    assert.equal(lock.version, PACKAGE_VERSION);
    assert.equal(lock.packages[""]?.version, PACKAGE_VERSION);
  });

  it("keeps root-canon current-state package-version mentions in sync", () => {
    const canonDir = path.join(root, "docs/canon");
    const offenders: string[] = [];
    const files = readdirSync(canonDir).filter(
      (name) => name.endsWith(".md") && name !== "DISCREPANCIES.md",
    );
    for (const name of files) {
      const text = readFileSync(path.join(canonDir, name), "utf8");
      for (const pattern of CANON_VERSION_PATTERNS) {
        for (const match of text.matchAll(pattern)) {
          if (match[1] !== PACKAGE_VERSION) {
            offenders.push(`${name}: ${match[0]}`);
          }
        }
      }
    }
    assert.deepEqual(offenders, []);
  });
});
