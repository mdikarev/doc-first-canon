# P2b — Code search tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `doc-canon code-index search <query>` (symbol substring search with kind/file filters and a syntactic `--refs` mode) over the P2a code AST index, plus the public `doc-canon/code-search` library contract — bounded results, freshness at search time, deterministic output.

**Architecture:** A new `src/code-search/` library (`types.ts`, `snippets.ts`, `search.ts`) reuses the existing `openCodeIndex` reader facade from `src/code-index/reader.ts` and a shared `isFresh` freshness helper extracted from `src/search/search.ts` into `src/agnostic/freshness.ts`. A thin CLI command (`src/commands/code-index-search-cmd.ts`) wired into `src/cli.ts` under the existing `code-index` group mirrors `doc-canon search`'s human-first / `--json` split. The library scans the already-parsed index linearly (no secondary in-memory index), reads live files for snippet windows, and caps hits/snippet lines for determinism.

**Tech Stack:** Node ≥20, TypeScript ESM, `commander` (CLI), `micromatch` (file-glob filter), `node:fs`/`node:path`/`node:crypto`. Tests via `node:test` + `tsx`.

**Spec:** [`docs/superpowers/specs/2026-08-18-p2b-code-search-tools-design.md`](../specs/2026-08-18-p2b-code-search-tools-design.md) — the plan argues from the spec; executors read both.

## Global Constraints

- Node ≥20, ESM (`"type": "module"`). Relative imports in `src/` use the `.js` extension (e.g. `../code-index/reader.js`).
- Tests: `npm test` runs `tsx --test tests/**/*.test.ts`. Build: `npm run build` runs `tsc -p tsconfig.json`. CLI tests spawn the compiled binary via `bin/doc-canon.js`, so run `npm run build` before CLI tests.
- **Canon-first:** never edit `docs/canon/**` directly — use the `canon-write` skill (Task 1, Task 9). `future_plans/` changes go through the `canon-future-plan` skill.
- **Determinism:** identical index + identical live corpus + identical query/flags → byte-identical `--json` output. Keep `JSON.stringify` key order stable by constructing objects in a fixed key order.
- Fail-closed code names (verbatim from the spec): `empty_query`, `code_index_missing` (missing/corrupt/schema-mismatch index). Stale warning code: `code_index_stale`.
- Pack-size defaults (verbatim): max-hits 10, snippet-lines 4, total snippet-line cap 120.
- Code style: mirror existing files (`src/search/search.ts`, `src/commands/search.ts`). No comments unless the file's existing convention has a `// src/...` header.
- Do not change `docs/canon/future_plans/**` prose beyond the status/Design-link updates the `canon-future-plan` skill handles.

---

### Task 1: Canon-first — living canon refresh + P2b status

**Files:**
- Modify: `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/GLOSSARY.md` (via `canon-write` skill)
- Modify: `docs/canon/future_plans/INDEX.md`, `docs/canon/future_plans/p2b-code-search-tools.md` (via `canon-future-plan` skill)

**Interfaces:**
- Consumes: the design spec (`docs/superpowers/specs/2026-08-18-p2b-code-search-tools-design.md`) and the P2b initiative (`docs/canon/future_plans/p2b-code-search-tools.md`).
- Produces: living canon describing `code-index search`; initiative status `implementing` with a Design link to the spec. No code yet.

- [ ] **Step 1: Load the canon-write skill and update living canon**

Load the `canon-write` skill, then apply these updates (the skill guides the mechanics; content below is what must land):

- `docs/canon/CLI.md`
  - **Scope → Covers:** extend the code-index sentence to include searching the AST index: `...writing .doc-canon/code-index-manifest.json + .doc-canon/code-ast-index.json, with the same poll --watch/--stop discipline and a separate watch pid; search that code index (`code-index search`) and return a bounded code pack without auto-reindexing.`
  - **Current state:** add `code-index search` to the shipped-commands sentence (`code-index build` / `code-index search` ship with the P2a/P2b initiatives).
  - **Responsibilities:** add a bullet: `Search the code AST index (`code-index search`): symbol substring match (exact > prefix > substring ordering, tie-break file then line), kind/file filters, and a syntactic reference mode (`--refs`); report `code_index_stale` → warn and `code_index_missing` → fail closed with a hint to run `doc-canon code-index build``
  - **Interfaces table:** add a row `code-index search <query>` — Search the code AST index and print a bounded code pack; symbol substring mode with `--kind <type>` / `--file <glob>`; `--refs <name>` for syntactic references (anchor/import/binding); `--json`; `--max-hits <N>` (default 10); `--snippet-lines <N>` (default 4); `--root <path>`.
  - **Post-table note:** add: `code-index search` fails with exit ≠0 for an empty query, a missing/corrupt code index (hint to run `doc-canon code-index build`), invalid flags, and `--refs` combined with a positional query / `--kind` / `--file`. A stale code index is served with exit 0 and a `code_index_stale` warning (human mode on stderr; `--json` carries `warnings` + `freshness`). Zero hits exit 0. `code-index search` never auto-reindexes.

- `docs/canon/ARCHITECTURE.md`
  - **Building blocks:** add a **Code search** bullet after the `Retrieval` bullet: `**Code search** (`searchCodeIndex` from `doc-canon/code-search`) — the code-side analogue of `searchCanon`: opens the code AST index through `openCodeIndex`, scans symbols (case-insensitive substring; exact > prefix > substring ordering) or syntactic references (`--refs`), filters by kind/file, and reads live source files for bounded snippet windows; the thin `code-index search` CLI and P2c rules consume the resulting code pack.`
  - **Key flows:** extend flow 11 (Build code AST index) to mention search: `...`code-index search` (P2b) queries that artifact at search time; agent rules for code-index-first analysis land with P2c.`

- `docs/canon/GLOSSARY.md`
  - Add term **Code search pack** after `code_index_missing`: `A bounded code retrieval result (CodePack) containing the query, mode (`symbols` or `refs`), freshness (`fresh`/`stale`), warnings, and symbol or syntactic-reference hits with short snippet windows from live files.`
  - Add term **Syntactic reference**: `A reference edge already carried by the code AST index — same-file `anchor`, `import`/`export` edge, or in-scope `binding` — matched syntactically by `--refs` with no name resolution.`

- [ ] **Step 2: Load canon-future-plan skill, mark P2b implementing, point Design link**

Load the `canon-future-plan` skill. Set the P2b initiative status to `implementing` and add a Design line linking `docs/superpowers/specs/2026-08-18-p2b-code-search-tools-design.md` (mirroring how P2a does it). Update `docs/canon/future_plans/INDEX.md` row `2b` to `implementing`. Keep it a single status marker — no task list.

- [ ] **Step 3: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): refresh living canon for P2b code search; mark implementing"
```

- [ ] **Step 4: STOP — wait for explicit user go-ahead**

These are substantial canon changes. Pause here and get the user's explicit go-ahead before starting Task 2.

---

### Task 2: Extract shared `isFresh` helper

**Files:**
- Create: `src/agnostic/freshness.ts`
- Modify: `src/search/search.ts`
- Test: `tests/freshness.test.ts`

**Interfaces:**
- Consumes: none (pure function).
- Produces: `isFresh(manifestFiles: Record<string, { hash: string }>, live: Record<string, string>): boolean` in `src/agnostic/freshness.ts`. Behavior must be byte-identical to the current private `isFresh` in `src/search/search.ts` (line 27). Both `searchCanon` (manifest field `docs`) and `searchCodeIndex` (manifest field `files`) call it.

- [ ] **Step 1: Write the failing test**

`tests/freshness.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isFresh } from "../src/agnostic/freshness.js";

describe("isFresh", () => {
  it("is true when paths and hashes match", () => {
    const manifest = { "a.ts": { hash: "h1" }, "b.ts": { hash: "h2" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h2" }), true);
  });

  it("is false when a hash differs", () => {
    const manifest = { "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h2" }), false);
  });

  it("is false when path sets differ", () => {
    const manifest = { "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h3" }), false);
    assert.equal(isFresh(manifest, {}), false);
  });

  it("ignores key insertion order (sorts internally)", () => {
    const manifest = { "b.ts": { hash: "h2" }, "a.ts": { hash: "h1" } };
    assert.equal(isFresh(manifest, { "a.ts": "h1", "b.ts": "h2" }), true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/freshness.test.ts`
Expected: FAIL with `Cannot find module '../src/agnostic/freshness.js'` (or equivalent module-not-found).

- [ ] **Step 3: Create the helper and rewire `src/search/search.ts`**

`src/agnostic/freshness.ts` (move the exact logic from `src/search/search.ts:27-40`, unchanged):

```ts
// src/agnostic/freshness.ts
export function isFresh(
  manifestFiles: Record<string, { hash: string }>,
  live: Record<string, string>,
): boolean {
  const manifestPaths = Object.keys(manifestFiles).sort();
  const livePaths = Object.keys(live).sort();
  if (manifestPaths.length !== livePaths.length) return false;
  for (let i = 0; i < manifestPaths.length; i++) {
    if (manifestPaths[i] !== livePaths[i]) return false;
    const p = manifestPaths[i]!;
    if (manifestFiles[p]!.hash !== live[p]) return false;
  }
  return true;
}
```

In `src/search/search.ts`: delete the local `isFresh` function (lines 27-40), add `import { isFresh } from "../agnostic/freshness.js";`, and keep the call site `isFresh(handle.manifest.docs, live)` unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx tsx --test tests/freshness.test.ts tests/search-canon.test.ts`
Expected: all PASS (search-canon still passes — this is a non-behavioral refactor).

- [ ] **Step 5: Commit**

```bash
git add src/agnostic/freshness.ts src/search/search.ts tests/freshness.test.ts
git commit -m "refactor: extract shared isFresh freshness helper"
```

---

### Task 3: `src/code-search/types.ts` — pack shape + error

**Files:**
- Create: `src/code-search/types.ts`
- Test: `tests/code-search-types.test.ts`

**Interfaces:**
- Consumes: `ReferenceKind` and `SymbolKind` from `../code-index/types.js`.
- Produces (later tasks rely on these exact names):
  - `type CodeSearchSnippet = { start_line: number; text: string }`
  - `type CodeSearchHit = { file, line, endLine, kind, name, signature, snippets: CodeSearchSnippet[] }` (`kind: string`, pass-through verbatim)
  - `type CodeRefHit = { file, line, refKind: ReferenceKind, name, from, to, snippets: CodeSearchSnippet[] }` (`file` = `ref.from`)
  - `type CodePack = { query: string; mode: "symbols" | "refs"; freshness: "fresh" | "stale"; warnings: string[]; hits: CodeSearchHit[] | CodeRefHit[] }`
  - `type CodeSearchOptions = { maxHits?: number; snippetLines?: number; refs?: string; kind?: SymbolKind; file?: string }`
  - `class CodeSearchError extends Error` with `readonly code: "empty_query" | "code_index_missing"` (mirror `SearchError` in `src/search/types.ts`).

- [ ] **Step 1: Write the failing test**

`tests/code-search-types.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CodeSearchError } from "../src/code-search/types.js";

describe("CodeSearchError", () => {
  it("is an Error carrying a code", () => {
    const e = new CodeSearchError("empty_query", "query must be non-empty");
    assert.ok(e instanceof Error);
    assert.equal(e.name, "CodeSearchError");
    assert.equal(e.code, "empty_query");
    assert.equal(e.message, "query must be non-empty");
  });

  it("accepts the fail-closed code", () => {
    const e = new CodeSearchError(
      "code_index_missing",
      "code index missing (detail); run: doc-canon code-index build",
    );
    assert.equal(e.code, "code_index_missing");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-search-types.test.ts`
Expected: FAIL with module-not-found for `../src/code-search/types.js`.

- [ ] **Step 3: Create `src/code-search/types.ts`**

```ts
// src/code-search/types.ts
import type { ReferenceKind, SymbolKind } from "../code-index/types.js";

export type CodeSearchSnippet = { start_line: number; text: string };

export type CodeSearchHit = {
  file: string;
  line: number;
  endLine: number;
  kind: string;
  name: string;
  signature: string;
  snippets: CodeSearchSnippet[];
};

export type CodeRefHit = {
  file: string; // = ref.from (referencing file, posix relative)
  line: number;
  refKind: ReferenceKind;
  name: string;
  from: string;
  to: string;
  snippets: CodeSearchSnippet[];
};

export type CodePack = {
  query: string;
  mode: "symbols" | "refs";
  freshness: "fresh" | "stale";
  warnings: string[];
  hits: CodeSearchHit[] | CodeRefHit[];
};

export type CodeSearchOptions = {
  maxHits?: number;
  snippetLines?: number;
  refs?: string;
  kind?: SymbolKind;
  file?: string;
};

export class CodeSearchError extends Error {
  readonly code: "empty_query" | "code_index_missing";
  constructor(code: CodeSearchError["code"], message: string) {
    super(message);
    this.name = "CodeSearchError";
    this.code = code;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-search-types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code-search/types.ts tests/code-search-types.test.ts
git commit -m "feat: code-search pack types and CodeSearchError"
```

---

### Task 4: `src/code-search/snippets.ts` — snippet window helpers

**Files:**
- Create: `src/code-search/snippets.ts`
- Test: `tests/code-search-snippets.test.ts`

**Interfaces:**
- Consumes: `CodeSearchSnippet` from `./types.js`.
- Produces:
  - `declarationWindow(content: string, line: number, endLine: number, snippetLines: number): CodeSearchSnippet | null` — lines `[line..endLine]` capped at `snippetLines`, clamped to file bounds.
  - `centeredWindow(content: string, line: number, snippetLines: number): CodeSearchSnippet | null` — `snippetLines` lines centered on `line`, clamped to file bounds (reuse the clamp arithmetic of `extractSnippetWindows` in `src/search/snippets.ts`).

- [ ] **Step 1: Write the failing test**

`tests/code-search-snippets.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { declarationWindow, centeredWindow } from "../src/code-search/snippets.js";

describe("declarationWindow", () => {
  const content = ["a", "b", "c", "d", "e"].join("\n");

  it("returns declaration lines capped at snippetLines", () => {
    assert.deepEqual(declarationWindow(content, 2, 5, 3), {
      start_line: 2,
      text: ["b", "c", "d"].join("\n"),
    });
  });

  it("returns null when line is past the file end", () => {
    assert.equal(declarationWindow(content, 9, 12, 4), null);
  });

  it("clamps to the file end", () => {
    assert.deepEqual(declarationWindow(content, 4, 99, 4), {
      start_line: 4,
      text: ["d", "e"].join("\n"),
    });
  });
});

describe("centeredWindow", () => {
  const content = ["a", "b", "c", "d", "e"].join("\n");

  it("centers the window on the line", () => {
    assert.deepEqual(centeredWindow(content, 3, 3), {
      start_line: 2,
      text: ["b", "c", "d"].join("\n"),
    });
  });

  it("clamps to the top of the file", () => {
    assert.deepEqual(centeredWindow(content, 1, 3), {
      start_line: 1,
      text: ["a", "b", "c"].join("\n"),
    });
  });

  it("clamps to the bottom of the file", () => {
    assert.deepEqual(centeredWindow(content, 5, 3), {
      start_line: 3,
      text: ["c", "d", "e"].join("\n"),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-search-snippets.test.ts`
Expected: FAIL with module-not-found for `../src/code-search/snippets.js`.

- [ ] **Step 3: Create `src/code-search/snippets.ts`**

```ts
// src/code-search/snippets.ts
import type { CodeSearchSnippet } from "./types.js";

export function declarationWindow(
  content: string,
  line: number,
  endLine: number,
  snippetLines: number,
): CodeSearchSnippet | null {
  const lines = content.split("\n");
  const start = Math.max(1, line);
  if (start > lines.length) return null;
  const end = Math.min(Math.max(endLine, start), start + snippetLines - 1, lines.length);
  if (end < start) return null;
  return { start_line: start, text: lines.slice(start - 1, end).join("\n") };
}

export function centeredWindow(
  content: string,
  line: number,
  snippetLines: number,
): CodeSearchSnippet | null {
  const lines = content.split("\n");
  const halfBefore = Math.floor((snippetLines - 1) / 2);
  let start = line - halfBefore;
  let end = start + snippetLines - 1;
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > lines.length) {
    start -= end - lines.length;
    end = lines.length;
    if (start < 1) start = 1;
  }
  if (start < 1 || lines.length === 0) return null;
  return { start_line: start, text: lines.slice(start - 1, end).join("\n") };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-search-snippets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code-search/snippets.ts tests/code-search-snippets.test.ts
git commit -m "feat: code-search snippet window helpers"
```

---

### Task 5: `src/code-search/search.ts` — symbol mode

**Files:**
- Create: `src/code-search/search.ts`
- Test: `tests/code-search.test.ts`

**Interfaces:**
- Consumes: `openCodeIndex` from `../code-index/reader.js`; `isFresh` from `../agnostic/freshness.js`; `declarationWindow` from `./snippets.js`; types from `./types.js`; `micromatch` (default import).
- Produces:
  - `searchCodeIndex(root: string, query: string, options?: CodeSearchOptions): CodePack`
  - Re-exports `CodeSearchError` and all types from `./types.js` (mirror `src/search/search.ts`'s re-export block).
  - Symbol-mode semantics: effective query = trimmed positional query; empty → `CodeSearchError("empty_query", "query must be non-empty")`. `openCodeIndex` failure → `CodeSearchError("code_index_missing", \`code index missing (${detail}); run: doc-canon code-index build\`)`. Freshness via `isFresh(handle.manifest.files, handle.liveHashes())`; stale → `freshness: "stale"`, `warnings: ["code_index_stale"]`. Case-insensitive substring match on `name`; match class exact (0) > prefix (1) > substring (2); within a class order by `file`, then `line`; slice to `maxHits`; `--kind` exact filter; `--file` via `micromatch.isMatch(s.file, glob)`; snippets = `declarationWindow` from live file reads; total snippet-line cap 120 across hits.

- [ ] **Step 1: Write the failing test**

`tests/code-search.test.ts` (fixture helpers mirror `tests/code-index-reader.test.ts`):

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: FAIL with module-not-found for `../src/code-search/search.js`.

- [ ] **Step 3: Create `src/code-search/search.ts`**

```ts
// src/code-search/search.ts
import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import { openCodeIndex } from "../code-index/reader.js";
import { isFresh } from "../agnostic/freshness.js";
import { declarationWindow } from "./snippets.js";
import {
  CodeSearchError,
  type CodePack,
  type CodeSearchHit,
  type CodeSearchOptions,
} from "./types.js";

export {
  CodeSearchError,
  type CodePack,
  type CodeRefHit,
  type CodeSearchHit,
  type CodeSearchOptions,
  type CodeSearchSnippet,
} from "./types.js";

const DEFAULTS = {
  maxHits: 10,
  snippetLines: 4,
  maxSnippetLinesTotal: 120,
} as const;

type MatchClass = 0 | 1 | 2;

function matchClass(name: string, query: string): MatchClass | null {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (n.includes(q)) return 2;
  return null;
}

export function searchCodeIndex(
  root: string,
  query: string,
  options: CodeSearchOptions = {},
): CodePack {
  const effective = query.trim();
  if (!effective) {
    throw new CodeSearchError("empty_query", "query must be non-empty");
  }

  let handle;
  try {
    handle = openCodeIndex(root);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CodeSearchError(
      "code_index_missing",
      `code index missing (${detail}); run: doc-canon code-index build`,
    );
  }

  const maxHits = options.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options.snippetLines ?? DEFAULTS.snippetLines;

  const live = handle.liveHashes();
  const fresh = isFresh(handle.manifest.files, live);
  const freshness = fresh ? "fresh" : "stale";
  const warnings = fresh ? [] : ["code_index_stale"];

  const symbols = handle
    .symbols()
    .filter((s) => matchClass(s.name, effective) !== null)
    .filter((s) => options.kind === undefined || s.kind === options.kind)
    .filter((s) => options.file === undefined || micromatch.isMatch(s.file, options.file))
    .sort((a, b) => {
      const ca = matchClass(a.name, effective)!;
      const cb = matchClass(b.name, effective)!;
      if (ca !== cb) return ca - cb;
      if (a.file < b.file) return -1;
      if (a.file > b.file) return 1;
      return a.line - b.line;
    })
    .slice(0, maxHits);

  const hits: CodeSearchHit[] = [];
  let usedLines = 0;
  for (const sym of symbols) {
    const abs = path.join(root, ...sym.file.split("/"));
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      hits.push({
        file: sym.file,
        line: sym.line,
        endLine: sym.endLine,
        kind: sym.kind,
        name: sym.name,
        signature: sym.signature,
        snippets: [],
      });
      continue;
    }
    const window = declarationWindow(content, sym.line, sym.endLine, snippetLines);
    const n = window === null ? 0 : window.text.split("\n").length;
    hits.push({
      file: sym.file,
      line: sym.line,
      endLine: sym.endLine,
      kind: sym.kind,
      name: sym.name,
      signature: sym.signature,
      snippets: window !== null && usedLines + n <= DEFAULTS.maxSnippetLinesTotal ? [window] : [],
    });
    if (window !== null) usedLines += n;
  }

  return { query: effective, mode: "symbols", freshness, warnings, hits };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: PASS (all symbol-mode cases; refs-mode tests come in Task 6).

- [ ] **Step 5: Commit**

```bash
git add src/code-search/search.ts tests/code-search.test.ts
git commit -m "feat: searchCodeIndex symbol mode"
```

---

### Task 6: `searchCodeIndex` refs mode

**Files:**
- Modify: `src/code-search/search.ts`
- Modify: `tests/code-search.test.ts`

**Interfaces:**
- Consumes: `CodeRefHit` type from `./types.js`; `centeredWindow` from `./snippets.js`; `handle.references()` from `openCodeIndex`.
- Produces: refs mode selected when `options.refs !== undefined`. Effective query = trimmed `options.refs` (empty → `empty_query`); the positional `query` is ignored/empty in refs mode. Exact, case-sensitive match on `ref.name`; hits `{ file: ref.from, line, refKind: ref.kind, name, from, to, snippets }` ordered by `file` then `line` (stable sort preserves artifact order on ties); slice to `maxHits`; snippets = `centeredWindow` from live reads of `ref.from`; same 120 total-line cap.

- [ ] **Step 1: Write the failing tests (append to `tests/code-search.test.ts`)**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: FAIL on the refs-mode tests (refs-mode branch not implemented — hits empty or mode mismatch).

- [ ] **Step 3: Add the refs-mode branch to `src/code-search/search.ts`**

Update the imports (add `centeredWindow`, `CodeRefHit`). Make the effective-query computation refs-mode-aware at the top of `searchCodeIndex` (spec data-flow order: effective query first, then `openCodeIndex`), replacing Task 5's symbol-only effective query:

```ts
  const refsMode = options.refs !== undefined;
  const effective = (refsMode ? options.refs! : query).trim();
  if (!effective) {
    throw new CodeSearchError("empty_query", "query must be non-empty");
  }
```

Then, right after the freshness computation, insert the refs branch:

```ts
  if (refsMode) {
    const refs = handle
      .references()
      .filter((r) => r.name === effective)
      .sort((a, b) => {
        if (a.from < b.from) return -1;
        if (a.from > b.from) return 1;
        return a.line - b.line;
      })
      .slice(0, maxHits);

    const hits: CodeRefHit[] = [];
    let usedLines = 0;
    for (const ref of refs) {
      const abs = path.join(root, ...ref.from.split("/"));
      let content: string;
      try {
        content = fs.readFileSync(abs, "utf8");
      } catch {
        hits.push({
          file: ref.from,
          line: ref.line,
          refKind: ref.kind,
          name: ref.name,
          from: ref.from,
          to: ref.to,
          snippets: [],
        });
        continue;
      }
      const window = centeredWindow(content, ref.line, snippetLines);
      const n = window === null ? 0 : window.text.split("\n").length;
      hits.push({
        file: ref.from,
        line: ref.line,
        refKind: ref.kind,
        name: ref.name,
        from: ref.from,
        to: ref.to,
        snippets: window !== null && usedLines + n <= DEFAULTS.maxSnippetLinesTotal ? [window] : [],
      });
      if (window !== null) usedLines += n;
    }

    return { query: effective, mode: "refs", freshness, warnings, hits };
  }
```

The rest of the symbol path stays as in Task 5 (it now uses the `refsMode`-aware `effective`). Final `searchCodeIndex` shape:

```ts
export function searchCodeIndex(
  root: string,
  query: string,
  options: CodeSearchOptions = {},
): CodePack {
  const refsMode = options.refs !== undefined;
  const effective = (refsMode ? options.refs! : query).trim();
  if (!effective) {
    throw new CodeSearchError("empty_query", "query must be non-empty");
  }

  let handle;
  try {
    handle = openCodeIndex(root);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CodeSearchError(
      "code_index_missing",
      `code index missing (${detail}); run: doc-canon code-index build`,
    );
  }

  const maxHits = options.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options.snippetLines ?? DEFAULTS.snippetLines;

  const live = handle.liveHashes();
  const fresh = isFresh(handle.manifest.files, live);
  const freshness = fresh ? "fresh" : "stale";
  const warnings = fresh ? [] : ["code_index_stale"];

  if (refsMode) {
    // ... refs branch as above ...
  }

  // ... symbol scan unchanged from Task 5, using `effective`, `maxHits`, `snippetLines` ...
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: PASS (all symbol + refs cases).

- [ ] **Step 5: Commit**

```bash
git add src/code-search/search.ts tests/code-search.test.ts
git commit -m "feat: searchCodeIndex refs mode"
```

---

### Task 7: Public export `doc-canon/code-search`

**Files:**
- Modify: `package.json`
- Test: `tests/code-search-export.test.ts`

**Interfaces:**
- Consumes: `src/code-search/search.ts` (build output `dist/code-search/search.js`).
- Produces: `package.json` `exports` entry `"./code-search": "./dist/code-search/search.js"`, mirroring `"./search": "./dist/search/search.js"`.

- [ ] **Step 1: Write the failing test**

`tests/code-search-export.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("doc-canon/code-search export", () => {
  it("is declared in package.json exports", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    assert.equal(pkg.exports["./code-search"], "./dist/code-search/search.js");
  });

  it("builds to a dist entry", async () => {
    const { stat } = await import("node:fs/promises");
    const entry = await stat(join(root, "dist", "code-search", "search.js"));
    assert.ok(entry.isFile());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-search-export.test.ts`
Expected: FAIL (`package.json` lacks the export, and/or `dist/code-search/search.js` does not exist yet).

- [ ] **Step 3: Add the export and build**

In `package.json`, add the export entry (keep object key order around the existing entries):

```json
  "exports": {
    "./index-reader": "./dist/index/reader.js",
    "./search": "./dist/search/search.js",
    "./code-index-reader": "./dist/code-index/reader.js",
    "./code-search": "./dist/code-search/search.js"
  },
```

Run: `npm run build`
Expected: `tsc` succeeds and emits `dist/code-search/search.js` (and `dist/code-search/types.js`, `dist/code-search/snippets.js`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-search-export.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json tests/code-search-export.test.ts
git commit -m "feat: publish doc-canon/code-search export"
```

---

### Task 8: CLI `code-index search` command + wiring

**Files:**
- Create: `src/commands/code-index-search-cmd.ts`
- Modify: `src/cli.ts`
- Test: `tests/code-search-cli.test.ts`

**Interfaces:**
- Consumes: `resolveRoot` from `../paths.js`; `searchCodeIndex`, `CodeSearchError` from `../code-search/search.js`; `CodeSearchHit`/`CodeRefHit` types from `../code-search/search.js`; `SymbolKind` from `../code-index/types.js`.
- Produces: `codeIndexSearch(rootFlag: string, query: string | undefined, opts: CodeIndexSearchOptions): Promise<number>` (exit code); commander subcommand `code-index search [query]` with flags `--root` (default `.`), `--json`, `--max-hits <n>` (default `10`), `--snippet-lines <n>` (default `4`), `--kind <type>`, `--file <glob>`, `--refs <name>`.

Flag rules (verbatim from spec):
- `--refs` + positional query → fail closed, exit ≠0
- `--refs` + `--kind` or `--file` → fail closed, exit ≠0
- `--refs` with empty/whitespace name → fail closed, exit ≠0
- unknown `--kind` value → fail closed before start, exit ≠0
- `--max-hits` / `--snippet-lines` < 1 or non-numeric → fail closed, exit ≠0
- empty positional query (symbol mode) → fail closed, exit ≠0
- no code index → fail closed, exit ≠0, hint `run: doc-canon code-index build`
- stale index → warn `code_index_stale` on stderr (human mode only); exit 0
- zero hits → exit 0, `no hits` (human mode)
- `--file` glob matching nothing → empty hits, exit 0

Human output:
- Symbol mode: `` `${file}  L${line}  ${kind}  ${name}` `` then each snippet line indented 4 spaces (`    ${line}`)
- Refs mode: `` `${file}  L${line}  ${refKind}  ${name}  → ${to}` `` then snippet lines indented 4 spaces
- `--json`: `console.log(JSON.stringify(pack))` (full `CodePack`)

- [ ] **Step 1: Write the failing test**

`tests/code-search-cli.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
    fs.writeFileSync(path.join(repo, "src/reader.ts"), "export class Reader { changed() {} }\n");
    const r = run(["code-index", "search", "Reader", "--root", repo]);
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /code_index_stale/);
  });

  it("rejects an empty query", () => {
    const r = run(["code-index", "search", "   ", "--root", repo]);
    assert.notEqual(r.status, 0);
  });

  it("rejects invalid flag values", () => {
    for (const args of [
      ["--max-hits", "0"],
      ["--max-hits", "abc"],
      ["--snippet-lines", "0"],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx tsx --test tests/code-search-cli.test.ts`
Expected: FAIL (command not wired; `code-index --help` lacks `search`, invocations error out).

- [ ] **Step 3: Create `src/commands/code-index-search-cmd.ts`**

```ts
// src/commands/code-index-search-cmd.ts
import { resolveRoot } from "../paths.js";
import {
  CodeSearchError,
  searchCodeIndex,
  type CodeRefHit,
  type CodeSearchHit,
} from "../code-search/search.js";
import type { SymbolKind } from "../code-index/types.js";

const SYMBOL_KINDS: readonly SymbolKind[] = [
  "class",
  "interface",
  "enum",
  "struct",
  "trait",
  "function",
  "method",
  "property",
  "module",
  "const",
  "type",
];

export type CodeIndexSearchOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
  kind?: string;
  file?: string;
  refs?: string;
};

function printHitLines(header: string, snippets: { text: string }[]): void {
  console.log(header);
  for (const snip of snippets) {
    for (const line of snip.text.split("\n")) {
      console.log(`    ${line}`);
    }
  }
}

export async function codeIndexSearch(
  rootFlag: string,
  query: string | undefined,
  opts: CodeIndexSearchOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (opts.refs !== undefined) {
    if (query !== undefined) {
      console.error("error: --refs cannot be combined with a positional query");
      return 1;
    }
    if (opts.refs.trim() === "") {
      console.error("error: --refs requires a non-empty name");
      return 1;
    }
    if (opts.kind !== undefined || opts.file !== undefined) {
      console.error("error: --refs cannot be combined with --kind or --file");
      return 1;
    }
  } else if (query === undefined || query.trim() === "") {
    console.error("error: query required");
    return 1;
  }
  if (opts.kind !== undefined && !SYMBOL_KINDS.includes(opts.kind as SymbolKind)) {
    console.error(`error: unknown --kind ${opts.kind}`);
    return 1;
  }

  const maxHits = Number(opts.maxHits ?? "10");
  const snippetLines = Number(opts.snippetLines ?? "4");
  if (!Number.isFinite(maxHits) || maxHits < 1) {
    console.error("error: --max-hits must be a positive number");
    return 1;
  }
  if (!Number.isFinite(snippetLines) || snippetLines < 1) {
    console.error("error: --snippet-lines must be a positive number");
    return 1;
  }

  try {
    const pack = searchCodeIndex(root, query ?? "", {
      maxHits,
      snippetLines,
      refs: opts.refs,
      kind: opts.kind as SymbolKind | undefined,
      file: opts.file,
    });

    if (opts.json) {
      console.log(JSON.stringify(pack));
      return 0;
    }

    if (pack.freshness === "stale") {
      console.error("warning: code_index_stale (run doc-canon code-index build to refresh)");
    }
    if (pack.hits.length === 0) {
      console.log("no hits");
      return 0;
    }
    if (pack.mode === "refs") {
      for (const hit of pack.hits as CodeRefHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.refKind}  ${hit.name}  → ${hit.to}`, hit.snippets);
      }
    } else {
      for (const hit of pack.hits as CodeSearchHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.kind}  ${hit.name}`, hit.snippets);
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof CodeSearchError) {
      console.error(`error: ${error.message}`);
      return 1;
    }
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
```

- [ ] **Step 4: Wire the subcommand into `src/cli.ts`**

Add the `search` subcommand right after `codeIndexBuild`'s `codeIndex.command("build")` block (after line 145). Match the existing inline-action-opts style (`search.ts` / `index-cmd.ts` type opts inline, including the injected `root`):

```ts
codeIndex
  .command("search")
  .description("Search the code AST index and emit a bounded code pack")
  .argument("[query]", "symbol name query (omit with --refs)")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit CodePack JSON on stdout")
  .option("--max-hits <n>", "max hits", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .option("--kind <type>", "filter symbols by SymbolKind")
  .option("--file <glob>", "filter by file glob (micromatch)")
  .option("--refs <name>", "reference mode: syntactic references to name")
  .action(
    async (
      query: string | undefined,
      opts: {
        root: string;
        json?: boolean;
        maxHits?: string;
        snippetLines?: string;
        kind?: string;
        file?: string;
        refs?: string;
      },
    ) => {
      const { codeIndexSearch } = await import("./commands/code-index-search-cmd.js");
      process.exitCode = await codeIndexSearch(opts.root, query, opts);
    },
  );
```

No new import is needed in `src/cli.ts` (the action opts are typed inline, matching the existing commands).

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run build && npx tsx --test tests/code-search-cli.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: all tests PASS (existing suites unaffected; the `cli-commands.test.ts` help test still lists `code-index`).

- [ ] **Step 7: Commit**

```bash
git add src/commands/code-index-search-cmd.ts src/cli.ts tests/code-search-cli.test.ts
git commit -m "feat: code-index search CLI command"
```

---

### Task 9: Absorb into living canon + close with canon-audit

**Files:**
- Modify: `docs/canon/**` (via `canon-write` skill)
- Modify: `docs/canon/future_plans/p2b-code-search-tools.md`, `docs/canon/future_plans/INDEX.md` (via `canon-future-plan` skill)

**Interfaces:**
- Consumes: shipped code from Tasks 2-8.
- Produces: P2b marked `absorbed`; living canon reflecting the shipped surface; `canon-audit` closure.

- [ ] **Step 1: Absorb into living canon**

Load the `canon-write` skill. Reconcile `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/GLOSSARY.md` with what actually shipped. Fix any drift the implementation introduced (e.g. the exact human-output line format, flag names, defaults). No `future_plans/` edits here.

- [ ] **Step 2: Mark P2b absorbed**

Load the `canon-future-plan` skill. Set the P2b initiative status to `absorbed` and update the `future_plans/INDEX.md` row `2b` to `absorbed` (P2c unblocks).

- [ ] **Step 3: Close with canon-audit**

Load the `canon-audit` skill. Run the audit to confirm living canon ↔ code agreement for the P2b surface, resolving or recording any `DISCREPANCIES.md` entries per the skill's flow.

- [ ] **Step 4: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): absorb P2b code search; mark absorbed"
```

---

## Self-Review

**1. Spec coverage** (checked against every spec section):
- Command surface `doc-canon code-index search <query>` + all flags → Task 8
- Library `searchCodeIndex` + `doc-canon/code-search` export → Tasks 5, 6, 7
- Query model: substring, exact > prefix > substring, file/line tie-break → Task 5
- Filters `--kind`, `--file` (micromatch) → Task 5
- Reference mode `--refs` (exact case-sensitive, file/line order, `file := ref.from`) → Task 6
- Pack shape + symbol/ref hit shapes → Task 3
- Snippets: declaration window (symbol), centered window (refs), 120 total cap → Tasks 4, 5, 6
- Freshness: `isFresh` reuse, `code_index_stale` warn / `code_index_missing` fail closed → Tasks 2, 5, 6, 8
- Human output format (both modes) + `--json` → Task 8
- Error table: empty query, invalid flags, refs conflicts, live-file-read failure, unknown kind passthrough → Tasks 5, 6, 8
- Testing: unit, integration (temp fixtures + built index), CLI, determinism → Tasks 2, 3, 4, 5, 6, 7, 8
- Performance: single `JSON.parse` + linear scan, no secondary index → Task 5 implementation
- Implementation order: canon-first → go-ahead → library → CLI → absorb/audit → Tasks 1-9
- Open question (deferred): `--kind` single value in v1 → Task 8 validation accepts a single value

**2. Placeholder scan:** no TBD/TODO; every step carries real code or exact run commands; no "similar to Task N" — fixtures are repeated inline.

**3. Type consistency:** `CodePack.mode` `"symbols" | "refs"` matches Task 3/5/6 returns; `CodeRefHit.file = ref.from` consistent across types.ts (Task 3), search.ts (Task 6), CLI output (Task 8); `code_index_missing` used in search.ts (Tasks 5/6) and CLI hint (Task 8); `isFresh(manifest.files, live)` matches the `{ hash: string }` record type from Task 2; `searchCodeIndex(root, query, opts)` signature consistent across Tasks 5, 6, 8.
