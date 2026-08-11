import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acquireWatchPid,
  isPidAlive,
  readWatchPid,
  releaseWatchPid,
  stopWatchPid,
} from "../src/index/pid-lock.js";
import { indexWatchPidPath } from "../src/index/paths.js";

describe("pid-lock", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-pid-"));
  });

  afterEach(() => {
    try {
      releaseWatchPid(root);
    } catch {
      // Ignore cleanup failures.
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("acquire writes pid; second acquire throws while alive", () => {
    acquireWatchPid(root);
    assert.equal(readWatchPid(root), process.pid);
    assert.equal(isPidAlive(process.pid), true);
    assert.throws(() => acquireWatchPid(root), /already running/);
  });

  it("release leaves a lock owned by another process", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(indexWatchPidPath(root), "12345\n");

    releaseWatchPid(root);

    assert.equal(fs.readFileSync(indexWatchPidPath(root), "utf8"), "12345\n");
  });

  it("stop removes a stale pid file", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(indexWatchPidPath(root), "999999\n");

    assert.deepEqual(stopWatchPid(root), { stopped: false });
    assert.equal(fs.existsSync(indexWatchPidPath(root)), false);
  });

  it("stopWatchPid is idempotent when not running", () => {
    const result = stopWatchPid(root);
    assert.equal(result.stopped, false);
    assert.equal(fs.existsSync(indexWatchPidPath(root)), false);
  });
});
