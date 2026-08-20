// tests/code-index-sync.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexPair, tryLoadCodeIndexManifest } from "../src/code-index/io.js";
import { openCodeIndex } from "../src/code-index/reader.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-sync-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

const SOURCE = `export type Handle = { score(q: string): number };
export class Reader { score(q: string): number { return 1; } }
export function openReader(): Reader { return new Reader(); }`;

describe("syncCodeIndex", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds both artifacts and opens via reader", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.index_fingerprint, pair.ast.index_fingerprint);
    assert.equal(pair.manifest.roots.length, 1);
    assert.equal(pair.manifest.files["src/reader.ts"].language, "typescript");
    assert.ok(pair.manifest.files["src/reader.ts"].symbols > 0);
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "Reader"));
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const manifest1 = JSON.stringify(pair1.manifest);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.manifest), manifest1);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("returns fresh and does not rewrite when unchanged", async () => {
    await syncCodeIndex(repo);
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const before = fs.readFileSync(manifestPath, "utf8");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "fresh");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
  });

  it("rebuilds on edit", async () => {
    await syncCodeIndex(repo);
    write(repo, "src/reader.ts", SOURCE + "\nexport const extra = 1;");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.ok(r.changed.includes("src/reader.ts"));
  });

  it("rebuilds on delete", async () => {
    await syncCodeIndex(repo);
    fs.unlinkSync(path.join(repo, "src/reader.ts"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 0);
  });

  it("works on a repo without package.json (extension fallback)", async () => {
    fs.unlinkSync(path.join(repo, "package.json"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
  });

  it("writes a stats sidecar tied to the fingerprint on rebuild", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    const statsPath = path.join(repo, ".doc-canon", "code-index-stats.json");
    assert.ok(fs.existsSync(statsPath));
    const stats = JSON.parse(fs.readFileSync(statsPath, "utf8"));
    const pair = loadCodeIndexPair(repo);
    assert.equal(stats.fingerprint, pair.manifest.index_fingerprint);
    assert.equal(typeof stats.files["src/reader.ts"].size, "number");
    assert.equal(typeof stats.files["src/reader.ts"].mtime_ms, "number");
  });

  it("does not rebuild when only the mtime changed (content identical)", async () => {
    await syncCodeIndex(repo);
    const src = path.join(repo, "src/reader.ts");
    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(src, future, future);
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "fresh");
  });
});

const GO_SOURCE = `package reader

type Handle struct {
	Score int
}

func (h *Handle) Get() int { return h.Score }
`;

describe("syncCodeIndex (go)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "go.mod", "module example.com/reader\n\ngo 1.22\n");
    write(repo, "reader.go", GO_SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds a Go index end-to-end", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["reader.go"].language, "go");
    const handle = openCodeIndex(repo);
    assert.ok(
      handle.symbols().some((s) => s.name === "Handle" && s.kind === "struct"),
    );
    assert.ok(
      handle
        .symbols()
        .some((s) => s.name === "Get" && s.kind === "method" && s.scope === "Handle"),
    );
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("indexes mixed TS and Go files via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export class A {}");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 2);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["reader.go"].language, "go");
    assert.equal(pair.manifest.files["src/index.ts"].language, "typescript");
  });
});

const CS_SOURCE = `namespace App
{
    public class Reader
    {
        public int Score { get; set; }

        public int Get() { return this.Score; }
    }
}
`;

describe("syncCodeIndex (csharp)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(repo, "src/App/Reader.cs", CS_SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds a C# index end-to-end", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/App/Reader.cs"].language, "c-sharp");
    const handle = openCodeIndex(repo);
    assert.ok(
      handle.symbols().some((s) => s.name === "Reader" && s.kind === "class"),
    );
    assert.ok(
      handle.symbols().some((s) => s.name === "Score" && s.kind === "property"),
    );
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("indexes mixed TS, Go, and C# files via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "go.mod", "module example.com/x");
    write(repo, "main.go", "package main\n\nfunc main() {}\n");
    write(repo, "src/index.ts", "export class A {}");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 3);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(pair.manifest.files["main.go"].language, "go");
    assert.equal(pair.manifest.files["src/index.ts"].language, "typescript");
  });
});

const RS_SOURCE = `mod common;

pub struct Reader {
    score: u32,
}

impl Reader {
    pub fn get(&self) -> u32 {
        self.score
    }
}

pub fn open() -> Reader {
    Reader { score: 0 }
}
`;

describe("syncCodeIndex (rust)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "Cargo.toml", "[package]\nname = \"reader\"\nversion = \"0.1.0\"\n");
    write(repo, "src/reader.rs", RS_SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds a Rust index end-to-end", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/reader.rs"].language, "rust");
    const handle = openCodeIndex(repo);
    assert.ok(
      handle.symbols().some((s) => s.name === "Reader" && s.kind === "struct"),
    );
    assert.ok(
      handle
        .symbols()
        .some((s) => s.name === "get" && s.kind === "method" && s.scope === "Reader"),
    );
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("indexes mixed TS, Go, C#, and Rust files via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "go.mod", "module example.com/x");
    write(repo, "main.go", "package main\n\nfunc main() {}\n");
    write(repo, "src/index.ts", "export class A {}");
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(repo, "src/App/Reader.cs", "namespace App { public class Reader { } }");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 4);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/reader.rs"].language, "rust");
    assert.equal(pair.manifest.files["main.go"].language, "go");
    assert.equal(pair.manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(pair.manifest.files["src/index.ts"].language, "typescript");
  });
});

const PY_SOURCE = `DEFAULT_SCORE = 1

class Reader:
    def score(self):
        return DEFAULT_SCORE

def open_reader():
    return Reader()
`;

describe("syncCodeIndex (python)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "pyproject.toml", "[project]\nname = \"reader\"\n");
    write(repo, "src/reader.py", PY_SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds a Python index end-to-end", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/reader.py"].language, "python");
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "reader" && s.kind === "module"));
    assert.ok(
      handle.symbols().some((s) => s.name === "Reader" && s.kind === "class"),
    );
    assert.ok(
      handle
        .symbols()
        .some((s) => s.name === "score" && s.kind === "method" && s.scope === "Reader"),
    );
    assert.ok(
      handle.symbols().some((s) => s.name === "DEFAULT_SCORE" && s.kind === "const"),
    );
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("indexes all five languages via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "go.mod", "module example.com/x");
    write(repo, "main.go", "package main\n\nfunc main() {}\n");
    write(repo, "src/index.ts", "export class A {}");
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(repo, "src/App/Reader.cs", "namespace App { public class Reader { } }");
    write(repo, "Cargo.toml", "[package]\nname = \"reader\"\n");
    write(repo, "src/reader.rs", "pub struct Reader {}\n");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 5);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.files["src/reader.py"].language, "python");
    assert.equal(pair.manifest.files["src/reader.rs"].language, "rust");
    assert.equal(pair.manifest.files["main.go"].language, "go");
    assert.equal(pair.manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(pair.manifest.files["src/index.ts"].language, "typescript");
  });
});
