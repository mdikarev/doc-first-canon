import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendProbe,
  lastProbeByKind,
  probeLogPath,
  readProbeLog,
} from "../src/probe-log.js";

describe("probe log", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "probe-log-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("appends one JSON line per probe and reads them back", () => {
    appendProbe(root, {
      ts: "2026-08-19T00:00:00.000Z",
      kind: "doc",
      query: "x",
      hits: 1,
      freshness: "fresh",
      reindexed: false,
    });
    appendProbe(root, {
      ts: "2026-08-19T00:00:01.000Z",
      kind: "code",
      query: "y",
      mode: "symbols",
      hits: 2,
      freshness: "fresh",
      reindexed: true,
    });
    const entries = readProbeLog(root);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.kind, "doc");
    assert.equal(entries[1]!.kind, "code");
    assert.equal(entries[1]!.mode, "symbols");
    assert.equal(entries[1]!.reindexed, true);
  });

  it("lastProbeByKind returns the newest entry of that kind", () => {
    appendProbe(root, { ts: "2026-08-19T00:00:00.000Z", kind: "doc", query: "a", hits: 0, freshness: "stale", reindexed: false });
    appendProbe(root, { ts: "2026-08-19T00:00:02.000Z", kind: "code", query: "b", hits: 0, freshness: "fresh", reindexed: false });
    appendProbe(root, { ts: "2026-08-19T00:00:03.000Z", kind: "doc", query: "c", hits: 0, freshness: "fresh", reindexed: false });
    assert.equal(lastProbeByKind(root, "doc")?.query, "c");
    assert.equal(lastProbeByKind(root, "code")?.query, "b");
    assert.equal(lastProbeByKind(root, "doc")?.mode, undefined);
  });

  it("trims the log to the last 1000 lines", () => {
    for (let i = 0; i < 1005; i++) {
      appendProbe(root, { ts: `2026-08-19T00:00:${String(i % 60).padStart(2, "0")}.000Z`, kind: "doc", query: `q${i}`, hits: 0, freshness: "fresh", reindexed: false });
    }
    const entries = readProbeLog(root);
    assert.equal(entries.length, 1000);
    assert.equal(entries[0]!.query, "q5");
    assert.equal(entries[999]!.query, "q1004");
  });

  it("missing log reads empty; appendProbe never throws", () => {
    assert.deepEqual(readProbeLog(root), []);
    appendProbe(root, { ts: "2026-08-19T00:00:00.000Z", kind: "doc", query: "x", hits: 0, freshness: "fresh", reindexed: false });
    assert.ok(fs.existsSync(probeLogPath(root)));
  });
});
