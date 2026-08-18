// tests/code-search.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex, CodeSearchError, type CodeRefHit } from "../src/code-search/search.js";

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

  it("orders exact > prefix > substring by match class", async () => {
    write(repo, "src/names.ts", "export function foo() {}\nexport function foobar() {}\nexport function xfoo() {}\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "foo");
    assert.deepEqual(
      pack.hits.map((h) => h.name),
      ["foo", "foobar", "xfoo"],
    );
  });

  it("tie-breaks same match class by file", async () => {
    write(repo, "src/a.ts", "export function sharedName() {}\n");
    write(repo, "src/b.ts", "export function sharedName() {}\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "sharedName");
    assert.deepEqual(
      pack.hits.map((h) => `${h.file}:${h.line}:${h.name}`),
      ["src/a.ts:1:sharedName", "src/b.ts:1:sharedName"],
    );
  });

  it("tie-breaks same match class by line within one file", async () => {
    write(repo, "src/tiebreak.ts", "export function fooBar() {}\nexport function fooBaz() {}\n");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "foob");
    assert.deepEqual(
      pack.hits.map((h) => `${h.file}:${h.line}:${h.name}`),
      ["src/tiebreak.ts:1:fooBar", "src/tiebreak.ts:2:fooBaz"],
    );
  });

  it("resolves the VCS root from a subdirectory root", async () => {
    const pack = searchCodeIndex(path.join(repo, "src"), "Reader");
    assert.equal(pack.freshness, "fresh");
    const hit = pack.hits.find((h) => h.name === "Reader");
    assert.ok(hit);
    assert.equal(hit.file, "src/reader.ts");
    assert.ok(hit.snippets.length >= 1);
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
    const filtered = searchCodeIndex(repo, "Reader", { file: "src/main.ts" });
    assert.ok(filtered.hits.every((h) => h.file === "src/main.ts"));
    assert.ok(!filtered.hits.some((h) => h.name === "Reader"));
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

  it("refs mode matches constructor-backed member-access edges (Class.method)", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.score member-access hit");
    assert.equal(hit.from, "src/main.ts");
    assert.equal(hit.to, "src/reader.ts");
    assert.equal(hit.line, 4);
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

  it("multi-token query matches symbols whose name contains every token", async () => {
    write(repo, "src/search.ts", "export function searchCodeIndex(root: string): string { return root; }");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "search code index");
    const names = (pack.hits as { name: string }[]).map((h) => h.name);
    assert.ok(names.includes("searchCodeIndex"));
  });

  it("multi-token query falls back to signature tokens", async () => {
    write(repo, "src/token.ts", "export function normalize(doc: string): string[] { return doc.split(' '); }");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "normalize doc");
    const names = (pack.hits as { name: string }[]).map((h) => h.name);
    assert.ok(names.includes("normalize"));
  });

  it("body option widens the snippet window to endLine", async () => {
    write(repo, "src/wide.ts", "export function wide(): number {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}");
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "wide", { body: true });
    const hit = pack.hits[0] as { snippets: { text: string }[] };
    assert.ok(hit.snippets[0]!.text.split("\n").length >= 5);
  });
});

describe("searchCodeIndex (go refs)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "go.mod", "module example.com/app\n\ngo 1.22\n");
    write(repo, "main.go", `package main

type Handle struct{}

func (h *Handle) Score(q string) int { return len(q) }

func main() {
	x := &Handle{}
	x.Score("q")
}
`);
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode matches Go same-file constructor-backed member-access edges", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Handle.Score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Handle.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Handle.Score member-access hit");
    assert.equal(hit.from, "main.go");
    assert.equal(hit.to, "main.go");
    assert.equal(hit.line, 9);
  });

  it("refs mode resolves Go same-package types across files", async () => {
    write(repo, "handle.go", "package main\n\ntype Reader struct{}\n\nfunc (r *Reader) Open() {}\n");
    write(repo, "main.go", `package main
func main() {
	r := &Reader{}
	r.Open()
}
`);
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.Open" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.Open",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.Open same-package hit");
    assert.equal(hit.from, "main.go");
    assert.equal(hit.to, "handle.go");
    assert.equal(hit.line, 4);
  });
});

describe("searchCodeIndex (csharp refs)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(
      repo,
      "src/App/Reader.cs",
      `namespace App
{
    public class Reader
    {
        public int Score(string q) { return q.Length; }
    }
}
`,
    );
    write(
      repo,
      "src/App/Program.cs",
      `namespace App
{
    public class Program
    {
        static void Main()
        {
            var r = new Reader();
            var n = r.Score("q");
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode matches same-file constructor-backed member-access edges", async () => {
    write(
      repo,
      "src/App/Program.cs",
      `namespace App
{
    public class Program
    {
        static void Main()
        {
            var r = new Reader();
            var n = r.Score("q");
        }
    }

    public class Reader
    {
        public int Score(string q) { return q.Length; }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.Score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.Score member-access hit");
    assert.equal(hit.from, "src/App/Program.cs");
    assert.equal(hit.to, "src/App/Program.cs");
    assert.equal(hit.line, 8);
  });

  it("refs mode resolves same-namespace types across files", async () => {
    const pack = searchCodeIndex(repo, "", { refs: "Reader.Score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.Score same-namespace hit");
    assert.equal(hit.from, "src/App/Program.cs");
    assert.equal(hit.to, "src/App/Reader.cs");
    assert.equal(hit.line, 8);
  });

  it("refs mode does not cross namespaces", async () => {
    write(
      repo,
      "src/Other/Reader.cs",
      `namespace Other
{
    public class Reader
    {
        public int Score(string q) { return q.Length; }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.Score" });
    assert.equal(pack.hits.filter((h) => h.refKind === "import" && h.name === "Reader.Score").length, 1);
  });
});

describe("searchCodeIndex (rust refs)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "Cargo.toml", '[package]\nname = "app"\nversion = "0.1.0"\n');
    write(
      repo,
      "src/main.rs",
      `pub struct Reader {}

impl Reader {
    pub fn new() -> Reader {
        Reader {}
    }
    pub fn score(&self) -> u32 {
        1
    }
}

fn main() {
    let r = Reader::new();
    r.score();
}
`,
    );
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode matches Rust associated-function-constructor member-access edges", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.score member-access hit");
    assert.equal(hit.from, "src/main.rs");
    assert.equal(hit.to, "src/main.rs");
    assert.equal(hit.line, 14);
  });

  it("refs mode resolves Rust imported names across files via use edges", async () => {
    write(
      repo,
      "src/common.rs",
      `pub struct Reader {}

impl Reader {
    pub fn new() -> Reader {
        Reader {}
    }
    pub fn score(&self) -> u32 {
        1
    }
}
`,
    );
    write(
      repo,
      "src/main.rs",
      `mod common;

use self::common::Reader;

fn main() {
    let r = Reader::new();
    r.score();
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.score imported-name hit");
    assert.equal(hit.from, "src/main.rs");
    assert.equal(hit.to, "src/common.rs");
    assert.equal(hit.line, 7);
  });
});

describe("searchCodeIndex (python refs)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "pyproject.toml", '[project]\nname = "app"\nversion = "0.1.0"\n');
    write(
      repo,
      "reader.py",
      `class Reader:
    def __init__(self):
        pass

    def score(self):
        return 1
`,
    );
    write(
      repo,
      "main.py",
      `from .reader import Reader


def run():
    r = Reader()
    return r.score()
`,
    );
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode matches Python bare-call constructor member-access edges across files", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.score member-access hit");
    assert.equal(hit.from, "main.py");
    assert.equal(hit.to, "reader.py");
    assert.equal(hit.line, 6);
  });

  it("refs mode matches Python same-file class constructor member-access edges", async () => {
    write(
      repo,
      "main.py",
      `class Reader:
    def score(self):
        return 1


def run():
    r = Reader()
    return r.score()
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.score same-file hit");
    assert.equal(hit.from, "main.py");
    assert.equal(hit.to, "main.py");
    assert.equal(hit.line, 8);
  });
});
