import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "code-search-auto-"));
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\n");
  return root;
}

describe("code-index search auto-reindex", () => {
  let root: string;
  beforeEach(() => { root = makeRepo(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("self-heals a stale code index and serves fresh with auto_reindexed", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const res = spawnSync("node", [bin, "code-index", "search", "Beta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "fresh");
    assert.ok(pack.warnings.includes("auto_reindexed"));
    assert.ok(pack.hits.some((h: { file: string; name: string }) => h.name === "Beta"));
  });

  it("serves stale with a warning when a watch owns the index", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(codeIndexWatchPidPath(root), String(process.pid));
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const res = spawnSync("node", [bin, "code-index", "search", "Beta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "stale");
    assert.ok(!pack.warnings.includes("auto_reindexed"));
  });

  it("fails closed on a missing code index with a hint", () => {
    const res = spawnSync("node", [bin, "code-index", "search", "Alpha", "--root", root], { encoding: "utf8" });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /code-index build/);
  });

  it("writes a code probe line with mode", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    spawnSync("node", [bin, "code-index", "search", "--refs", "Alpha", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.kind, "code");
    assert.equal(entry.mode, "refs");
    assert.equal(entry.query, "Alpha");
  });
});
