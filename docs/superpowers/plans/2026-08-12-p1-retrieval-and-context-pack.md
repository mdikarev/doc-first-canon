# P1 Retrieval Search & Context Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship public `searchCanon` (`doc-canon/search`) and thin CLI `doc-canon search` that return a bounded hybrid context pack from the P0b BM25 index, plus skill protocol (try-then-fallback Scout, stale warn+serve, post-write one-shot `index`).

**Architecture:** `searchCanon` opens the index via `openCanonIndex`, compares `manifest.docs` hashes to `liveHashes()`, scores with BM25, then builds snippet windows from **live** markdown on disk (not a second index). Missing/corrupt index and empty query fail closed; hash mismatch yields `freshness: "stale"` + `warnings: ["index_stale"]` and still returns hits. CLI is a thin wrapper (human stdout / `--json`). Skills always try search first; on fail-closed fall back to INDEX Scout + index hint; after successful substantive canon writes they **run** one-shot `doc-canon index`.

**Tech Stack:** TypeScript (Node ≥20, ESM), existing `openCanonIndex` / `tokenize` / `syncCanonIndex`, `commander`, `node:test` via `tsx`. No new runtime dependencies. No embeddings.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-12-p1-retrieval-and-context-pack-design.md` (supersedes obsolete plan `docs/superpowers/plans/2026-08-11-retrieval-search-pack.md` — do not execute that plan).
- Prerequisite: P0b absorbed (`doc-canon index`, dual artifacts, `doc-canon/index-reader`).
- **Canon-first:** Task 1 (`canon-future-plan`) then Task 2 (`canon-write`); **STOP for explicit user go-ahead** before Task 3+ app/CLI/skill-asset code.
- Coding agents must not edit `docs/canon/**` themselves.
- Stale: warn + serve. Missing/corrupt: fail closed + hint `doc-canon index`. Zero hits: success with `hits: []`.
- No auto-reindex inside `search`. No embeddings. No `doc-canon context` alias. No pack artifacts under `.doc-canon/`.
- Defaults: `maxHits=10`, `snippetLines=4`, `maxWindowsPerHit=2`, `maxSnippetLinesTotal=120` (**hard** truncate of later windows/hits — not a soft advisory).
- CLI exposes `--json`, `--max-hits`, `--snippet-lines`, `--root` only; other knobs are API-only defaults.
- Pack JSON: snake_case fields as in the design spec.
- TDD; `npm test` + `npm run build` before claiming done.
- When managed skills change: bump `SKILLS_STAMP` to `"0.8.0"`; sync living `docs/canon/CANON_CONTRACT.md`; leave `MIN_SKILLS_STAMP` at `"0.1.0"`.

---

## File Structure

```text
# Future plans (canon-future-plan — Task 1)
docs/canon/future_plans/p1-retrieval-and-context-pack.md
docs/canon/future_plans/INDEX.md                 # only if Design/status note needs it

# Living canon (canon-write — Task 2; absorb Task 8)
docs/canon/CLI.md
docs/canon/ARCHITECTURE.md
docs/canon/SKILLS.md
docs/canon/GLOSSARY.md
docs/canon/OVERVIEW.md

# Implementation
src/search/types.ts                              # PackResult, options, SearchError
src/search/snippets.ts                           # live-file snippet windows
src/search/search.ts                             # searchCanon
src/commands/search.ts                           # CLI wrapper
src/cli.ts                                       # register search
package.json                                     # exports["./search"]

# Skills / acceptance
embedded/skills/canon-write/SKILL.md
embedded/skills/canon-audit/SKILL.md
embedded/skills/canon-future-plan/SKILL.md       # Scout search protocol if it shares Scout section
.cursor/skills/...                               # mirrors of embedded (same edit)
docs/acceptance/skill-scenarios.md
tests/embedded-assets.test.ts
src/version.ts                                   # SKILLS_STAMP → 0.8.0
docs/canon/CANON_CONTRACT.md                     # skills_stamp → 0.8.0

# Tests
tests/search-snippets.test.ts
tests/search-canon.test.ts
tests/search-cli.test.ts
tests/cli-commands.test.ts                       # add search to help lists
```

---

### Task 1: Align P1 initiative via `canon-future-plan`

**Files:**
- Modify (via skill only): `docs/canon/future_plans/p1-retrieval-and-context-pack.md` (INDEX only if Design link / status note needs it)
- Do not edit living root SoT in this task

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-12-p1-retrieval-and-context-pack-design.md`
- Produces: initiative Design link + open questions / status wording matching the approved P1 design

- [ ] **Step 1: Invoke `canon-future-plan`**

Content to land in the initiative:

1. **Design** link → `docs/superpowers/specs/2026-08-12-p1-retrieval-and-context-pack-design.md` (replace the split-only link).
2. Status may stay `refining` or move to `implementing` per skill norms once Design is locked — do not mark `absorbed`.
3. Clear leftover open questions that the design already resolved (pack field names, defaults, Scout try-then-fallback strength).
4. Keep In/Out of scope aligned with the design (public API `searchCanon`, post-write **runs** `index`, no auto-reindex in search).

- [ ] **Step 2: Commit** (skill/session commit after validate)

```bash
git add docs/canon/future_plans/p1-retrieval-and-context-pack.md docs/canon/future_plans/INDEX.md
git commit -m "$(cat <<'EOF'
docs: point P1 initiative at retrieval pack design

EOF
)"
```

---

### Task 2: Living canon for search + Scout protocol via `canon-write` (gate)

**Files:**
- Modify (via skill only): `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/SKILLS.md`, `docs/canon/GLOSSARY.md`, `docs/canon/OVERVIEW.md`

**Interfaces:**
- Consumes: approved P1 design
- Produces: living SoT describing `search` before app code

- [ ] **Step 1: Invoke `canon-write`**

Required content:

1. **`CLI.md`** — command `search <query>`: `--json`, `--max-hits` (default 10), `--snippet-lines` (default 4), `--root`; human stdout; missing/corrupt → exit ≠0 + hint; stale → stderr warn, exit 0; empty query → ≠0; zero hits → exit 0; no auto-reindex.
2. **`ARCHITECTURE.md`** — retrieval path: `openCanonIndex` → `searchCanon` (`doc-canon/search`) → CLI/skills; snippets from live files; P1 does not own index build.
3. **`SKILLS.md`** — Scout always tries `doc-canon search` first; fail-closed → INDEX-first Scout + explicit index hint (do not hard-stop); `index_stale` → surface + continue + Expand if thin; after successful **substantive** writes to `docs/canon/**`, skill **runs** one-shot `doc-canon index` (if watch lock fails, surface and rely on watch / suggest `--stop`); quality over thrift unchanged.
4. **`GLOSSARY.md`** — pack, `searchCanon` / search, `index_stale`.
5. **`OVERVIEW.md`** — In scope includes `search` / context pack.

Validate under the skill.

- [ ] **Step 2: Commit**

```bash
git add docs/canon/CLI.md docs/canon/ARCHITECTURE.md docs/canon/SKILLS.md docs/canon/GLOSSARY.md docs/canon/OVERVIEW.md
git commit -m "$(cat <<'EOF'
docs: describe search, pack, and Scout retrieval protocol

Canon-first SoT for P1 ahead of searchCanon / CLI implementation.
EOF
)"
```

- [ ] **Step 3: STOP — wait for explicit user go-ahead before Task 3**

---

### Task 3: Snippet windows from live markdown

**Files:**
- Create: `src/search/snippets.ts`
- Test: `tests/search-snippets.test.ts`

**Interfaces:**
- Consumes: `tokenize` from `src/index/tokenize.ts`
- Produces:
  - `export type SnippetWindow = { start_line: number; text: string }`
  - `export function extractSnippetWindows(content: string, query: string, opts: { snippetLines: number; maxWindows: number }): SnippetWindow[]`
    - Split `content` on `\n` (do not require trailing newline).
    - Tokenize `query` with `tokenize`; if no terms, return `[]`.
    - A line matches if any query term appears in `tokenize(line)`.
    - Walk match lines in ascending order; for each, if not already covered by an accepted window, create a window of height `snippetLines` centered on that line (1-based `start_line`), clamped to `[1, lineCount]`.
    - `text` is the joined window lines with `\n` (no trailing `\n` unless present in source mid-window).
    - Return at most `maxWindows` windows.
    - Windows must not overlap; skip a match if its centered window would overlap an earlier accepted window (or shrink is not required — skip).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/search-snippets.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractSnippetWindows } from "../src/search/snippets.js";

describe("extractSnippetWindows", () => {
  it("returns empty when query has no tokens", () => {
    assert.deepEqual(
      extractSnippetWindows("alpha beta", "   ", { snippetLines: 3, maxWindows: 2 }),
      [],
    );
  });

  it("centers a window on the matching line", () => {
    const content = ["a", "b", "match here", "d", "e"].join("\n");
    const windows = extractSnippetWindows(content, "match", {
      snippetLines: 3,
      maxWindows: 2,
    });
    assert.equal(windows.length, 1);
    assert.equal(windows[0]!.start_line, 2);
    assert.equal(windows[0]!.text, ["b", "match here", "d"].join("\n"));
  });

  it("returns up to maxWindows non-overlapping matches", () => {
    const content = ["x", "foo", "y", "z", "foo", "w"].join("\n");
    const windows = extractSnippetWindows(content, "foo", {
      snippetLines: 1,
      maxWindows: 2,
    });
    assert.equal(windows.length, 2);
    assert.equal(windows[0]!.start_line, 2);
    assert.equal(windows[1]!.start_line, 5);
  });

  it("clamps to file bounds", () => {
    const content = "only";
    const windows = extractSnippetWindows(content, "only", {
      snippetLines: 5,
      maxWindows: 1,
    });
    assert.equal(windows[0]!.start_line, 1);
    assert.equal(windows[0]!.text, "only");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/search-snippets.test.ts`  
Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/search/snippets.ts
import { tokenize } from "../index/tokenize.js";

export type SnippetWindow = { start_line: number; text: string };

export function extractSnippetWindows(
  content: string,
  query: string,
  opts: { snippetLines: number; maxWindows: number },
): SnippetWindow[] {
  const lines = content.split("\n");
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0 || opts.maxWindows <= 0 || opts.snippetLines <= 0) {
    return [];
  }

  const matchLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = new Set(tokenize(lines[i]!));
    if (terms.some((t) => lineTokens.has(t))) {
      matchLines.push(i + 1);
    }
  }

  const windows: SnippetWindow[] = [];
  const covered = new Set<number>();

  for (const matchLine of matchLines) {
    if (windows.length >= opts.maxWindows) break;

    const halfBefore = Math.floor((opts.snippetLines - 1) / 2);
    let start = matchLine - halfBefore;
    let end = start + opts.snippetLines - 1;
    if (start < 1) {
      end += 1 - start;
      start = 1;
    }
    if (end > lines.length) {
      start -= end - lines.length;
      end = lines.length;
      if (start < 1) start = 1;
    }

    let overlaps = false;
    for (let line = start; line <= end; line++) {
      if (covered.has(line)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    for (let line = start; line <= end; line++) covered.add(line);
    windows.push({
      start_line: start,
      text: lines.slice(start - 1, end).join("\n"),
    });
  }

  return windows;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/search-snippets.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/search/snippets.ts tests/search-snippets.test.ts
git commit -m "feat: extract BM25 query snippet windows from live markdown"
```

---

### Task 4: `searchCanon` public API

**Files:**
- Create: `src/search/types.ts`, `src/search/search.ts`
- Test: `tests/search-canon.test.ts`
- Modify: `package.json` (`exports["./search"]`)

**Interfaces:**
- Consumes: `openCanonIndex` from `src/index/reader.ts`; `extractSnippetWindows`; `fs`/`path` for live reads
- Produces:
  - Types in `src/search/types.ts`:

```typescript
export type PackSnippet = { start_line: number; text: string };
export type PackHit = { path: string; score: number; snippets: PackSnippet[] };
export type PackResult = {
  query: string;
  index_id: string;
  freshness: "fresh" | "stale";
  warnings: string[];
  hits: PackHit[];
};

export type SearchCanonOptions = {
  maxHits?: number;
  snippetLines?: number;
  maxWindowsPerHit?: number;
  maxSnippetLinesTotal?: number;
};

export class SearchError extends Error {
  readonly code: "empty_query" | "index_unavailable";
  constructor(code: SearchError["code"], message: string) {
    super(message);
    this.name = "SearchError";
    this.code = code;
  }
}
```

  - `export function searchCanon(root: string, query: string, options?: SearchCanonOptions): PackResult`
    - Trim `query`; if empty → throw `SearchError("empty_query", ...)`.
    - `openCanonIndex(root)` — on throw, wrap/rethrow as `SearchError("index_unavailable", ...)` including hint text `doc-canon index` in message.
    - Freshness: compare `handle.manifest.docs` path→hash to `handle.liveHashes()`; any missing/extra path or hash mismatch → `stale` + `warnings: ["index_stale"]`; else `fresh` + `warnings: []`.
    - `handle.score(query)` already ordered; take first `maxHits` (default 10).
    - For each hit: `fs.readFileSync` under `root`; if missing/unreadable → **skip hit entirely** (no partial hit).
    - Extract windows with defaults `snippetLines=4`, `maxWindowsPerHit=2`.
    - Enforce `maxSnippetLinesTotal` default **120**: count lines in each window (`text.split("\n").length`); while adding would exceed budget, drop that window; if a hit ends with zero snippets after budget, still include the hit with `snippets: []` **only if** at least one window was attempted and dropped for budget — simpler rule: **prefer dropping later windows; if budget is already exhausted before a hit, still emit the hit with `snippets: []`**. Do not drop whole ranked hits solely for budget (paths+scores remain useful). Spec: “truncate later hits/windows” — implement as: stop adding windows once budget exhausted; keep hit entries for all scored paths up to `maxHits`.
    - Return PackResult with `index_id` from `handle.manifest.index_id`.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/search-canon.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCanonIndex } from "../src/index/sync.js";
import { searchCanon, SearchError } from "../src/search/search.js";

describe("searchCanon", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-search-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "# Retrieval\n\ncanon search pack\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("throws empty_query on whitespace", () => {
    assert.throws(() => searchCanon(root, "  "), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal(e.code, "empty_query");
      return true;
    });
  });

  it("throws index_unavailable when missing", () => {
    assert.throws(() => searchCanon(root, "canon"), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal(e.code, "index_unavailable");
      assert.match(e.message, /doc-canon index/);
      return true;
    });
  });

  it("returns fresh hits after sync", async () => {
    await syncCanonIndex(root);
    const pack = searchCanon(root, "retrieval");
    assert.equal(pack.freshness, "fresh");
    assert.deepEqual(pack.warnings, []);
    assert.ok(pack.hits.length >= 1);
    assert.equal(pack.hits[0]!.path, "docs/canon/a.md");
    assert.ok(pack.hits[0]!.snippets.length >= 1);
  });

  it("warns stale but still returns hits", async () => {
    await syncCanonIndex(root);
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "# Retrieval\n\ncanon search pack changed\n",
    );
    const pack = searchCanon(root, "retrieval");
    assert.equal(pack.freshness, "stale");
    assert.ok(pack.warnings.includes("index_stale"));
    assert.ok(pack.hits.length >= 1);
  });

  it("returns empty hits for unknown terms", async () => {
    await syncCanonIndex(root);
    const pack = searchCanon(root, "zzznomatchzzz");
    assert.equal(pack.freshness, "fresh");
    assert.deepEqual(pack.hits, []);
  });

  it("skips hits whose files disappeared", async () => {
    fs.writeFileSync(path.join(root, "docs", "canon", "b.md"), "orphan term xyzzy");
    await syncCanonIndex(root);
    fs.rmSync(path.join(root, "docs", "canon", "b.md"));
    const pack = searchCanon(root, "xyzzy");
    assert.ok(!pack.hits.some((h) => h.path.endsWith("b.md")));
  });

  it("respects maxHits", async () => {
    fs.writeFileSync(path.join(root, "docs", "canon", "b.md"), "retrieval two");
    await syncCanonIndex(root);
    const pack = searchCanon(root, "retrieval", { maxHits: 1 });
    assert.equal(pack.hits.length, 1);
  });
});
```

Re-export `SearchError` and types from `src/search/search.ts` (or from `types.ts` imported by tests).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/search-canon.test.ts`  
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/search/types.ts
// (types + SearchError as in Interfaces above)

// src/search/search.ts
import fs from "node:fs";
import path from "node:path";
import { openCanonIndex } from "../index/reader.js";
import { extractSnippetWindows } from "./snippets.js";
import {
  SearchError,
  type PackHit,
  type PackResult,
  type SearchCanonOptions,
} from "./types.js";

export { SearchError, type PackHit, type PackResult, type SearchCanonOptions } from "./types.js";

const DEFAULTS = {
  maxHits: 10,
  snippetLines: 4,
  maxWindowsPerHit: 2,
  maxSnippetLinesTotal: 120,
} as const;

function isFresh(
  manifestDocs: Record<string, { hash: string }>,
  live: Record<string, string>,
): boolean {
  const manifestPaths = Object.keys(manifestDocs).sort();
  const livePaths = Object.keys(live).sort();
  if (manifestPaths.length !== livePaths.length) return false;
  for (let i = 0; i < manifestPaths.length; i++) {
    if (manifestPaths[i] !== livePaths[i]) return false;
    const p = manifestPaths[i]!;
    if (manifestDocs[p]!.hash !== live[p]) return false;
  }
  return true;
}

export function searchCanon(
  root: string,
  query: string,
  options?: SearchCanonOptions,
): PackResult {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new SearchError("empty_query", "query must be non-empty");
  }

  let handle;
  try {
    handle = openCanonIndex(root);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SearchError(
      "index_unavailable",
      `index unavailable (${detail}); run: doc-canon index`,
    );
  }

  const maxHits = options?.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options?.snippetLines ?? DEFAULTS.snippetLines;
  const maxWindowsPerHit = options?.maxWindowsPerHit ?? DEFAULTS.maxWindowsPerHit;
  const maxSnippetLinesTotal =
    options?.maxSnippetLinesTotal ?? DEFAULTS.maxSnippetLinesTotal;

  const live = handle.liveHashes();
  const fresh = isFresh(handle.manifest.docs, live);
  const freshness = fresh ? "fresh" : "stale";
  const warnings = fresh ? [] : ["index_stale"];

  const ranked = handle.score(trimmed).slice(0, maxHits);
  const hits: PackHit[] = [];
  let usedLines = 0;

  for (const { path: rel, score } of ranked) {
    const abs = path.join(root, ...rel.split("/"));
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const windows = extractSnippetWindows(content, trimmed, {
      snippetLines,
      maxWindows: maxWindowsPerHit,
    });

    const snippets: PackHit["snippets"] = [];
    for (const w of windows) {
      const n = w.text.split("\n").length;
      if (usedLines + n > maxSnippetLinesTotal) break;
      snippets.push(w);
      usedLines += n;
    }

    hits.push({ path: rel, score, snippets });
  }

  return {
    query: trimmed,
    index_id: handle.manifest.index_id,
    freshness,
    warnings,
    hits,
  };
}
```

- [ ] **Step 4: Wire package export**

In `package.json`:

```json
"exports": {
  "./index-reader": "./dist/index/reader.js",
  "./search": "./dist/search/search.js"
}
```

- [ ] **Step 5: Run tests + build**

Run: `npm test -- tests/search-canon.test.ts && npm run build`  
Expected: PASS; `dist/search/search.js` exists

- [ ] **Step 6: Commit**

```bash
git add src/search/types.ts src/search/search.ts tests/search-canon.test.ts package.json
git commit -m "feat: add searchCanon pack API and doc-canon/search export"
```

---

### Task 5: CLI `doc-canon search`

**Files:**
- Create: `src/commands/search.ts`
- Modify: `src/cli.ts`
- Test: `tests/search-cli.test.ts`, `tests/cli-commands.test.ts`

**Interfaces:**
- Consumes: `searchCanon`, `SearchError`, `resolveRoot` from `src/paths.ts`
- Produces: `export async function searchCanonCli(rootFlag: string, query: string | undefined, opts: { json?: boolean; maxHits?: string; snippetLines?: string }): Promise<number>`
  - Resolve root; parse optional numeric flags (invalid → stderr + exit 1).
  - Missing query arg → exit 1.
  - On `SearchError` → stderr message, exit 1.
  - Human mode: for each hit print `path` + score + snippet texts; if stale, `console.error` warning containing `index_stale`.
  - `--json`: `console.log(JSON.stringify(pack))` only on stdout; warnings live inside JSON; stale still exit 0.
  - Success (including empty hits / stale) → exit 0.

CLI registration:

```typescript
program
  .command("search")
  .description("Search canon BM25 index and emit a bounded context pack")
  .argument("<query>", "search query")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit Pack JSON on stdout")
  .option("--max-hits <n>", "max ranked documents", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .action(async (query: string, opts) => {
    const { searchCanonCli } = await import("./commands/search.js");
    process.exitCode = await searchCanonCli(opts.root, query, opts);
  });
```

- [ ] **Step 1: Write failing CLI tests**

```typescript
// tests/search-cli.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

describe("doc-canon search cli", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-searchcli-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "hello retrieval pack\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("fails closed without index", () => {
    const r = spawnSync("node", [bin, "search", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /doc-canon index/i);
  });

  it("indexes then returns json pack", () => {
    assert.equal(
      spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" })
        .status,
      0,
    );
    const r = spawnSync(
      "node",
      [bin, "search", "retrieval", "--root", root, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const pack = JSON.parse(r.stdout);
    assert.equal(pack.query, "retrieval");
    assert.ok(Array.isArray(pack.hits));
    assert.equal(pack.freshness, "fresh");
  });

  it("warns on stderr when stale in human mode", () => {
    spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "hello retrieval pack changed\n",
    );
    const r = spawnSync("node", [bin, "search", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stderr, /index_stale/);
  });

  it("rejects empty query", () => {
    const r = spawnSync("node", [bin, "search", "   ", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
  });
});
```

Update `tests/cli-commands.test.ts` command lists to include `"search"`.

- [ ] **Step 2: Run tests to verify fail**

Run: `npm test -- tests/search-cli.test.ts`  
Expected: FAIL (unknown command / missing module)

- [ ] **Step 3: Implement command + register in `src/cli.ts`**

```typescript
// src/commands/search.ts
import { resolveRoot } from "../paths.js";
import { searchCanon, SearchError } from "../search/search.js";

export type SearchCliOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
};

export async function searchCanonCli(
  rootFlag: string,
  query: string | undefined,
  opts: SearchCliOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (query === undefined) {
    console.error("error: query required");
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
    const pack = searchCanon(root, query, { maxHits, snippetLines });
    if (opts.json) {
      console.log(JSON.stringify(pack));
    } else {
      if (pack.freshness === "stale") {
        console.error("warning: index_stale (run doc-canon index to refresh)");
      }
      if (pack.hits.length === 0) {
        console.log("no hits");
      }
      for (const hit of pack.hits) {
        console.log(`${hit.path}  score=${hit.score}`);
        for (const snip of hit.snippets) {
          console.log(`  L${snip.start_line}:`);
          for (const line of snip.text.split("\n")) {
            console.log(`    ${line}`);
          }
        }
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof SearchError) {
      console.error(`error: ${error.message}`);
      return 1;
    }
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
```

Wire `search` in `src/cli.ts` as shown in Interfaces (commander option keys become `maxHits` / `snippetLines` via camelCase).

- [ ] **Step 4: Run tests + build**

Run: `npm run build && npm test -- tests/search-cli.test.ts tests/cli-commands.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/search.ts src/cli.ts tests/search-cli.test.ts tests/cli-commands.test.ts
git commit -m "feat: add doc-canon search CLI wrapper"
```

---

### Task 6: Embed Scout search protocol + acceptance + stamp

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, `embedded/skills/canon-future-plan/SKILL.md` (Scout sections)
- Mirror the same Scout protocol edits under `.cursor/skills/` for each skill that shares the Scout recipe
- Modify: `docs/acceptance/skill-scenarios.md`
- Modify: `tests/embedded-assets.test.ts` (lock phrases)
- Modify: `src/version.ts` (`SKILLS_STAMP = "0.8.0"`)
- Modify: `docs/canon/CANON_CONTRACT.md` (`skills_stamp: "0.8.0"`) — stamp sync only; if policy prefers skill, run `canon-write` for the YAML line after code bump

**Interfaces:**
- Consumes: living `SKILLS.md` protocol from Task 2
- Produces: managed skills that mandate try-search-first; acceptance scenarios; stamp 0.8.0

Skill Scout edits (all skills that document Scout → Expand):

1. Always try `doc-canon search "<topic>"` first (or `searchCanon` for Node).
2. Fail-closed → INDEX-first Scout + explicit hint to run `doc-canon index`; do not hard-stop.
3. `index_stale` → surface warning; continue; Expand if thin.
4. Build working-set stubs from `hits[].path` (+ brief snippet stubs), not full corpus dump.
5. After successful substantive writes under `docs/canon/**`, **run** one-shot `doc-canon index`; on watch lock failure, surface outcome (rely on watch / suggest `--stop`) — never silent reindex inside `search`.

Acceptance scenarios to add:

```markdown
## Scout uses search then Expand

- [ ] With a built index, ask `canon-write` for a substantial change; confirm Scout tries `doc-canon search` before dumping all canon files.
- [ ] Confirm working set is seeded from pack paths/snippets.
- [ ] Confirm Expand still runs when the pack is thin or doubtful.

## Search missing index falls back

- [ ] In a repo without `.doc-canon` index artifacts, start Scout; confirm INDEX-first fallback plus an explicit hint to run `doc-canon index` (skill does not hard-stop).

## Post-write runs index

- [ ] After a successful substantive `docs/canon/**` write via a managed skill, confirm the skill runs one-shot `doc-canon index` (or surfaces watch-lock failure without fighting the lock).
```

Embedded-assets tests: assert managed write/audit (and future-plan if edited) match `/doc-canon search/i` and `/index_stale|post-write|one-shot/i` (pick stable phrases actually written). Assert acceptance headings exist.

- [ ] **Step 1: Write/adjust failing asset tests for new phrases + acceptance headings**

- [ ] **Step 2: Run to verify fail**

Run: `npm test -- tests/embedded-assets.test.ts`  
Expected: FAIL on new assertions

- [ ] **Step 3: Edit embedded + `.cursor` skills, acceptance doc, bump stamp**

- [ ] **Step 4: Run full verify**

Run: `npm test && npm run build && node bin/doc-canon.js validate --root .`  
Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add embedded/skills .cursor/skills docs/acceptance/skill-scenarios.md tests/embedded-assets.test.ts src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "feat: embed Scout search protocol and bump skills_stamp to 0.8.0"
```

---

### Task 7: Absorb P1 via skills (after ship verification)

**Files:**
- Living canon polish only if drift remains (via `canon-write`)
- Initiative status → `absorbed` via `canon-future-plan`

**Interfaces:**
- Consumes: shipped CLI/API/skills matching living SoT
- Produces: initiative `absorbed` + INDEX status

- [ ] **Step 1: Confirm living SoT matches shipped behavior** (`canon-write` only if gaps)

- [ ] **Step 2: Invoke `canon-future-plan` to mark P1 `absorbed` and sync `future_plans/INDEX.md`**

- [ ] **Step 3: Validate + commit**

```bash
git add docs/canon/future_plans/p1-retrieval-and-context-pack.md docs/canon/future_plans/INDEX.md
git commit -m "docs: mark P1 retrieval search and context pack absorbed"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Public `searchCanon` / `doc-canon/search` | 4 |
| Hybrid pack schema (paths, scores, snippets, freshness, warnings) | 4 |
| Snippets from live files; skip missing hit files | 3, 4 |
| Size defaults + hard total snippet-line budget | 4 |
| CLI human / `--json` / flags / exit codes | 5 |
| Stale warn+serve; missing fail-closed; empty query fail; zero hits OK | 4, 5 |
| No auto-reindex in search | Global + 4–5 |
| Scout try-then-fallback; Expand quality invariant | 2, 6 |
| Post-write runs one-shot `index`; watch lock surface | 2, 6 |
| Living canon canon-first before code | 2 (+ stop) |
| Initiative Design sync / absorb | 1, 7 |
| Acceptance scenarios | 6 |
| Unit + CLI tests | 3–5 |

## Supersedes

Do **not** execute `docs/superpowers/plans/2026-08-11-retrieval-search-pack.md` (pre-`openCanonIndex` pack shape, weaker post-write index rule). This plan replaces it.
