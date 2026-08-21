import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const bin = join(repoRoot, "bin", "doc-canon.js");
const fixture = (name: string): string => join(testsDir, "fixtures", name);

describe("doc-canon validate --json", () => {
  it("emits {schema_version, ok, issues} on stdout for a valid canon", () => {
    const r = spawnSync("node", [bin, "validate", "--json", "--root", fixture("happy-canon")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const pack = JSON.parse(r.stdout) as { schema_version: number; ok: boolean; issues: unknown[] };
    assert.equal(pack.schema_version, 1);
    assert.equal(pack.ok, true);
    assert.deepEqual(pack.issues, []);
  });

  it("lists error-severity issues with kind and paths for a broken canon", () => {
    const r = spawnSync("node", [bin, "validate", "--json", "--root", fixture("missing-section")], { encoding: "utf8" });
    assert.equal(r.status, 1);
    const pack = JSON.parse(r.stdout) as { ok: boolean; issues: Array<{ kind: string; severity: string; paths: string[] }> };
    assert.equal(pack.ok, false);
    assert.ok(pack.issues.some((i) => i.severity === "error" && i.paths.length > 0));
  });

  it("keeps human mode byte-identical", () => {
    const r = spawnSync("node", [bin, "validate", "--root", fixture("missing-section")], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^error: .*missing required section/i);
    assert.equal(r.stdout, "");
  });
});
