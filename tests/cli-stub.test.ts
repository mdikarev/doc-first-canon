// tests/cli-stub.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("doc-canon cli stub", () => {
  it("prints help and exits 0", () => {
    const r = spawnSync("npx", ["tsx", "src/cli.ts", "--help"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /validate/);
  });

  it("documents init and upgrade-skills options", () => {
    const init = spawnSync("npx", ["tsx", "src/cli.ts", "init", "--help"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(init.status, 0);
    assert.match(init.stdout, /--root <path>/);
    assert.match(init.stdout, /--force-skills/);
    assert.match(init.stdout, /--yes/);

    const upgrade = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "upgrade-skills", "--help"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(upgrade.status, 0);
    assert.match(upgrade.stdout, /--root <path>/);
  });
});
