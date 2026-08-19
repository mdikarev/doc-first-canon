import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { indexWatchPidPath } from "../src/index/paths.js";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";
import { watchOwnsIndex } from "../src/commands/auto-reindex.js";

describe("watchOwnsIndex", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-reindex-"));
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("false when no pid files exist", () => {
    assert.equal(watchOwnsIndex(root, "doc"), false);
    assert.equal(watchOwnsIndex(root, "code"), false);
  });

  it("true when a live doc watch pid exists", () => {
    fs.writeFileSync(indexWatchPidPath(root), `${process.pid}\n`);
    assert.equal(watchOwnsIndex(root, "doc"), true);
    assert.equal(watchOwnsIndex(root, "code"), false);
  });

  it("true when a live code watch pid exists", () => {
    fs.writeFileSync(codeIndexWatchPidPath(root), `${process.pid}\n`);
    assert.equal(watchOwnsIndex(root, "code"), true);
    assert.equal(watchOwnsIndex(root, "doc"), false);
  });

  it("false when the pid file is stale (dead pid)", () => {
    fs.writeFileSync(indexWatchPidPath(root), "999999999\n");
    assert.equal(watchOwnsIndex(root, "doc"), false);
  });
});
