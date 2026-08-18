// tests/code-search.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex, CodeSearchError } from "../src/code-search/search.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-search-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("searchCodeIndex", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", "export class Reader { score(q: string): number { return q.length; } }");
    write(repo, "src/main.ts", 'import { Reader } from "./reader";\nexport function main(): number {\n  const r = new Reader();\n  return r.score("x");\n}');
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("throws empty_query on a whitespace query", () => {
    assert.throws(() => searchCodeIndex(repo, "   "), (e: unknown) => {
      assert.ok(e instanceof CodeSearchError);
      assert.equal(e.code, "empty_query");
      return true;
    });
  });

  it("throws code_index_missing with a build hint when no index exists", () => {
    const bare = makeRepo();
    try {
      assert.throws(() => searchCodeIndex(bare, "main"), (e: unknown) => {
        assert.ok(e instanceof CodeSearchError);
        assert.equal(e.code, "code_index_missing");
        assert.match(e.message, /code-index build/);
        return true;
      });
    } finally {
      fs.rmSync(bare, { recursive: true, force: true });
    }
  });

  it("returns a fresh symbol hit with matching file/line/kind/signature", () => {
    const pack = searchCodeIndex(repo, "Reader");
    assert.equal(pack.query, "Reader");
    assert.equal(pack.mode, "symbols");
    assert.equal(pack.freshness, "fresh");
    assert.deepEqual(pack.warnings, []);
    const hit = pack.hits.find((h) => h.name === "Reader");
    assert.ok(hit);
    assert.equal(hit.file, "src/reader.ts");
    assert.equal(hit.kind, "class");
    assert.equal(hit.line, 1);
    assert.ok(hit.signature.length > 0);
    assert.ok(hit.snippets.length >= 1);
  });

  it("orders exact > prefix > substring, tie-break file then line", async () => {
    write(repo, "src/names.ts", "export function foo() {}\nexport function foobar() {}\nexport function xfoo() {}\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "foo");
    assert.deepEqual(
      pack.hits.map((h) => h.name),
      ["foo", "foobar", "xfoo"],
    );
  });

  it("filters by kind", () => {
    const pack = searchCodeIndex(repo, "r", { kind: "class" });
    assert.ok(pack.hits.length >= 1);
    assert.ok(pack.hits.every((h) => h.kind === "class"));
  });

  it("filters by file glob", () => {
    const pack = searchCodeIndex(repo, "main", { file: "src/main.ts" });
    assert.ok(pack.hits.length >= 1);
    assert.ok(pack.hits.every((h) => h.file === "src/main.ts"));
    const empty = searchCodeIndex(repo, "Reader", { file: "src/main.ts" });
    assert.deepEqual(empty.hits, []);
  });

  it("caps hits to maxHits", () => {
    const pack = searchCodeIndex(repo, "e", { maxHits: 2 });
    assert.ok(pack.hits.length <= 2);
  });

  it("reports stale + code_index_stale when the live corpus changed", async () => {
    write(repo, "src/reader.ts", "export class Reader { score(q: string): number { return q.length + 1; } }");
    const pack = searchCodeIndex(repo, "Reader");
    assert.equal(pack.freshness, "stale");
    assert.deepEqual(pack.warnings, ["code_index_stale"]);
    assert.ok(pack.hits.length >= 1);
  });

  it("caps symbol snippets at snippetLines", async () => {
    write(repo, "src/tall.ts", "export function tall() {\n  const a = 1;\n  const b = 2;\n  const c = 3;\n  const d = 4;\n}\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "tall", { snippetLines: 2 });
    const hit = pack.hits[0]!;
    assert.equal(hit.snippets.length, 1);
    assert.equal(hit.snippets[0]!.start_line, hit.line);
    assert.equal(hit.snippets[0]!.text.split("\n").length, 2);
  });

  it("enforces the total snippet-line cap", async () => {
    const lines: string[] = [];
    for (let i = 0; i < 60; i++) {
      lines.push(`export function fn${String(i).padStart(2, "0")}() {\n  const a = 1;\n  const b = 2;\n  const c = 3;\n}\n`);
    }
    write(repo, "src/many.ts", lines.join("\n"));
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "fn", { maxHits: 60, snippetLines: 4 });
    const total = pack.hits.reduce(
      (sum, h) => sum + h.snippets.reduce((s, w) => s + w.text.split("\n").length, 0),
      0,
    );
    assert.ok(total <= 120);
  });

  it("emits hits without snippets when a live file read fails", async () => {
    fs.rmSync(path.join(repo, "src", "main.ts"));
    const pack = searchCodeIndex(repo, "main");
    assert.ok(pack.hits.length >= 1);
    assert.ok(pack.hits.every((h) => h.snippets.length === 0));
  });

  it("is deterministic across invocations", () => {
    const a = JSON.stringify(searchCodeIndex(repo, "Reader"));
    const b = JSON.stringify(searchCodeIndex(repo, "Reader"));
    assert.equal(a, b);
  });

  it("refs mode matches syntactically and orders by file, line", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Reader" });
    assert.equal(pack.mode, "refs");
    assert.ok(pack.hits.length >= 1);
    const importHit = pack.hits.find((h) => h.refKind === "import");
    assert.ok(importHit);
    assert.equal(importHit.name, "Reader");
    assert.equal(importHit.from, "src/main.ts");
    assert.equal(importHit.to, "src/reader.ts");
    assert.equal(importHit.file, "src/main.ts");
    const sorted = pack.hits.map((h) => `${h.file}:${h.line}`);
    assert.deepEqual(sorted, [...sorted].sort());
  });

  it("refs mode is case-sensitive and exact", () => {
    const lower = searchCodeIndex(repo, "", { refs: "reader" });
    assert.deepEqual(lower.hits, []);
    const partial = searchCodeIndex(repo, "", { refs: "Reade" });
    assert.deepEqual(partial.hits, []);
  });

  it("refs mode returns a centered snippet window", async () => {
    write(repo, "src/caller.ts", "import { Reader } from './reader';\n// fill\n// fill\n// fill\n// fill\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader", snippetLines: 3 });
    const hit = pack.hits.find((h) => h.file === "src/caller.ts");
    assert.ok(hit);
    assert.equal(hit.snippets.length, 1);
    assert.ok(hit.snippets[0]!.text.includes("import { Reader }"));
  });

  it("throws empty_query in refs mode with an empty refs name", () => {
    assert.throws(() => searchCodeIndex(repo, "", { refs: "   " }), (e: unknown) => {
      assert.ok(e instanceof CodeSearchError);
      assert.equal(e.code, "empty_query");
      return true;
    });
  });
});
