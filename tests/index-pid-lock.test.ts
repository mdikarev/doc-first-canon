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

  it("stopWatchPid is idempotent when not running", () => {
    const result = stopWatchPid(root);
    assert.equal(result.stopped, false);
    assert.equal(fs.existsSync(indexWatchPidPath(root)), false);
  });
});
