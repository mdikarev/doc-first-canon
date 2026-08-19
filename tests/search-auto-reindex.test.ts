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

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "search-auto-"));
  fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma\n");
  return root;
}

describe("doc search auto-reindex", () => {
  let root: string;
  beforeEach(() => { root = makeRoot(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("self-heals a stale index and serves fresh with auto_reindexed", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    const res = spawnSync("node", [bin, "search", "delta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "fresh");
    assert.ok(pack.warnings.includes("auto_reindexed"));
    assert.ok(pack.hits.some((h: { path: string }) => h.path === "docs/canon/a.md"));
  });

  it("serves stale with a warning when a watch owns the index", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(indexWatchPidPath(root), String(process.pid));
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    const res = spawnSync("node", [bin, "search", "delta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "stale");
    assert.ok(!pack.warnings.includes("auto_reindexed"));
  });

  it("fails closed on a missing index with a hint", () => {
    const res = spawnSync("node", [bin, "search", "delta", "--root", root], { encoding: "utf8" });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /doc-canon index/);
  });

  it("writes one probe-log line per successful search", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    spawnSync("node", [bin, "search", "alpha", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.kind, "doc");
    assert.equal(entry.query, "alpha");
    assert.equal(entry.reindexed, false);
  });

  it("records reindexed:true when the command rebuilt", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    spawnSync("node", [bin, "search", "delta", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(JSON.parse(lines[0]!).reindexed, true);
  });
});
