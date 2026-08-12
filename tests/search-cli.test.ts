import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

describe("doc-canon search cli", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-searchcli-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "hello retrieval pack\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("fails closed without index", () => {
    const r = spawnSync("node", [bin, "search", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /doc-canon index/i);
  });

  it("indexes then returns json pack", () => {
    assert.equal(
      spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" })
        .status,
      0,
    );
    const r = spawnSync(
      "node",
      [bin, "search", "retrieval", "--root", root, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const pack = JSON.parse(r.stdout);
    assert.equal(pack.query, "retrieval");
    assert.ok(Array.isArray(pack.hits));
    assert.equal(pack.freshness, "fresh");
  });

  it("warns on stderr when stale in human mode", () => {
    spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "hello retrieval pack changed\n",
    );
    const r = spawnSync("node", [bin, "search", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /index_stale/);
  });

  it("rejects empty query", () => {
    const r = spawnSync("node", [bin, "search", "   ", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
  });
});
