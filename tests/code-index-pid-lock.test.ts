// tests/code-index-pid-lock.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acquireCodeIndexWatchPid,
  readCodeIndexWatchPid,
  releaseCodeIndexWatchPid,
  stopCodeIndexWatchPid,
} from "../src/code-index/pid-lock.js";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";

describe("code-index pid-lock", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-pid-"));
  });
  afterEach(() => {
    try {
      releaseCodeIndexWatchPid(root);
    } catch {
      // ignore
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("acquire writes pid; second acquire throws while alive", () => {
    acquireCodeIndexWatchPid(root);
    assert.equal(readCodeIndexWatchPid(root), process.pid);
    assert.throws(() => acquireCodeIndexWatchPid(root), /already running/);
  });

  it("release leaves a lock owned by another process", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexWatchPidPath(root), "12345\n");
    releaseCodeIndexWatchPid(root);
    assert.equal(fs.readFileSync(codeIndexWatchPidPath(root), "utf8"), "12345\n");
  });

  it("stop removes a stale pid file", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexWatchPidPath(root), "999999\n");
    assert.deepEqual(stopCodeIndexWatchPid(root), { stopped: false });
    assert.equal(fs.existsSync(codeIndexWatchPidPath(root)), false);
  });
});
