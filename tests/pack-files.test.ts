import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("npm pack contents", () => {
  it("includes LICENSE, CHANGELOG.md, and README.md", () => {
    assert.equal(existsSync(path.join(root, "LICENSE")), true);
    assert.equal(existsSync(path.join(root, "CHANGELOG.md")), true);
    const result = spawnSync("npm", ["pack", "--dry-run"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const out = `${result.stdout}\n${result.stderr}`;
    assert.match(out, /LICENSE/);
    assert.match(out, /CHANGELOG\.md/);
    assert.match(out, /README\.md/);
  });
});
