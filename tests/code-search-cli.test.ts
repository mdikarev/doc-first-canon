import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repoRoot, "bin", "doc-canon.js");

function run(args: string[]): { status: number | null; stdout: string; stderr: string } {
  return spawnSync("node", [bin, ...args], { cwd: repoRoot, encoding: "utf8" });
}

describe("doc-canon code-index search cli", () => {
  let repo: string;
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-search-cli-"));
    fs.mkdirSync(path.join(repo, ".git"));
    fs.writeFileSync(path.join(repo, "package.json"), "{}");
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "src/reader.ts"), "export class Reader {}\n");
    fs.writeFileSync(
      path.join(repo, "src/main.ts"),
      'import { Reader } from "./reader";\nexport function main() { return new Reader(); }\n',
    );
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("lists code-index search in help", () => {
    const r = run(["code-index", "--help"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /search/);
  });

  it("fails closed without an index, with a build hint", () => {
    const r = run(["code-index", "search", "Reader", "--root", repo]);
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /code-index build/);
  });

  it("returns a fresh json pack after build", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "Reader", "--root", repo, "--json"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const pack = JSON.parse(r.stdout);
    assert.equal(pack.query, "Reader");
    assert.equal(pack.mode, "symbols");
    assert.equal(pack.freshness, "fresh");
    assert.ok(Array.isArray(pack.hits));
    const hit = pack.hits.find((h) => h.name === "Reader");
    assert.ok(hit);
    assert.equal(hit.file, "src/reader.ts");
  });

  it("prints human output with file, line, kind, name", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "Reader", "--root", repo]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /src\/reader\.ts\s+L1\s+class\s+Reader/);
  });

  it("warns on stderr when stale in human mode", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    // A live watch keeps stale warn + serve (exit 0); without it the index self-heals.
    fs.writeFileSync(codeIndexWatchPidPath(repo), String(process.pid));
    fs.writeFileSync(path.join(repo, "src/reader.ts"), "export class Reader { changed() {} }\n");
    const r = run(["code-index", "search", "Reader", "--root", repo]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /code_index_stale/);
  });

  it("rejects an empty query", () => {
    const r = run(["code-index", "search", "   ", "--root", repo]);
    assert.notEqual(r.status, 0);
  });

  it("searches from a subdirectory root after building at repo root", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "Reader", "--root", path.join(repo, "src")]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /src\/reader\.ts\s+L1\s+class\s+Reader/);
  });

  it("rejects invalid flag values", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    for (const args of [
      ["--max-hits", "0"],
      ["--max-hits", "abc"],
      ["--max-hits", "1.5"],
      ["--snippet-lines", "0"],
      ["--snippet-lines", "2.5"],
      ["--kind", "bogus"],
    ]) {
      const r = run(["code-index", "search", "Reader", "--root", repo, ...args]);
      assert.notEqual(r.status, 0, args.join(" "));
    }
  });

  it("rejects --refs combined with a positional query", () => {
    const r = run(["code-index", "search", "Reader", "--root", repo, "--refs", "Reader"]);
    assert.notEqual(r.status, 0);
  });

  it("rejects --refs combined with --kind / --file", () => {
    const r1 = run(["code-index", "search", "--root", repo, "--refs", "Reader", "--kind", "class"]);
    assert.notEqual(r1.status, 0);
    const r2 = run(["code-index", "search", "--root", repo, "--refs", "Reader", "--file", "src/*.ts"]);
    assert.notEqual(r2.status, 0);
  });

  it("rejects an empty --refs name", () => {
    const r = run(["code-index", "search", "--root", repo, "--refs", "   "]);
    assert.notEqual(r.status, 0);
  });

  it("refs mode returns ref hits via --json", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "--root", repo, "--refs", "Reader", "--json"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const pack = JSON.parse(r.stdout);
    assert.equal(pack.mode, "refs");
    assert.ok(pack.hits.some((h) => h.refKind === "import" && h.file === "src/main.ts"));
  });

  it("no matches exit 0 with 'no hits'", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "zzzNoMatch", "--root", repo]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /no hits/);
  });

  it("--file glob matching nothing exits 0 with 'no hits'", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const r = run(["code-index", "search", "Reader", "--root", repo, "--file", "zzz/*.ts"]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /no hits/);
  });

  it("is byte-deterministic across two invocations", () => {
    assert.equal(run(["code-index", "build", "--root", repo]).status, 0);
    const a = run(["code-index", "search", "Reader", "--root", repo, "--json"]);
    const b = run(["code-index", "search", "Reader", "--root", repo, "--json"]);
    assert.equal(a.status, 0, a.stderr + a.stdout);
    assert.equal(a.stdout, b.stdout);
  });
});
