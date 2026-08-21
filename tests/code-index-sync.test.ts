// tests/code-index-sync.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexManifest } from "../src/code-index/io.js";
import { codeIndexStorePath } from "../src/code-index/paths.js";
import { openCodeStore } from "../src/code-index/store.js";

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

type StoreSymbol = { name: string; kind: string; scope: string; file: string };

function storeSymbols(root: string): StoreSymbol[] {
  const db = openCodeStore(root);
  try {
    return db.prepare("SELECT name, kind, scope, file FROM symbols").all() as StoreSymbol[];
  } finally {
    db.close();
  }
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

  it("builds the store and manifest, openable via the store", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.schema_version, 2);
    assert.match(manifest.content_fingerprint, /^sha256:[0-9a-f]{64}$/);
    assert.equal(manifest.roots.length, 1);
    assert.equal(manifest.files["src/reader.ts"].language, "typescript");
    assert.ok(manifest.files["src/reader.ts"].symbols > 0);
    assert.ok(fs.existsSync(codeIndexStorePath(repo)));
    const symbols = storeSymbols(repo);
    assert.ok(symbols.some((s) => s.name === "Reader"));
  });

  it("writes a .sqlite store, not a legacy .json AST", async () => {
    await syncCodeIndex(repo);
    assert.ok(fs.existsSync(codeIndexStorePath(repo)));
    assert.ok(codeIndexStorePath(repo).endsWith(".sqlite"));
    assert.equal(fs.existsSync(codeIndexStorePath(repo).replace(/\.sqlite$/, ".json")), false);
  });

  it("produces equal content_fingerprint across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const manifest1 = loadCodeIndexManifest(repo);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const manifest2 = loadCodeIndexManifest(repo);
    assert.equal(manifest2.content_fingerprint, manifest1.content_fingerprint);
    assert.equal(manifest2.index_fingerprint, manifest1.index_fingerprint);
  });

  it("returns fresh and does not rewrite when unchanged", async () => {
    await syncCodeIndex(repo);
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const before = fs.readFileSync(manifestPath, "utf8");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "fresh");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
  });

  it("rebuilds on edit and changes the content_fingerprint", async () => {
    await syncCodeIndex(repo);
    const before = loadCodeIndexManifest(repo).content_fingerprint;
    write(repo, "src/reader.ts", SOURCE + "\nexport const extra = 1;");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.ok(r.changed.includes("src/reader.ts"));
    assert.notEqual(loadCodeIndexManifest(repo).content_fingerprint, before);
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(stats.fingerprint, manifest.index_fingerprint);
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["reader.go"].language, "go");
    const symbols = storeSymbols(repo);
    assert.ok(
      symbols.some((s) => s.name === "Handle" && s.kind === "struct"),
    );
    assert.ok(
      symbols.some((s) => s.name === "Get" && s.kind === "method" && s.scope === "Handle"),
    );
  });

  it("produces equal content_fingerprint across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const manifest1 = loadCodeIndexManifest(repo);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const manifest2 = loadCodeIndexManifest(repo);
    assert.equal(manifest2.content_fingerprint, manifest1.content_fingerprint);
  });

  it("indexes mixed TS and Go files via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export class A {}");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 2);
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["reader.go"].language, "go");
    assert.equal(manifest.files["src/index.ts"].language, "typescript");
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/App/Reader.cs"].language, "c-sharp");
    const symbols = storeSymbols(repo);
    assert.ok(
      symbols.some((s) => s.name === "Reader" && s.kind === "class"),
    );
    assert.ok(
      symbols.some((s) => s.name === "Score" && s.kind === "property"),
    );
  });

  it("produces equal content_fingerprint across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const manifest1 = loadCodeIndexManifest(repo);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const manifest2 = loadCodeIndexManifest(repo);
    assert.equal(manifest2.content_fingerprint, manifest1.content_fingerprint);
  });

  it("indexes mixed TS, Go, and C# files via the dispatcher", async () => {
    write(repo, "package.json", "{}");
    write(repo, "go.mod", "module example.com/x");
    write(repo, "main.go", "package main\n\nfunc main() {}\n");
    write(repo, "src/index.ts", "export class A {}");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 3);
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(manifest.files["main.go"].language, "go");
    assert.equal(manifest.files["src/index.ts"].language, "typescript");
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/reader.rs"].language, "rust");
    const symbols = storeSymbols(repo);
    assert.ok(
      symbols.some((s) => s.name === "Reader" && s.kind === "struct"),
    );
    assert.ok(
      symbols.some((s) => s.name === "get" && s.kind === "method" && s.scope === "Reader"),
    );
  });

  it("produces equal content_fingerprint across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const manifest1 = loadCodeIndexManifest(repo);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const manifest2 = loadCodeIndexManifest(repo);
    assert.equal(manifest2.content_fingerprint, manifest1.content_fingerprint);
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/reader.rs"].language, "rust");
    assert.equal(manifest.files["main.go"].language, "go");
    assert.equal(manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(manifest.files["src/index.ts"].language, "typescript");
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/reader.py"].language, "python");
    const symbols = storeSymbols(repo);
    assert.ok(symbols.some((s) => s.name === "reader" && s.kind === "module"));
    assert.ok(symbols.some((s) => s.name === "Reader" && s.kind === "class"));
    assert.ok(
      symbols.some((s) => s.name === "score" && s.kind === "method" && s.scope === "Reader"),
    );
    assert.ok(
      symbols.some((s) => s.name === "DEFAULT_SCORE" && s.kind === "const"),
    );
  });

  it("produces equal content_fingerprint across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const manifest1 = loadCodeIndexManifest(repo);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const manifest2 = loadCodeIndexManifest(repo);
    assert.equal(manifest2.content_fingerprint, manifest1.content_fingerprint);
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
    const manifest = loadCodeIndexManifest(repo);
    assert.equal(manifest.files["src/reader.py"].language, "python");
    assert.equal(manifest.files["src/reader.rs"].language, "rust");
    assert.equal(manifest.files["main.go"].language, "go");
    assert.equal(manifest.files["src/App/Reader.cs"].language, "c-sharp");
    assert.equal(manifest.files["src/index.ts"].language, "typescript");
  });
});
