// tests/code-index-cli.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repoRoot, "bin", "doc-canon.js");

describe("doc-canon code-index cli", () => {
  let repo: string;
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-cli-"));
    fs.mkdirSync(path.join(repo, ".git"));
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("code-index build writes artifacts", () => {
    fs.writeFileSync(path.join(repo, "package.json"), "{}");
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "src/a.ts"), "export const x = 1;");
    const r = spawnSync("node", [bin, "code-index", "build", "--root", repo], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-index-manifest.json")));
    assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.sqlite")));
  });

  it("code-index build fails closed without a VCS root", () => {
    // The filesystem root cannot have a .git ancestor, so this always fails.
    const r = spawnSync(
      "node",
      [bin, "code-index", "build", "--root", path.parse(process.cwd()).root],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /VCS root|\.git/);
  });

  it("--watch and --stop are mutually exclusive", () => {
    const r = spawnSync(
      "node",
      [bin, "code-index", "build", "--root", repo, "--watch", "--stop"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /mutually exclusive/);
  });

  it("--body with --refs fails closed", () => {
    const r = spawnSync(
      "node",
      [bin, "code-index", "search", "--refs", "Reader", "--body", "--root", repo],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /--body/);
  });
});
