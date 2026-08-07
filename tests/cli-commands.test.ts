// tests/cli-commands.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "bin", "doc-canon.js");

describe("doc-canon cli commands", () => {
  it("lists all MVP commands in --help", () => {
    const r = spawnSync("node", [bin, "--help"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    for (const cmd of [
      "init",
      "upgrade-skills",
      "validate",
      "check",
      "report",
    ]) {
      assert.match(r.stdout, new RegExp(`\\b${cmd}\\b`), `missing ${cmd}`);
    }
  });

  it("documents --root on each command", () => {
    for (const cmd of [
      "init",
      "upgrade-skills",
      "validate",
      "check",
      "report",
    ]) {
      const r = spawnSync("node", [bin, cmd, "--help"], {
        cwd: root,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, `${cmd}: ${r.stderr || r.stdout}`);
      assert.match(r.stdout, /--root <path>/, `${cmd} missing --root`);
    }
  });
});
