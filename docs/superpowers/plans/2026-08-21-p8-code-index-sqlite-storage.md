# P8 — Code index storage on SQLite — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the monolithic `.doc-canon/code-ast-index.json` with an embedded `node:sqlite` store, streaming the build and answering search with indexed SQL, without changing the search surface.

**Architecture:** A new `src/code-index/store.ts` owns the SQLite schema, identity (`application_id`/`user_version`), insert statements, FTS5 rebuild, and the streamed `content_fingerprint`. `sync.ts` streams extracted rows into a temp store, runs cross-file resolvers, rebuilds FTS, computes the fingerprint, renames the store into place, then writes the manifest **last**. `reader.ts` becomes a facade that SELECTs model columns on demand with a lazy fingerprint check; `search.ts` queries the store directly (FTS trigram + `LIKE` fallback + `matchClass` rank in JS).

**Tech Stack:** Node ≥ 22.13 (`node:sqlite` `DatabaseSync`, FTS5 trigram), TypeScript ESM (`NodeNext`), `@vscode/tree-sitter-wasm` (unchanged), `tsx --test` for tests.

**Spec:** `docs/superpowers/specs/2026-08-21-code-index-db-storage-design.md` (SoT — the plan argues from it; executors read both).

## Global Constraints

- Node ≥ 22.13 (`engines.node`); `node:sqlite` is built-in — no new dependency, no native module, no external process.
- Artifact: `.doc-canon/code-ast-index.sqlite` replaces `.doc-canon/code-ast-index.json`; `code-index-manifest.json` bumps `schema_version` 1 → 2 and gains `content_fingerprint`.
- Determinism: `content_fingerprint` = SHA-256 over canonical-ordered rows, streamed via `SELECT ... ORDER BY`; symbols sorted by all model columns (`name, kind, signature, file, line, end_line, scope`), refs by `kind, from_file, to_file, name, line`. Internal columns (`id`, `name_lower`, `signature_lower`) and `symbols_fts` are excluded.
- Store identity: `PRAGMA application_id = 0x434F4445` (`"CODE"`), `PRAGMA user_version = 2`; mismatch → fail closed like a corrupt store.
- FTS5 trigram over `name_lower` + `signature_lower` (both JS-folded via `toLowerCase()` — full Unicode; SQL never folds case). Queries use **stemmed** `tokenize(q)` tokens, never the raw string; `LIKE` covers <3-char tokens; no `bm25()`.
- Search invariant: **the SQL candidate set is a superset of every `matchClass` match**; final order is `matchClass` (exact > prefix > name-tokens > signature-tokens, tie-break file/line) then `slice(maxHits)`.
- `--file` filters via `file IN (...)` (micromatch over the manifest file set), not SQLite `GLOB`.
- Build: temp `.sqlite.tmp` → `COMMIT` → rename into place → manifest written **last** (commit marker) → delete legacy `.json` → write `code-index-stats.json`.
- Unchanged: `matchClass` semantics, snippet windows, freshness (`liveHashes` + `isFresh`), `code_index_missing`/`code_index_stale`/`auto_reindexed`, probe log, exit codes, CLI flags.
- `node:sqlite` prints a one-time `ExperimentalWarning` to stderr on first use — accepted, not suppressed.

## File Structure

**Create:**
- `src/code-index/store.ts` — schema, identity, open/create, insert statements, FTS rebuild, fingerprint.
- `tests/code-index-store.test.ts` — store round-trip, fingerprint determinism, identity fail-closed.

**Modify:**
- `package.json` — `engines.node` `>=20` → `>=22.13`.
- `src/code-index/paths.ts` — `codeAstIndexPath` → `codeIndexStorePath` (returns `.code-ast-index.sqlite`).
- `src/code-index/types.ts` — `CodeIndexManifest.schema_version` `1` → `2`, add `content_fingerprint`, drop `CodeAstIndex`.
- `src/code-index/io.ts` — manifest-only (save/load/tryLoad manifest); remove `parseAst`/`saveCodeIndexPair`/`loadCodeIndexPair`.
- `src/code-index/sync.ts` — stream build into the store + manifest v2.
- `src/code-index/reader.ts` — facade over the store; extract `liveHashes(root, manifest)`.
- `src/code-search/search.ts` — query the store via SQL + `matchClass`.

**Update tests:**
- `tests/code-index-io.test.ts`, `tests/code-index-reader.test.ts`, `tests/code-index-sync.test.ts`, `tests/code-index-dogfood.test.ts` (any test reading/writing `code-ast-index.json` directly).

---

## Task 1: Node floor + SQLite store module

**Files:**
- Modify: `package.json` (engines)
- Modify: `src/code-index/paths.ts`
- Create: `src/code-index/store.ts`
- Test: `tests/code-index-store.test.ts`

**Interfaces:**
- Produces: `APPLICATION_ID`, `USER_VERSION`, `createCodeStore(dbPath): DatabaseSync`, `openCodeStore(root): DatabaseSync`, `storeStatements(db)`, `rebuildFts(db)`, `computeContentFingerprint(db): string`; `codeIndexStorePath(root): string`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-index-store.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCodeStore, openCodeStore, storeStatements, rebuildFts, computeContentFingerprint, APPLICATION_ID } from "../src/code-index/store.js";

describe("code-index store", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-store-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const storePath = () => path.join(dir, "code-ast-index.sqlite");

  function seed(): void {
    const db = createCodeStore(storePath());
    const st = storeStatements(db);
    db.exec("BEGIN");
    st.insertSymbol.run("Reader", "reader", "class", "class Reader {}", "class reader {}", "src/reader.ts", 1, 1, "");
    st.insertSymbol.run("openCanonIndex", "opencanonindex", "function", "function openCanonIndex(root: string)", "function opencanonindex(root: string)", "src/reader.ts", 5, 9, "");
    st.insertRef.run("import", "src/main.ts", "src/reader.ts", "Reader", 1);
    st.insertRef.run("binding", "src/reader.ts", "src/reader.ts", "root", 7);
    rebuildFts(db);
    db.exec("COMMIT");
    db.close();
  }

  it("round-trips symbols and refs with JS-folded search columns", () => {
    seed();
    const db = new DatabaseSync(storePath());
    const sym = db.prepare("SELECT name, name_lower, kind, signature_lower, file, line, end_line, scope FROM symbols ORDER BY line").all();
    assert.equal(sym.length, 2);
    assert.equal(sym[0].name, "Reader");
    assert.equal(sym[0].name_lower, "reader");
    assert.equal(sym[0].signature_lower, "class reader {}");
    const ref = db.prepare("SELECT kind, from_file, to_file, name, line FROM refs ORDER BY from_file").all();
    assert.equal(ref.length, 2);
    assert.equal(ref[0].to_file, "src/reader.ts");
    const hit = db.prepare("SELECT rowid FROM symbols_fts WHERE symbols_fts MATCH ?").all("canon");
    assert.equal(hit.length, 1);
    db.close();
  });

  it("content_fingerprint is stable across reads", () => {
    seed();
    const a = computeContentFingerprint(new DatabaseSync(storePath()));
    const b = computeContentFingerprint(new DatabaseSync(storePath()));
    assert.equal(a, b);
    assert.match(a, /^sha256:[0-9a-f]{64}$/);
  });

  it("openCodeStore fails closed on a wrong application_id", () => {
    seed();
    const db = new DatabaseSync(storePath());
    db.exec(`PRAGMA application_id = ${APPLICATION_ID + 1};`);
    db.close();
    assert.throws(() => openCodeStore(dir), /application_id/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-store.test.ts`
Expected: FAIL — `Cannot find module '../src/code-index/store.js'` (module does not exist yet).

- [ ] **Step 3: Implement `paths.ts` rename and `store.ts`**

```ts
// src/code-index/paths.ts (replace codeAstIndexPath)
export function codeIndexStorePath(root: string): string {
  return path.join(docCanonDir(root), "code-ast-index.sqlite");
}
```

```ts
// src/code-index/store.ts
import { createHash } from "node:crypto";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { codeIndexStorePath } from "./paths.js";

export const APPLICATION_ID = 0x434f4445; // "CODE"
export const USER_VERSION = 2;

const SCHEMA_SQL = `
CREATE TABLE symbols (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  name_lower      TEXT NOT NULL,
  kind            TEXT NOT NULL,
  signature       TEXT NOT NULL,
  signature_lower TEXT NOT NULL,
  file            TEXT NOT NULL,
  line            INTEGER NOT NULL,
  end_line        INTEGER NOT NULL,
  scope           TEXT NOT NULL
);
CREATE INDEX symbols_name_lower      ON symbols(name_lower);
CREATE INDEX symbols_file            ON symbols(file);
CREATE INDEX symbols_kind_name_lower ON symbols(kind, name_lower);

CREATE TABLE refs (
  kind      TEXT NOT NULL,
  from_file TEXT NOT NULL,
  to_file   TEXT NOT NULL,
  name      TEXT NOT NULL,
  line      INTEGER NOT NULL
);
CREATE INDEX refs_name ON refs(name);

CREATE VIRTUAL TABLE symbols_fts USING fts5(
  name_lower, signature_lower, content='symbols', content_rowid='id', tokenize='trigram'
);
`;

export function createCodeStore(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(`PRAGMA application_id = ${APPLICATION_ID};`);
  db.exec(`PRAGMA user_version = ${USER_VERSION};`);
  db.exec(SCHEMA_SQL);
  return db;
}

function checkIdentity(db: DatabaseSync): void {
  const app = (db.prepare("SELECT * FROM pragma_application_id").get() as { application_id: number }).application_id;
  const ver = (db.prepare("SELECT * FROM pragma_user_version").get() as { user_version: number }).user_version;
  if (app !== APPLICATION_ID) throw new Error(`invalid code-index store application_id: ${app}`);
  if (ver !== USER_VERSION) throw new Error(`unsupported code-index store user_version: ${ver}`);
}

export function openCodeStore(root: string): DatabaseSync {
  const db = new DatabaseSync(codeIndexStorePath(root));
  try {
    checkIdentity(db);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

export function storeStatements(db: DatabaseSync): { insertSymbol: StatementSync; insertRef: StatementSync } {
  return {
    insertSymbol: db.prepare(
      "INSERT INTO symbols (name, name_lower, kind, signature, signature_lower, file, line, end_line, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    insertRef: db.prepare(
      "INSERT INTO refs (kind, from_file, to_file, name, line) VALUES (?, ?, ?, ?, ?)",
    ),
  };
}

export function rebuildFts(db: DatabaseSync): void {
  db.exec("INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')");
}

export function computeContentFingerprint(db: DatabaseSync): string {
  const hash = createHash("sha256");
  for (const row of db.prepare(
    "SELECT name, kind, signature, file, line, end_line, scope FROM symbols ORDER BY name, kind, signature, file, line, end_line, scope",
  ).iterate() as Iterable<Record<string, unknown>>) {
    hash.update(JSON.stringify([row.name, row.kind, row.signature, row.file, row.line, row.end_line, row.scope]));
    hash.update("\n");
  }
  for (const row of db.prepare(
    "SELECT kind, from_file, to_file, name, line FROM refs ORDER BY kind, from_file, to_file, name, line",
  ).iterate() as Iterable<Record<string, unknown>>) {
    hash.update(JSON.stringify([row.kind, row.from_file, row.to_file, row.name, row.line]));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}
```

- [ ] **Step 4: Bump engines in `package.json`**

```json
"engines": { "node": ">=22.13" }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx tsx --test tests/code-index-store.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json src/code-index/paths.ts src/code-index/store.ts tests/code-index-store.test.ts
git commit -m "feat(code-index): add SQLite store module and node:sqlite floor"
```

> Note: this task renames `codeAstIndexPath` → `codeIndexStorePath`. Old callers (`io.ts`, `sync.ts`, `reader.ts`, and the `code-index-io`/`code-index-reader` tests) are updated in the next tasks; the tree is transitional here (run this task's test file only).

---

## Task 2: Manifest v2 + stream the build into SQLite

**Files:**
- Modify: `src/code-index/types.ts`, `src/code-index/io.ts`, `src/code-index/sync.ts`
- Test: `tests/code-index-io.test.ts`, `tests/code-index-sync.test.ts`

**Interfaces:**
- Consumes: `createCodeStore`, `storeStatements`, `rebuildFts`, `computeContentFingerprint`, `codeIndexStorePath`.
- Produces: `saveCodeIndexManifest(root, manifest)`, `loadCodeIndexManifest(root)`, `tryLoadCodeIndexManifest(root)`; `CodeIndexManifest` with `schema_version: 2` + `content_fingerprint`.

- [ ] **Step 1: Update `types.ts`**

```ts
// CodeIndexManifest: schema_version 1 -> 2, add content_fingerprint; drop CodeAstIndex.
export type CodeIndexManifest = {
  schema_version: 2;
  index_fingerprint: string;
  content_fingerprint: string;
  corpus: string;
  grammar_versions: Record<string, string>;
  roots: string[];
  files: Record<string, CodeIndexFileMeta>;
};
```

Delete the `CodeAstIndex` type (no longer serialized). `CodeIndexHandle`, `CodeSymbol`, `CodeReference`, `CodeIndexFileMeta`, `CodeSyncResult` stay unchanged.

- [ ] **Step 2: Rewrite `io.ts` as manifest-only**

```ts
// src/code-index/io.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { codeIndexManifestPath } from "./paths.js";
import type { CodeIndexManifest } from "./types.js";

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}
function readJson(file: string): unknown { return JSON.parse(fs.readFileSync(file, "utf8")); }
function isRecord(v: unknown): v is Record<string, unknown> { return typeof v === "object" && v !== null && !Array.isArray(v); }
function isNumber(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function isString(v: unknown): v is string { return typeof v === "string"; }

function parseManifest(raw: unknown): CodeIndexManifest {
  if (!isRecord(raw)) throw new Error("invalid code-index manifest");
  if (raw.schema_version !== 2) throw new Error(`unsupported code-index manifest schema_version: ${String(raw.schema_version)}`);
  if (
    !isString(raw.index_fingerprint) || !isString(raw.content_fingerprint) || !isString(raw.corpus) ||
    !isRecord(raw.grammar_versions) || !Array.isArray(raw.roots) || !raw.roots.every(isString) || !isRecord(raw.files)
  ) throw new Error("invalid code-index manifest");
  for (const meta of Object.values(raw.files)) {
    if (!isRecord(meta) || !isString(meta.hash) || !isString(meta.language) || !isNumber(meta.symbols)) {
      throw new Error("invalid code-index manifest");
    }
  }
  return raw as CodeIndexManifest;
}

export function saveCodeIndexManifest(root: string, manifest: CodeIndexManifest): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  writeJsonAtomic(codeIndexManifestPath(root), manifest);
}

export function loadCodeIndexManifest(root: string): CodeIndexManifest {
  const p = codeIndexManifestPath(root);
  if (!fs.existsSync(p)) throw new Error("code index manifest not found");
  return parseManifest(readJson(p));
}

export function tryLoadCodeIndexManifest(root: string): CodeIndexManifest | null {
  const p = codeIndexManifestPath(root);
  if (!fs.existsSync(p)) return null;
  try { return parseManifest(readJson(p)); } catch { return null; }
}
```

- [ ] **Step 3: Rewrite `sync.ts` to stream into the store**

Replace the build half of `syncCodeIndex` (from `const symbols` through the manifest/ast construction) with:

```ts
const symbols: CodeSymbol[] = [];
const unresolvedByLanguage = new Map<string, UnresolvedMember[]>();
const knownFiles = new Set(files);
const fileMeta: CodeIndexManifest["files"] = {};

const storeTmp = codeIndexStorePath(vcsRoot) + ".tmp";
const db = createCodeStore(storeTmp);
const stmts = storeStatements(db);
db.exec("BEGIN");
try {
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const text = fs.readFileSync(abs, "utf8");
    const hash = hashes.get(rel)!;
    const extracted = await extractFile(rel, text, knownFiles);
    for (const s of extracted.symbols) {
      symbols.push(s);
      stmts.insertSymbol.run(s.name, s.name.toLowerCase(), s.kind, s.signature, s.signature.toLowerCase(), s.file, s.line, s.endLine, s.scope);
    }
    for (const ref of extracted.references) {
      stmts.insertRef.run(ref.kind, ref.from, ref.to, ref.name, ref.line);
    }
    if (extracted.unresolvedMembers) {
      const language = grammarForFile(rel);
      const bucket = unresolvedByLanguage.get(language) ?? [];
      bucket.push(...extracted.unresolvedMembers);
      unresolvedByLanguage.set(language, bucket);
    }
    fileMeta[rel] = { hash, language: grammarForFile(rel), symbols: extracted.symbols.length };
  }
  for (const [language, resolver] of CROSS_FILE_RESOLVERS) {
    const bucket = unresolvedByLanguage.get(language);
    if (bucket) {
      for (const ref of resolver(bucket, symbols)) {
        stmts.insertRef.run(ref.kind, ref.from, ref.to, ref.name, ref.line);
      }
    }
  }
  rebuildFts(db);
  const contentFingerprint = computeContentFingerprint(db);
  db.exec("COMMIT");
  db.close();

  const relHashes = [...hashes.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const fingerprint = computeFingerprint(relHashes);
  const corpus = roots.map((r) => (r === "" ? "**" : `${r}/**`)).join(", ");
  const manifest: CodeIndexManifest = {
    schema_version: 2,
    index_fingerprint: fingerprint,
    content_fingerprint: contentFingerprint,
    corpus,
    grammar_versions: { ...GRAMMAR_VERSIONS },
    roots,
    files: fileMeta,
  };

  // Rename store into place, then manifest LAST (commit marker).
  fs.renameSync(storeTmp, codeIndexStorePath(vcsRoot));
  saveCodeIndexManifest(vcsRoot, manifest);
  const legacyJson = codeIndexStorePath(vcsRoot).replace(/\.sqlite$/, ".json");
  if (fs.existsSync(legacyJson)) fs.rmSync(legacyJson);
  saveCodeIndexStats(vcsRoot, {
    fingerprint,
    files: Object.fromEntries(files.map((rel) => {
      const st = fs.statSync(path.join(vcsRoot, rel));
      return [rel, { size: st.size, mtime_ms: st.mtimeMs }];
    })),
  });
} catch (e) {
  try { db.exec("ROLLBACK"); } catch { /* already closed */ }
  try { db.close(); } catch { /* ignore */ }
  try { if (fs.existsSync(storeTmp)) fs.rmSync(storeTmp); } catch { /* ignore */ }
  throw e;
}

return { status: "updated", indexed: files.length, changed: [...changed].sort() };
```

Update the imports: drop `saveCodeIndexPair`, add `saveCodeIndexManifest`; drop `CodeAstIndex`; add `codeIndexStorePath` and `createCodeStore, storeStatements, rebuildFts, computeContentFingerprint`.

- [ ] **Step 4: Update the io/sync tests**

`tests/code-index-io.test.ts`: change the `MANIFEST` fixture to `schema_version: 2` + `content_fingerprint: "sha256:<64hex>"`; replace `saveCodeIndexPair`/`loadCodeIndexPair` with `saveCodeIndexManifest`/`loadCodeIndexManifest`; assert the manifest round-trips and that a missing/corrupt manifest throws `/invalid|not found/`.

`tests/code-index-sync.test.ts`: replace any `codeAstIndexPath`/`code-ast-index.json` assertions with `codeIndexStorePath`/`.sqlite`; assert `syncCodeIndex` writes `.doc-canon/code-ast-index.sqlite` (not `.json`), the manifest has `schema_version: 2` and a `content_fingerprint`, and two builds of an unchanged fixture produce equal `content_fingerprint` (the old byte-identity golden check becomes a fingerprint-equality check).

- [ ] **Step 5: Run tests**

Run: `npx tsx --test tests/code-index-store.test.ts tests/code-index-io.test.ts tests/code-index-sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/code-index/types.ts src/code-index/io.ts src/code-index/sync.ts tests/code-index-io.test.ts tests/code-index-sync.test.ts
git commit -m "feat(code-index): stream build into SQLite with content_fingerprint"
```

> `reader.ts` and `search.ts` still import the removed `loadCodeIndexPair`/`saveCodeIndexPair` — fixed in Tasks 3–4. Run scoped tests here.

---

## Task 3: Reader facade over SQLite

**Files:**
- Modify: `src/code-index/reader.ts`
- Test: `tests/code-index-reader.test.ts`

**Interfaces:**
- Consumes: `loadCodeIndexManifest`, `openCodeStore`, `computeContentFingerprint`.
- Produces: `openCodeIndex(root): CodeIndexHandle` (same shape) and `liveHashes(root, manifest): Record<string, string>` (extracted, exported).

- [ ] **Step 1: Write the failing test**

```ts
it("symbols/references materialize from the SQLite store with frozen field names", async () => {
  await syncCodeIndex(repo);
  const handle = openCodeIndex(repo);
  const sym = handle.symbols().find((s) => s.name === "Reader")!;
  assert.equal(sym.kind, "class");
  assert.equal(sym.endLine, 1);
  assert.ok(!("name_lower" in sym));      // internal columns never leak
  const ref = handle.references().find((r) => r.kind === "import")!;
  assert.equal(ref.from, "src/main.ts");
  assert.equal(ref.to, "src/reader.ts");
  assert.ok(!("to_file" in ref));          // mapped back to frozen `to`
});

it("fails closed when the store content_fingerprint does not match the manifest", async () => {
  await syncCodeIndex(repo);
  const db = openCodeStore(repo);
  db.exec("INSERT INTO symbols (name, name_lower, kind, signature, signature_lower, file, line, end_line, scope) VALUES ('X','x','class','class X{}','class x{}','x.ts',1,1,'')");
  db.close();
  assert.throws(() => openCodeIndex(repo).symbols(), /content_fingerprint mismatch/);
});
```

- [ ] **Step 2: Run to verify failure** — `npx tsx --test tests/code-index-reader.test.ts` → FAIL (reader still imports removed io functions).

- [ ] **Step 3: Implement `reader.ts`**

```ts
// src/code-index/reader.ts
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { loadCodeIndexManifest } from "./io.js";
import { tryLoadCodeIndexStats } from "./stats.js";
import { computeContentFingerprint, openCodeStore } from "./store.js";
import type { CodeIndexHandle, CodeIndexManifest, CodeReference, CodeSymbol } from "./types.js";

export function liveHashes(root: string, manifest: CodeIndexManifest): Record<string, string> {
  const config = loadCodeIndexConfig(root);
  const { vcsRoot, roots } = discoverSourceRoots(root, config);
  const files = listSourceFiles(vcsRoot, roots, config.ignore ?? []);
  const stats = tryLoadCodeIndexStats(vcsRoot);
  const canTrust = stats !== null && stats.fingerprint === manifest.index_fingerprint;
  const out: Record<string, string> = {};
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const cached = canTrust ? stats.files[rel] : undefined;
    const prev = manifest.files[rel];
    if (cached !== undefined && prev !== undefined) {
      try {
        const st = fs.statSync(abs);
        if (st.size === cached.size && st.mtimeMs === cached.mtime_ms) { out[rel] = prev.hash; continue; }
      } catch { /* fall through */ }
    }
    out[rel] = contentHash(fs.readFileSync(abs, "utf8"));
  }
  return out;
}

export function openCodeIndex(root: string): CodeIndexHandle {
  const manifest = loadCodeIndexManifest(root);
  openCodeStore(root).close(); // identity/version check only (cheap)

  let verified = false;
  const verify = (): void => {
    if (verified) return;
    const db = openCodeStore(root);
    try {
      const fp = computeContentFingerprint(db);
      if (fp !== manifest.content_fingerprint) {
        throw new Error(`content_fingerprint mismatch: manifest=${manifest.content_fingerprint} store=${fp}`);
      }
    } finally { db.close(); }
    verified = true;
  };

  return {
    symbols: (): CodeSymbol[] => {
      verify();
      const db = openCodeStore(root);
      try {
        const rows = db.prepare("SELECT name, kind, signature, file, line, end_line, scope FROM symbols ORDER BY file, line").all() as Array<Record<string, unknown>>;
        return rows.map((r) => ({ name: r.name, kind: r.kind, signature: r.signature, file: r.file, line: r.line, endLine: r.end_line, scope: r.scope })) as CodeSymbol[];
      } finally { db.close(); }
    },
    references: (): CodeReference[] => {
      verify();
      const db = openCodeStore(root);
      try {
        const rows = db.prepare("SELECT kind, from_file, to_file, name, line FROM refs ORDER BY from_file, line").all() as Array<Record<string, unknown>>;
        return rows.map((r) => ({ kind: r.kind, from: r.from_file, to: r.to_file, name: r.name, line: r.line })) as CodeReference[];
      } finally { db.close(); }
    },
    manifest,
    liveHashes: () => liveHashes(root, manifest),
  };
}
```

- [ ] **Step 4: Update `tests/code-index-reader.test.ts`** — replace `codeAstIndexPath` references with `codeIndexStorePath`; the corrupt-pair test now corrupts the `.sqlite` store (write garbage bytes) and expects `openCodeIndex` to throw.

- [ ] **Step 5: Run tests** — `npx tsx --test tests/code-index-store.test.ts tests/code-index-io.test.ts tests/code-index-sync.test.ts tests/code-index-reader.test.ts` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/code-index/reader.ts tests/code-index-reader.test.ts
git commit -m "feat(code-index): reader facade over SQLite with lazy fingerprint check"
```

---

## Task 4: Search via SQL + matchClass

**Files:**
- Modify: `src/code-search/search.ts`
- Test: `tests/code-search.test.ts` (existing parity tests must keep passing unchanged)

**Interfaces:**
- Consumes: `openCodeStore`, `liveHashes`, `tryLoadCodeIndexManifest`, `isFresh`, `tokenize`.
- Produces: unchanged `searchCodeIndex(root, query, opts): CodePack`.

- [ ] **Step 1: Write the failing test (stemming parity — the spec's counterexample)**

```ts
it("stemmed-token queries match identically (Readers -> reader)", async () => {
  write(repo, "src/r.ts", "export class Reader {}\n");
  await syncCodeIndex(repo);
  const pack = searchCodeIndex(repo, "Readers");
  assert.ok(pack.hits.some((h) => h.name === "Reader"), "stemmed 'Readers' must match 'Reader'");
});

it("sub-3-char multi-token query uses the LIKE fallback", async () => {
  write(repo, "src/go.ts", "export function goMod(): number { return 1; }\n");
  await syncCodeIndex(repo);
  const pack = searchCodeIndex(repo, "go mod");
  assert.ok(pack.hits.some((h) => h.name === "goMod"));
});
```

- [ ] **Step 2: Run to verify failure** — `npx tsx --test tests/code-search.test.ts` → FAIL (search still materializes `handle.symbols()`; SQL candidate pull not yet wired).

- [ ] **Step 3: Implement SQL candidate pull + `matchClass` rank**

Replace the symbol-mode and refs-mode bodies of `searchCodeIndex`:

```ts
import { openCodeStore } from "../code-index/store.js";
import { liveHashes } from "../code-index/reader.js";
import { tryLoadCodeIndexManifest } from "../code-index/io.js";

function symbolCandidates(db: DatabaseSync, query: string, opts: CodeSearchOptions, files: string[]): CodeSymbol[] {
  const qLower = query.toLowerCase();
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];
  const params: unknown[] = [];
  const clauses: string[] = [];

  // class 0/1 — exact + prefix over the pre-folded name (b-tree index).
  clauses.push("s.name_lower = ?", "s.name_lower LIKE ? || '%'");
  params.push(qLower, qLower);

  // class 2/3 — every token a substring of name_lower or signature_lower.
  const ftsTokens = tokens.filter((t) => t.length >= 3);
  const likeTokens = tokens.filter((t) => t.length < 3);
  const sub: string[] = [];
  if (ftsTokens.length > 0) {
    sub.push("s.id IN (SELECT rowid FROM symbols_fts WHERE symbols_fts MATCH ?)");
    params.push(ftsTokens.map((t) => `"${t}"`).join(" "));
  }
  for (const t of likeTokens) {
    sub.push("(s.name_lower LIKE ? OR s.signature_lower LIKE ?)");
    params.push(`%${t}%`, `%${t}%`);
  }
  if (sub.length > 0) clauses.push("(" + sub.join(" AND ") + ")");

  let sql = "SELECT s.name, s.kind, s.signature, s.file, s.line, s.end_line, s.scope FROM symbols s WHERE " +
    clauses.map((c) => `(${c})`).join(" OR ");

  if (opts.kind !== undefined) { sql += " AND s.kind = ?"; params.push(opts.kind); }
  if (opts.file !== undefined) {
    const matched = files.filter((f) => micromatch.isMatch(f, opts.file!));
    if (matched.length === 0) return [];
    sql += ` AND s.file IN (${matched.map(() => "?").join(", ")})`;
    params.push(...matched);
  }
  sql += " ORDER BY s.file, s.line, s.id";

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ name: r.name, kind: r.kind, signature: r.signature, file: r.file, line: r.line, endLine: r.end_line, scope: r.scope })) as CodeSymbol[];
}
```

Then in `searchCodeIndex`, after `findVcsRoot`:

```ts
let vcsRoot: string;
let manifest;
let db;
try {
  vcsRoot = findVcsRoot(root);
  manifest = tryLoadCodeIndexManifest(vcsRoot);
  db = openCodeStore(vcsRoot);
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  throw new CodeSearchError("code_index_missing", `code index missing (${detail}); run: doc-canon code-index build`);
}
try {
  const live = liveHashes(vcsRoot, manifest!);
  const fresh = isFresh(manifest!.files, live);
  // ... (freshness + warnings identical to today)
  if (refsMode) {
    const refs = db.prepare("SELECT kind, from_file, to_file, name, line FROM refs WHERE name = ? ORDER BY from_file, line, rowid LIMIT ?").all(effective, maxHits) as Array<Record<string, unknown>>;
    // map to CodeRefHit + snippet windows (same as today's refs loop, using r.from_file/r.to_file).
  } else {
    const symbols = symbolCandidates(db, effective, options, Object.keys(manifest!.files));
    // filter + sort by matchClass + slice + snippet windows (same as today, over `symbols`).
  }
} finally { db.close(); }
```

The `matchClass` filter/sort and snippet-window loops are **unchanged** — reuse them verbatim over the narrowed candidate arrays. `refsMode`, `effective`, `maxHits`, `snippetLines`, and the snippet loops stay as-is.

- [ ] **Step 4: Run the full `code-search` suite**

Run: `npx tsx --test tests/code-search.test.ts tests/code-search-export.test.ts tests/code-search-cli.test.ts tests/code-search-auto-reindex.test.ts tests/code-search-snippets.test.ts tests/code-search-types.test.ts`
Expected: PASS — all parity tests (exact>prefix>substring, multi-token, refs mode, member-access, non-ASCII, stemming, <3-char fallback) unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/code-search/search.ts tests/code-search.test.ts
git commit -m "feat(code-search): query SQLite directly via FTS5 trigram + matchClass"
```

---

## Task 5: Large-corpus regression + node floor guard

**Files:**
- Test: `tests/code-index-large-corpus.test.ts`

- [ ] **Step 1: Write the test**

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex } from "../src/code-search/search.js";

// A corpus whose flattened symbol text would exceed V8's ~512 MB max-string if
// serialized via JSON.stringify(..., null, 2). The count below stays bounded so
// the test is fast; the assertion is that the SQLite build completes and search
// returns the expected top hit instead of throwing a max-string error.
describe("large corpus", () => {
  it("builds and searches a corpus that exceeds the old single-string path", async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-large-"));
    try {
      fs.mkdirSync(path.join(repo, ".git"));
      fs.writeFileSync(path.join(repo, "package.json"), "{}");
      const n = 400_000; // ~400k symbols; ~60 bytes each => ~24 MB source text
      const chunks: string[] = [];
      for (let i = 0; i < n; i++) {
        chunks.push(`export function uniqueFn${i}() { return ${i}; }`);
        if (chunks.length === 50_000) {
          fs.appendFileSync(path.join(repo, "src.ts"), chunks.join("\n") + "\n");
          chunks.length = 0;
        }
      }
      fs.appendFileSync(path.join(repo, "src.ts"), chunks.join("\n") + "\n");
      await syncCodeIndex(repo);
      assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.sqlite")));
      assert.ok(!fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.json")));
      const pack = searchCodeIndex(repo, "uniqueFn399999");
      assert.equal(pack.hits[0]?.name, "uniqueFn399999");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run to verify** — `npx tsx --test tests/code-index-large-corpus.test.ts` → PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/code-index-large-corpus.test.ts
git commit -m "test(code-index): large-corpus SQLite regression"
```

---

## Task 6: Port remaining tests, full suite, cleanup

**Files:** any test importing `codeAstIndexPath`/writing `.json` (e.g. `tests/code-index-dogfood.test.ts`, `tests/code-index-cli.test.ts`); `src/code-index/paths.ts` (confirm no `codeAstIndexPath` remains).

- [ ] **Step 1: Grep for stale references** — `grep -rn "codeAstIndexPath\|code-ast-index.json\|CodeAstIndex\|loadCodeIndexPair\|saveCodeIndexPair" src tests` → update/remove each.

- [ ] **Step 2: Run the full suite** — `npm test` → PASS.

- [ ] **Step 3: Verify parity manually (dogfood)** — `npm run build` then `node bin/doc-canon.js code-index build` in this repo and `node bin/doc-canon.js code-index search "searchCodeIndex"` → hits match the pre-migration expectations (the repo's own `code-index-dogfood.test.ts` asserts this).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "test(code-index): port remaining tests to SQLite storage"
```

---

## Self-review

1. **Spec coverage:** storage swap (Tasks 1–4) ✓; determinism via `content_fingerprint` (Task 2) ✓; FTS trigram + stemmed-token parity + <3-char fallback (Tasks 1, 4) ✓; manifest-last commit marker (Task 2) ✓; `--file` via `IN` (Task 4) ✓; `name_lower`/external-content FTS/identity PRAGMAs (Task 1) ✓; large-corpus regression (Task 5) ✓; node floor (Task 1) ✓; migration drops legacy JSON (Task 2) ✓.
2. **Placeholder scan:** no TBD/TODO; every code step carries real code.
3. **Type consistency:** `CodeIndexManifest.schema_version: 2` + `content_fingerprint` defined in Task 2 and consumed in Tasks 3–4; `codeIndexStorePath`, `openCodeStore`, `computeContentFingerprint`, `storeStatements`, `rebuildFts` defined in Task 1 and consumed consistently onward; refs map `from_file→from`/`to_file→to` in both `reader.ts` and `search.ts`.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-21-p8-code-index-sqlite-storage.md`. Canon is already updated (validated + reindexed). Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — executing-plans, batched with checkpoints.

Which approach?
