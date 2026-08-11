# Retrieval Search & Pack (P1 narrowed) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `doc-canon search` that returns a bounded context pack from the BM25 index, with hash-stale **warn + serve**, missing-index fail-closed, and skill/CLI usage rules so agents know when/how to search canon.

**Architecture:** Read artifacts produced by Plan A (`index-manifest.json`, `bm25-index.json`). Compare live file hashes to the manifest; if mismatch, print `index_stale` warning and still score/pack. Pack is JSON (and human summary) with top hits + size limits. Skills document Scout→search→Expand; they do not auto-call `index` on every stale warn.

**Tech Stack:** TypeScript (Node ≥20), existing `Bm25Index` / `contentHash` / sync paths from Plan A, `commander`, `node:test`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-11-bm25-index-and-retrieval-split-design.md`.
- **Prerequisite:** Plan A (`docs/superpowers/plans/2026-08-11-bm25-index.md`) Tasks 3–6 complete (index library + one-shot `doc-canon index` working). Watcher optional but recommended.
- **Canon-first:** Task 1 living-canon update + user go-ahead before Tasks 2+ ship CLI/skill behavior.
- Coding agents must not edit `docs/canon/**` themselves; use **`canon-write`** (and `canon-future-plan` only for initiative status).
- Stale: warn + serve. Missing index: fail closed with hint to run `doc-canon index`.
- No embeddings; no auto-reindex inside `search`.
- TDD; `npm test` + `npm run build` before claiming done.

**Locked choices (were open in the spec):**

- Pack encoding: JSON object on stdout when `--json`; human multi-line summary by default.
- Pack fields: `query`, `stale` (boolean), `hits: [{ path, score, snippet }]`, `truncated` if needed.
- Size: default `max_hits=10`; snippet ≤ 200 chars; optional `--max-hits <n>`.

---

## File Structure

```text
# Living canon (canon-write — Task 1)
docs/canon/CLI.md
docs/canon/ARCHITECTURE.md
docs/canon/SKILLS.md
docs/canon/GLOSSARY.md                      # optional: context pack

# Implementation
src/search/freshness.ts                     # NEW compareDiskHashes vs manifest
src/search/pack.ts                          # NEW buildSearchPack
src/search/snippet.ts                       # NEW excerpt around first query term
src/commands/search.ts                      # NEW
src/cli.ts                                  # register search

# Skills / acceptance
embedded/skills/canon-write/SKILL.md        # Scout: prefer search when index exists
embedded/skills/canon-audit/SKILL.md        # same guidance pointer
.cursor/skills/...                          # mirrors
docs/acceptance/skill-scenarios.md

# Tests
tests/search-freshness.test.ts
tests/search-pack.test.ts
tests/search-cli.test.ts
tests/cli-commands.test.ts
```

---

### Task 1: Living canon for search + skill rules via `canon-write` (gate)

**Files:**
- Modify (via skill only): `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/SKILLS.md`, optionally `GLOSSARY.md`

**Interfaces:**
- Consumes: design spec + remapped P1 initiative
- Produces: living SoT for `search` and Scout retrieval protocol

- [ ] **Step 1: Invoke `canon-write`**

Content:

1. **`CLI.md`** — `search <query>`: BM25 over indexed canon; `--root`; `--json`; `--max-hits`; missing index → exit ≠0 + hint; stale → warn on stderr, results still printed.
2. **`ARCHITECTURE.md`** — search reads A’s artifacts; freshness check; pack builder; no index mutation.
3. **`SKILLS.md`** — Scout may call `doc-canon search` instead of dumping all md; on `index_stale` continue + Expand if thin; call `index` only on explicit/post-write triggers; missing index → run `index` then retry or INDEX fallback; quality-over-thrift unchanged.

4. Validate under the skill.

- [ ] **Step 2: Commit**

```bash
git add docs/canon/CLI.md docs/canon/ARCHITECTURE.md docs/canon/SKILLS.md docs/canon/GLOSSARY.md
git commit -m "$(cat <<'EOF'
docs: describe doc-canon search and skill retrieval protocol

Canon-first SoT for retrieval pack ahead of CLI/skill implementation.
EOF
)"
```

- [ ] **Step 3: STOP — wait for explicit user go-ahead before Task 2**

---

### Task 2: Freshness check (stale vs missing)

**Files:**
- Create: `src/search/freshness.ts`
- Test: `tests/search-freshness.test.ts`

**Interfaces:**
- Consumes: `contentHash`, `IndexManifest`, `canonDir`, read files from disk
- Produces:
  - `type Freshness = { status: "ok" | "stale" | "missing"; mismatched: string[] }`
  - `checkIndexFreshness(root: string, manifest: IndexManifest | null): Promise<Freshness>`
    - `manifest === null` or missing artifact → `{ status: "missing", mismatched: [] }`
    - Walk current `docs/canon/**` files; compute hashes; if any path hash differs from manifest, or manifest has extra paths, or disk has new paths not in manifest → `stale`
    - Else `ok`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/search-freshness.test.ts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { contentHash } from "../src/index/hash.js";
import { checkIndexFreshness } from "../src/search/freshness.js";
import type { IndexManifest } from "../src/index/types.js";

function tempRoot(): { root: string; cleanup: () => void } {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-fresh-"));
  mkdirSync(join(root, "docs", "canon"), { recursive: true });
  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

describe("checkIndexFreshness", () => {
  it("returns missing when manifest is null", async () => {
    const { root, cleanup } = tempRoot();
    try {
      const f = await checkIndexFreshness(root, null);
      assert.equal(f.status, "missing");
    } finally {
      cleanup();
    }
  });

  it("returns ok when hashes match", async () => {
    const { root, cleanup } = tempRoot();
    try {
      const body = "hello";
      writeFileSync(join(root, "docs", "canon", "a.md"), body, "utf8");
      const manifest: IndexManifest = {
        schema_version: 1,
        built_at: new Date().toISOString(),
        corpus: "docs/canon/**",
        docs: { "docs/canon/a.md": { hash: contentHash(body), token_count: 1 } },
      };
      assert.equal((await checkIndexFreshness(root, manifest)).status, "ok");
    } finally {
      cleanup();
    }
  });

  it("returns stale when content changes", async () => {
    const { root, cleanup } = tempRoot();
    try {
      writeFileSync(join(root, "docs", "canon", "a.md"), "new", "utf8");
      const manifest: IndexManifest = {
        schema_version: 1,
        built_at: new Date().toISOString(),
        corpus: "docs/canon/**",
        docs: { "docs/canon/a.md": { hash: contentHash("old"), token_count: 1 } },
      };
      const f = await checkIndexFreshness(root, manifest);
      assert.equal(f.status, "stale");
      assert.ok(f.mismatched.includes("docs/canon/a.md"));
    } finally {
      cleanup();
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/search-freshness.test.ts
```

- [ ] **Step 3: Implement `checkIndexFreshness`**

Reuse the same directory walk conventions as `syncCanonIndex` (posix relative paths). Prefer extracting a shared `listCanonFiles(root)` into `src/index/list.ts` if duplication is painful — only if both call sites need it; otherwise duplicate the small walk once.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/search/freshness.ts tests/search-freshness.test.ts src/index/list.ts
git commit -m "feat: check BM25 index freshness against live canon hashes"
```

---

### Task 3: Snippets + pack builder

**Files:**
- Create: `src/search/snippet.ts`, `src/search/pack.ts`
- Test: `tests/search-pack.test.ts`

**Interfaces:**
- Consumes: `Bm25Index.score`, file reads
- Produces:
  - `makeSnippet(text: string, query: string, maxLen = 200): string`
  - `type SearchHit = { path: string; score: number; snippet: string }`
  - `type SearchPack = { query: string; stale: boolean; hits: SearchHit[] }`
  - `buildSearchPack(opts: { root: string; query: string; index: Bm25Index; stale: boolean; maxHits: number }): Promise<SearchPack>`
    - Score query; take top `maxHits`; for each hit read file and snippet; skip unreadable files with empty snippet

- [ ] **Step 1: Write failing tests**

```typescript
// tests/search-pack.test.ts
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { Bm25Index } from "../src/index/bm25.js";
import { buildSearchPack } from "../src/search/pack.js";
import { makeSnippet } from "../src/search/snippet.js";

describe("makeSnippet", () => {
  it("includes the query term window", () => {
    const s = makeSnippet("aaa bm25bbb ccc", "bm25", 20);
    assert.match(s, /bm25/i);
  });
});

describe("buildSearchPack", () => {
  it("returns scored hits with snippets", async () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-pack-"));
    try {
      mkdirSync(join(root, "docs", "canon"), { recursive: true });
      writeFileSync(join(root, "docs", "canon", "a.md"), "alpha beta gamma", "utf8");
      const index = Bm25Index.empty();
      index.upsertDocument("docs/canon/a.md", "alpha beta gamma");
      const pack = await buildSearchPack({
        root,
        query: "alpha",
        index,
        stale: false,
        maxHits: 5,
      });
      assert.equal(pack.stale, false);
      assert.equal(pack.hits[0]?.path, "docs/canon/a.md");
      assert.match(pack.hits[0]?.snippet ?? "", /alpha/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement snippet + pack**

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/search/snippet.ts src/search/pack.ts tests/search-pack.test.ts
git commit -m "feat: build bounded BM25 search packs with snippets"
```

---

### Task 4: CLI `doc-canon search`

**Files:**
- Create: `src/commands/search.ts`
- Modify: `src/cli.ts`, `tests/cli-commands.test.ts`
- Test: `tests/search-cli.test.ts`

**Interfaces:**
- Consumes: `loadIndexBundle`, `checkIndexFreshness`, `buildSearchPack`, `resolveRoot`
- Produces: `searchCanon(rootFlag: string, query: string, opts: { json?: boolean; maxHits?: number }): Promise<number>`
  - Missing → stderr message including `doc-canon index`, exit 1
  - Stale → stderr line `warning: index_stale` (and optionally mismatched count), exit 0 with results
  - Human stdout: one hit per block `path\tscore\nsnippet\n`
  - `--json`: single JSON `SearchPack`

- [ ] **Step 1: Write failing CLI tests**

```typescript
// tests/search-cli.test.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = join(repoRoot, "bin", "doc-canon.js");

describe("doc-canon search", () => {
  it("fails closed when index is missing", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-search-miss-"));
    try {
      mkdirSync(join(root, "docs", "canon"), { recursive: true });
      writeFileSync(join(root, "docs", "canon", "a.md"), "alpha", "utf8");
      const r = spawnSync("node", [bin, "search", "alpha", "--root", root], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      assert.notEqual(r.status, 0);
      assert.match(r.stderr + r.stdout, /doc-canon index/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("warns index_stale but still returns hits", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-search-stale-"));
    try {
      mkdirSync(join(root, "docs", "canon"), { recursive: true });
      writeFileSync(join(root, "docs", "canon", "a.md"), "alpha", "utf8");
      const idx = spawnSync("node", [bin, "index", "--root", root], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      assert.equal(idx.status, 0, idx.stderr || idx.stdout);
      writeFileSync(join(root, "docs", "canon", "a.md"), "alpha omega", "utf8");
      const r = spawnSync("node", [bin, "search", "alpha", "--root", root, "--json"], {
        cwd: repoRoot,
        encoding: "utf8",
      });
      assert.equal(r.status, 0, r.stderr || r.stdout);
      assert.match(r.stderr, /index_stale/);
      const pack = JSON.parse(r.stdout) as { stale: boolean; hits: unknown[] };
      assert.equal(pack.stale, true);
      assert.ok(pack.hits.length >= 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

Also add `"search"` to `tests/cli-commands.test.ts` help lists.

- [ ] **Step 2: Run — expect FAIL**

```bash
npm run build && npm test -- tests/search-cli.test.ts tests/cli-commands.test.ts
```

- [ ] **Step 3: Implement `searchCanon` + register command**

```typescript
// cli registration sketch
program
  .command("search")
  .description("BM25 search over indexed docs/canon")
  .argument("<query>", "search query")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit SearchPack JSON")
  .option("--max-hits <n>", "max hits", "10")
  .action(async (query: string, opts: { root: string; json?: boolean; maxHits: string }) => {
    try {
      const { searchCanon } = await import("./commands/search.js");
      process.exitCode = await searchCanon(opts.root, query, {
        json: Boolean(opts.json),
        maxHits: Number(opts.maxHits) || 10,
      });
    } catch (error) {
      console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
  });
```

Empty query → exit 1 with clear message.

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/commands/search.ts src/cli.ts tests/search-cli.test.ts tests/cli-commands.test.ts
git commit -m "feat: add doc-canon search with stale warn and JSON pack"
```

---

### Task 5: Skill guidance + acceptance scenarios

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, mirrors under `.cursor/skills/`, `docs/acceptance/skill-scenarios.md`
- Possibly bump `SKILLS_STAMP` in `src/version.ts` and contract stamp if managed skill text ships via `upgrade-skills` (follow existing stamp pattern if skills changed)

**Interfaces:**
- Consumes: living `SKILLS.md` rules from Task 1
- Produces: concrete Scout steps referencing `doc-canon search` / stale / Expand

- [ ] **Step 1: Add acceptance scenarios** (append to `docs/acceptance/skill-scenarios.md`)

Scenarios:

1. Scout with search: given indexed canon, write skill Scout calls `doc-canon search` before deep-reading all sections.
2. Stale warn: skill continues with pack and Expand if needed; does not auto-`index` solely because of warn.
3. Missing index: skill runs `doc-canon index` then retries search, or falls back to INDEX Scout.

- [ ] **Step 2: Update embedded skill Scout sections** to match scenarios (keep quality-over-thrift).

- [ ] **Step 3: Mirror to `.cursor/skills/`; bump stamp if required by repo convention; run tests**

```bash
npm test -- tests/embedded-assets.test.ts
npm run build && npm test
```

- [ ] **Step 4: Commit**

```bash
git add embedded/skills .cursor/skills docs/acceptance/skill-scenarios.md src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "docs: teach canon skills to Scout via doc-canon search"
```

---

### Task 6: Absorb future_plans + final verify

**Files:**
- Via `canon-write` / `canon-future-plan`: absorb outcomes into living sections if any drift; set P0b and P1 statuses appropriately (`implementing` → `absorbed` only after living SoT matches)

- [ ] **Step 1: Full verify**

```bash
npm run build && npm test
node bin/doc-canon.js index --root .
node bin/doc-canon.js search "BM25" --root . --json
```

- [ ] **Step 2: Invoke `canon-future-plan` / `canon-write` for absorb** if product is complete; otherwise leave statuses at `implementing` and stop with a clear remaining-absorb note.

- [ ] **Step 3: Final commit of any absorb docs**

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `doc-canon search` | Task 4 |
| Pack format + size policy | Task 3–4 |
| Skill + CLI rules / flows | Task 1, 5 |
| Warn + serve stale | Task 2, 4 |
| Missing index fail closed | Task 4 |
| No auto-reindex in search | Task 4 |
| Depends on index (Plan A) | Prerequisite |

## Placeholder / consistency check

- Types: `SearchPack`, `SearchHit`, `Freshness` as defined above
- Stderr token for stale: `index_stale`
- Does not call `syncCanonIndex` from `search`
