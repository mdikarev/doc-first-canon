import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendProbe } from "../src/probe-log.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

function makeDocRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discipline-doc-"));
  fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta\n");
  return root;
}

function run(root: string, args: string[]): { status: number | null; stdout: string } {
  const res = spawnSync("node", [bin, "discipline", "--root", root, ...args], { encoding: "utf8" });
  return { status: res.status, stdout: res.stdout };
}

describe("doc-canon discipline", () => {
  let root: string;
  beforeEach(() => { root = makeDocRoot(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("exits 0 with no index (not applicable)", () => {
    const { status, stdout } = run(root, []);
    assert.equal(status, 0);
    assert.match(stdout, /no index/);
  });

  it("exits 0 when the index is fresh and nothing changed", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const { status } = run(root, []);
    assert.equal(status, 0);
  });

  it("exits 1 when files changed after the last probe (un-probed)", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma\n");
    const { status } = run(root, []);
    assert.equal(status, 1);
  });

  it("exits 1 when a canon doc is deleted after the index (un-probed via deletion)", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.rmSync(path.join(root, "docs", "canon", "a.md"));
    const { status, stdout } = run(root, []);
    assert.equal(status, 1);
    assert.match(stdout, /un-probed/);
  });

  it("exits 1 and reports corrupt when the doc index manifest is unreadable", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, ".doc-canon", "index-manifest.json"), "garbage");
    const { status, stdout } = run(root, []);
    assert.equal(status, 1);
    assert.match(stdout, /corrupt/);
  });

  it("exits 0 when a probe is newer than the change", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const doc = path.join(root, "docs", "canon", "a.md");
    fs.writeFileSync(doc, "# Alpha\n\nalpha beta gamma\n");
    const past = new Date("2020-01-01T00:00:00.000Z");
    fs.utimesSync(doc, past, past);
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "doc",
      query: "alpha",
      hits: 1,
      freshness: "fresh",
      reindexed: false,
    });
    const { status } = run(root, []);
    assert.equal(status, 0);
  });

  it("--json emits a stable shape", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const { status, stdout } = run(root, ["--json"]);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(typeof parsed.doc.index_exists, "boolean");
    assert.equal(typeof parsed.doc.changed, "number");
    assert.equal(typeof parsed.doc.unprobed, "boolean");
    assert.equal(typeof parsed.doc.corrupt, "boolean");
    assert.equal(typeof parsed.code.index_exists, "boolean");
    assert.equal(typeof parsed.code.corrupt, "boolean");
  });
});

describe("doc-canon discipline (code kind)", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "discipline-code-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\n");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("exits 1 when source changed after the last code probe", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const { status } = run(root, []);
    assert.equal(status, 1);
  });

  it("exits 1 and reports corrupt when the code index store is unreadable", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, ".doc-canon", "code-ast-index.sqlite"), "garbage");
    const { status, stdout } = run(root, []);
    assert.equal(status, 1);
    assert.match(stdout, /corrupt/);
  });

  it("reports corrupt (not crash) when the code config is unreadable", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, ".doc-canon", "code-index.json"), "{invalid json");
    const res = spawnSync("node", [bin, "discipline", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 1);
    assert.doesNotMatch(res.stderr, /UnhandledPromiseRejection/);
    const parsed = JSON.parse(res.stdout);
    assert.equal(parsed.code.corrupt, true);
  });
});
