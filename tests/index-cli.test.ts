import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexWatchPidPath } from "../src/index/paths.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

describe("doc-canon index cli", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-idxcli-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "hello index");
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("indexes and exits 0", () => {
    const result = spawnSync("node", [bin, "index", "--root", root], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /updated|fresh/i);
  });

  it("fails when watch pid is alive", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(indexWatchPidPath(root), String(process.pid));
    const result = spawnSync("node", [bin, "index", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /watch running/i);
  });

  it("fails closed without docs/canon", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-empty-"));
    try {
      const result = spawnSync("node", [bin, "index", "--root", empty], {
        encoding: "utf8",
      });
      assert.notEqual(result.status, 0);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("rejects --watch with --stop", () => {
    const result = spawnSync(
      "node",
      [bin, "index", "--root", root, "--watch", "--stop"],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
  });

  it("rejects invalid --interval", () => {
    const result = spawnSync(
      "node",
      [bin, "index", "--root", root, "--watch", "--interval", "50"],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
  });

  it("second --watch fails while first holds pid", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(indexWatchPidPath(root), String(process.pid));
    const result = spawnSync(
      "node",
      [bin, "index", "--root", root, "--watch", "--interval", "200"],
      { encoding: "utf8" },
    );
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /already running/i);
  });

  it("--stop is idempotent", () => {
    const result = spawnSync("node", [bin, "index", "--root", root, "--stop"], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /not running/i);
  });
});
