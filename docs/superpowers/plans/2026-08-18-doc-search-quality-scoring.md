# Doc-Search Quality Scoring (P4 + liveness + P5) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve `doc-canon search` ranking so agents deep-read fewer files — light EN/RU stemming, heading-aware term weights, `future_plans/**` downweighting, and glossary-aware query expansion — without changing the Pack shape.

**Architecture:** Stemming lives inside `tokenize` (index and query tokenize identically). `Bm25Index` gains per-doc heading-term sets and two score multipliers (heading ×1.5, `future_plans/` ×0.5). A new `src/search/glossary.ts` reads the contract-referenced `GLOSSARY.md` live and expands query terms with canonical-term tokens before scoring.

**Tech Stack:** TypeScript (ESM, `.js` import extensions), `node:test` + `tsx`, existing `Bm25Index`, `extractMarkdownHeadings`-style heading parsing.

**Spec:** [`docs/superpowers/specs/2026-08-18-doc-search-quality-scoring-design.md`](../specs/2026-08-18-doc-search-quality-scoring-design.md)

## Global Constraints

- ESM: source imports use `.js` extensions. Never write `.ts`-extension imports in new code.
- Determinism is a hard invariant: identical corpus + index + query → identical bytes. All ordering and rule application must be fully specified (first matching suffix rule wins; single rule application; no recursive stripping).
- Index and query MUST tokenize identically — stemming is inside `tokenize`, never applied at query time only.
- Pack shape and `searchCanon` public options/signature unchanged; `doc-canon index`/`search` CLI surface unchanged (no new flags).
- `bm25-index.json` becomes `schema_version: 2` with optional `heading_terms`; the reader stays tolerant of v1 (treated as no heading terms). `index-manifest.json` stays `schema_version: 1` and gains optional `tokenizer_version`.
- No new runtime dependencies. No embeddings / vector retrieval.
- Rebuild semantics stay hash-driven; a `tokenizer_version` mismatch forces a full rebuild (mirrors `grammar_bumped` in the code index).
- Canon-first: Task 1 lands and is validated before any application code; execution STOPS after Task 1 for an explicit user go-ahead.

---

### Task 1: Canon-first — P4/P5 to implementing, Block B initiative, open-question resolutions

**Files:**
- Modify: `docs/canon/future_plans/p4-bm25-scoring.md`
- Modify: `docs/canon/future_plans/p5-glossary-aware-search.md`
- Create: `docs/canon/future_plans/p6-code-refs-member-access.md`
- Modify: `docs/canon/future_plans/INDEX.md`
- Modify: `docs/canon/GLOSSARY.md`, `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`

**Interfaces:**
- Consumes: canon-write skill (`.claude/skills/canon-write/SKILL.md`) and canon-future-plan skill (`.claude/skills/canon-future-plan/SKILL.md`); do NOT hand-edit `docs/canon/**`.
- Produces: canon text describing stemming/heading-weights/liveness/glossary for Tasks 2–4; P4/P5 marked `implementing`; a draft initiative for the deferred code-index member-access work.

- [ ] **Step 1: Load canon-write and canon-future-plan skills; read current canon**

Load both skill files via the skill tool. Read current `p4-bm25-scoring.md`, `p5-glossary-aware-search.md`, `future_plans/INDEX.md`, `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`.

- [ ] **Step 2: Resolve P4/P5 open questions in the initiative files via canon-future-plan**

Update P4 (status `implementing`) and P5 (status `implementing`), appending a "Decisions" note resolving their open questions exactly as the spec's Decisions table does:
- P4: light suffix-strip stemmer inside `tokenize` (EN `ing/ed/ly/er/est/ies→y/es/s`, RU endings incl. `ов/ев/ами/ями/ом/ем/ах/ях/ый/ий/ой/ая/яя/ое/ее/ие/ые/и/ы/а/я/о/е/у/ю`, tokens longer than 3 chars); heading weight via per-term score multiplier 1.5 using an optional `heading_terms` field in the BM25 state; `bm25-index.json` bumps to `schema_version: 2`; `tokenizer_version` added to the index manifest to force rebuilds.
- P5: glossary read live at search time (no manifest snapshot) via the contract's glossary role; expansion adds canonical-term tokens to the query term set (additive, OR); no separate boost multiplier (idf carries it); no policies knob; glossary-missing fails open.

- [ ] **Step 3: Create the Block B initiative via canon-future-plan**

Create `docs/canon/future_plans/p6-code-refs-member-access.md` (draft): Focus — resolve `obj.method()` call-site edges in the code AST index where `obj` is a local binding initialized from `new ImportedName(...)`, syntactically, staying within P2a's cheap-references tier (no name resolution); unblocks `--refs Class.method`. Note the evidence from the A+B slice: `--refs Bm25Index.build` returns zero hits and `handle.score(...)` is not linked to the `score` method. Add a row to `future_plans/INDEX.md` via canon-future-plan.

- [ ] **Step 4: Update living canon via canon-write**

GLOSSARY: add/update terms for the stemmer, heading weight, liveness (`future_plans` downweight), `tokenizer_version`, and glossary expansion mechanics. CLI.md: note in the `search` behavior that stemming, heading weights, liveness, and glossary expansion apply (no surface change). ARCHITECTURE.md: retrieval notes — stemming in the tokenizer path, heading weighting, `future_plans` downweight, live glossary read, `schema_version: 2`, `tokenizer_version` rebuild trigger.

- [ ] **Step 5: Validate the canon**

Run: `doc-canon validate`
Expected: exit 0, no findings.

- [ ] **Step 6: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): P4/P5 implementing; add P6 code-refs member-access initiative"
```

- [ ] **Step 7: STOP — wait for explicit user go-ahead before Task 2**

Per AGENTS.md canon-first, application code starts only after the user confirms.

---

### Task 2: Stemming in the tokenizer

**Files:**
- Create: `src/index/stem.ts`
- Modify: `src/index/tokenize.ts`
- Test: `tests/index-stem.test.ts` (new), `tests/index-tokenize.test.ts`

**Interfaces:**
- Produces: `stem(token: string): string` — pure, deterministic, EN/RU suffix-strip. `tokenize` now applies `stem` to every token. Tasks 3 and 4 depend on this (index/query consistency).

- [ ] **Step 1: Write the failing tests**

Create `tests/index-stem.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { stem } from "../src/index/stem.js";

describe("stem", () => {
  it("collapses English inflectional forms", () => {
    const stems = ["index", "indexes", "indexed", "indexing"].map(stem);
    assert.deepEqual(stems, ["index", "index", "index", "index"]);
  });
  it("ies -> y", () => {
    assert.equal(stem("babies"), "baby");
    assert.equal(stem("stories"), "story");
  });
  it("does not over-strip short results", () => {
    assert.equal(stem("uses"), "uses");
    assert.equal(stem("goes"), "goes");
  });
  it("collapses Russian inflectional forms", () => {
    const stems = ["индекса", "индексу", "индексом", "индексами"].map(stem);
    assert.deepEqual(stems, ["индекс", "индекс", "индекс", "индекс"]);
  });
  it("leaves short tokens unchanged", () => {
    assert.equal(stem("и"), "и");
    assert.equal(stem("a"), "a");
  });
  it("is deterministic", () => {
    assert.equal(stem("indexing"), stem("indexing"));
  });
});
```

Append to `tests/index-tokenize.test.ts`:

```ts
  it("stems tokens identically for index and query", () => {
    assert.deepEqual(tokenize("Indexing indexed indexes"), ["index", "index", "index"]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/index-stem.test.ts tests/index-tokenize.test.ts`
Expected: the new stem tests FAIL with `stem is not defined`; the tokenize test FAILS (tokens unstemmed).

- [ ] **Step 3: Implement `stem.ts`**

Create `src/index/stem.ts`:

```ts
// src/index/stem.ts
const EN_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ["ies", "y"],
  ["ing", ""],
  ["ed", ""],
  ["ly", ""],
  ["er", ""],
  ["est", ""],
  ["es", ""],
  ["s", ""],
];

const RU_SUFFIXES: readonly string[] = [
  "ами",
  "ями",
  "ов",
  "ев",
  "ом",
  "ем",
  "ах",
  "ях",
  "ый",
  "ий",
  "ой",
  "ая",
  "яя",
  "ое",
  "ее",
  "ие",
  "ые",
  "и",
  "ы",
  "а",
  "я",
  "о",
  "е",
  "у",
  "ю",
];

const CYRILLIC_RE = /[\u0400-\u04FF]/;

export function stem(token: string): string {
  if (token.length <= 3) return token;
  if (CYRILLIC_RE.test(token)) {
    for (const suffix of RU_SUFFIXES) {
      if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
        return token.slice(0, -suffix.length);
      }
    }
    return token;
  }
  for (const [suffix, replacement] of EN_SUFFIXES) {
    if (token.endsWith(suffix)) {
      const stemmed = token.slice(0, -suffix.length) + replacement;
      if (stemmed.length >= 4) return stemmed;
    }
  }
  return token;
}
```

- [ ] **Step 4: Wire stemming into `tokenize.ts`**

Replace `src/index/tokenize.ts`:

```ts
import { stem } from "./stem.js";

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .map(stem);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test tests/index-stem.test.ts tests/index-tokenize.test.ts`
Expected: all PASS (the pre-existing tokenize cases still hold: `hello`/`bm25`/`канон`/`тест` do not match any suffix).

- [ ] **Step 6: Run the full suite (regression check)**

Run: `npm test`
Expected: PASS. Note: `tests/index-bm25.test.ts` uses only unstemmable words (`alpha`, `beta`, `shared` → `shar` consistently on both docs and query), so its assertions hold.

- [ ] **Step 7: Commit**

```bash
git add src/index/stem.ts src/index/tokenize.ts tests/index-stem.test.ts tests/index-tokenize.test.ts
git commit -m "feat: light EN/RU stemming in the tokenizer"
```

---

### Task 3: BM25 heading weights, liveness, schema v2, tokenizer_version

**Files:**
- Modify: `src/index/types.ts`
- Modify: `src/index/bm25.ts`
- Modify: `src/index/io.ts`
- Modify: `src/index/sync.ts`
- Test: `tests/index-bm25.test.ts`, `tests/index-io.test.ts`, `tests/index-sync.test.ts`

**Interfaces:**
- Consumes: `stem`/`tokenize` (Task 2). `Bm25Index.build(docs, indexId)` signature unchanged.
- Produces: `Bm25State` with optional `heading_terms`; `score()` applies `HEADING_WEIGHT` (×1.5) per heading term and `FUTURE_PLANS_WEIGHT` (×0.5) to paths under `future_plans/`; `toJSON()` emits `schema_version: 2`; `parseBm25` accepts 1|2; `syncCanonIndex` writes `tokenizer_version` and rebuilds on mismatch. Task 4 consumes `handle.score` unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `tests/index-bm25.test.ts`:

```ts
  it("heading tokens outrank body-only tokens", () => {
    const idx = Bm25Index.build(
      [
        { path: "a.md", text: "# Index\n\nword" },
        { path: "b.md", text: "index index index" },
      ],
      "id-head",
    );
    const hits = idx.score("index");
    assert.equal(hits[0]?.path, "a.md");
  });

  it("future_plans docs are downweighted", () => {
    const idx = Bm25Index.build(
      [
        { path: "future_plans/p1.md", text: "shared topic" },
        { path: "living.md", text: "shared topic" },
      ],
      "id-live",
    );
    const hits = idx.score("shared");
    assert.equal(hits[0]?.path, "living.md");
  });

  it("serializes schema_version 2 with heading_terms", () => {
    const idx = Bm25Index.build(
      [{ path: "a.md", text: "# Title\n\nbody" }],
      "id-schema",
    );
    const state = idx.toJSON();
    assert.equal(state.schema_version, 2);
    assert.ok(Array.isArray(state.heading_terms?.["a.md"]));
  });
```

Update `tests/index-io.test.ts`: the `bm25` fixture helper must use `schema_version: 2` (line 28):

```ts
  const bm25 = (id: string): Bm25State => ({
    schema_version: 2,
    index_id: id,
    postings: { "docs/canon/a.md": { alpha: 1 } },
    doc_lengths: { "docs/canon/a.md": 1 },
  });
```

Append to `tests/index-sync.test.ts`:

```ts
  it("tokenizer_version bump forces rebuild with unchanged files", async () => {
    await syncCanonIndex(root);
    const manifestPath = indexManifestPath(root);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.tokenizer_version = "2";
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const r = await syncCanonIndex(root);
    assert.equal(r.status, "updated");
    assert.equal(loadIndexPair(root).manifest.tokenizer_version, "1");
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/index-bm25.test.ts tests/index-io.test.ts tests/index-sync.test.ts`
Expected: heading and liveness tests FAIL (no weights); schema test FAILS (`schema_version` is 1); the sync test FAILS (`tokenizer_version` missing); the io test may fail on the type.

- [ ] **Step 3: Update `src/index/types.ts`**

```ts
export type IndexManifest = {
  schema_version: 1;
  index_id: string;
  built_at: string;
  corpus: "docs/canon/**";
  docs: Record<string, IndexDocMeta>;
  tokenizer_version?: string;
};

export type Bm25State = {
  schema_version: 2;
  index_id: string;
  /** path → term → tf */
  postings: Record<string, Record<string, number>>;
  /** path → token count */
  doc_lengths: Record<string, number>;
  /** path → heading tokens */
  heading_terms?: Record<string, string[]>;
};
```

- [ ] **Step 4: Update `src/index/bm25.ts`**

Replace the whole file:

```ts
import { tokenize } from "./tokenize.js";
import type { Bm25State } from "./types.js";

const K1 = 1.2;
const B = 0.75;
const HEADING_WEIGHT = 1.5;
const FUTURE_PLANS_WEIGHT = 0.5;

function extractHeadingTerms(text: string): string[] {
  const terms = new Set<string>();
  for (const line of text.split("\n")) {
    const trimmed = line.trimStart();
    if (/^#{1,6}\s/.test(trimmed)) {
      for (const token of tokenize(trimmed)) terms.add(token);
    }
  }
  return [...terms];
}

export class Bm25Index {
  private constructor(
    private readonly indexId: string,
    private readonly postings: Record<string, Record<string, number>>,
    private readonly docLengths: Record<string, number>,
    private readonly headingTerms: Record<string, string[]>,
  ) {}

  static build(
    docs: Array<{ path: string; text: string }>,
    indexId: string,
  ): Bm25Index {
    const postings: Record<string, Record<string, number>> = {};
    const docLengths: Record<string, number> = {};
    const headingTerms: Record<string, string[]> = {};

    for (const { path, text } of docs) {
      const tokens = tokenize(text);
      const tf: Record<string, number> = {};
      for (const token of tokens) {
        tf[token] = (tf[token] ?? 0) + 1;
      }
      postings[path] = tf;
      docLengths[path] = tokens.length;
      headingTerms[path] = extractHeadingTerms(text);
    }

    return new Bm25Index(indexId, postings, docLengths, headingTerms);
  }

  static fromJSON(state: Bm25State): Bm25Index {
    return new Bm25Index(
      state.index_id,
      state.postings,
      state.doc_lengths,
      state.heading_terms ?? {},
    );
  }

  toJSON(): Bm25State {
    return {
      schema_version: 2,
      index_id: this.indexId,
      postings: this.postings,
      doc_lengths: this.docLengths,
      heading_terms: this.headingTerms,
    };
  }

  documentCount(): number {
    return Object.keys(this.docLengths).length;
  }

  tokenCount(path: string): number {
    return this.docLengths[path] ?? 0;
  }

  score(query: string): Array<{ path: string; score: number }> {
    const queryTerms = [...new Set(tokenize(query))];
    const paths = Object.keys(this.docLengths);
    const N = paths.length;
    if (queryTerms.length === 0 || N === 0) {
      return [];
    }

    const avgdl = paths.reduce((sum, path) => sum + this.docLengths[path]!, 0) / N;

    const dfByTerm = new Map<string, number>();
    for (const term of queryTerms) {
      let df = 0;
      for (const path of paths) {
        if ((this.postings[path]?.[term] ?? 0) > 0) df += 1;
      }
      dfByTerm.set(term, df);
    }

    const results: Array<{ path: string; score: number }> = [];
    for (const path of paths) {
      const docLen = this.docLengths[path]!;
      const headingTerms = this.headingTerms[path] ?? [];
      let score = 0;
      for (const term of queryTerms) {
        const tf = this.postings[path]?.[term] ?? 0;
        if (tf === 0) continue;
        const df = dfByTerm.get(term)!;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + (B * docLen) / avgdl);
        let contribution = (idf * numerator) / denominator;
        if (headingTerms.includes(term)) contribution *= HEADING_WEIGHT;
        score += contribution;
      }
      if (path.startsWith("future_plans/")) score *= FUTURE_PLANS_WEIGHT;
      if (score > 0) {
        results.push({ path, score });
      }
    }

    results.sort(
      (a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0),
    );
    return results;
  }
}
```

- [ ] **Step 5: Update `src/index/io.ts` — tolerate v1|v2, validate optional heading_terms**

In `parseBm25`, replace the version guard and add heading-terms validation:

```ts
  if (raw.schema_version !== 1 && raw.schema_version !== 2) {
    throw new Error(`unsupported bm25 schema_version: ${raw.schema_version}`);
  }
  if (
    typeof raw.index_id !== "string" ||
    !isRecord(raw.postings) ||
    !isRecord(raw.doc_lengths)
  ) {
    throw new Error("invalid bm25");
  }
  if (
    raw.heading_terms !== undefined &&
    (!isRecord(raw.heading_terms) ||
      !Object.values(raw.heading_terms).every(
        (v) => Array.isArray(v) && v.every((s) => typeof s === "string"),
      ))
  ) {
    throw new Error("invalid bm25");
  }
```

- [ ] **Step 6: Update `src/index/sync.ts` — tokenizer_version**

Add a constant and export it; capture the previous manifest; rebuild on mismatch; write the version:

```ts
export const TOKENIZER_VERSION = "1";
```

Replace the manifest-loading block (currently lines 24-33) with:

```ts
  let previousManifest: IndexManifest | null = null;
  let previousDocs: Record<string, IndexDocMeta> = {};
  let loadedValidPair = false;
  if (tryLoadManifest(root)) {
    try {
      previousManifest = loadIndexPair(root).manifest;
      previousDocs = previousManifest.docs;
      loadedValidPair = true;
    } catch {
      // Corrupt or mismatched artifacts are rebuilt from the current corpus.
    }
  }
  const tokenizerChanged = previousManifest?.tokenizer_version !== TOKENIZER_VERSION;
```

Replace the fresh check (currently line 40-42):

```ts
  if (loadedValidPair && !tokenizerChanged && changed.length === 0) {
    return { status: "fresh", indexed: paths.length, changed: [] };
  }
```

Add `tokenizer_version` to the manifest object (near `corpus`):

```ts
    tokenizer_version: TOKENIZER_VERSION,
```

Also update the import to include `IndexManifest`:

```ts
import type { IndexDocMeta, IndexManifest } from "./types.js";
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx tsx --test tests/index-bm25.test.ts tests/index-io.test.ts tests/index-sync.test.ts`
Expected: all PASS.

- [ ] **Step 8: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/index/types.ts src/index/bm25.ts src/index/io.ts src/index/sync.ts tests/index-bm25.test.ts tests/index-io.test.ts tests/index-sync.test.ts
git commit -m "feat: BM25 heading weights, future_plans downweight, schema v2, tokenizer_version"
```

---

### Task 4: Glossary-aware search

**Files:**
- Create: `src/search/glossary.ts`
- Modify: `src/search/search.ts`
- Test: `tests/search-glossary.test.ts` (new), `tests/search-canon.test.ts`

**Interfaces:**
- Consumes: `handle.score(query)` (Task 3), `tokenize` (Task 2), `parseContractMarkdown` (`src/contract/parse.js`), `canonDir`/`contractPath` (`src/paths.js`).
- Produces: `parseGlossary(text): Map<string, GlossaryEntry>` and `loadGlossary(root): Map<string, GlossaryEntry> | null` (fail-open), `expandGlossaryQuery(query, glossary): string`. `searchCanon` expands the query before scoring; snippets still match the original query.

- [ ] **Step 1: Write the failing tests**

Create `tests/search-glossary.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGlossary, expandGlossaryQuery } from "../src/search/glossary.js";

describe("parseGlossary", () => {
  it("extracts terms under ## Terms with body synonyms", () => {
    const text = `# Glossary
## How to use
note
## Terms
### SoT
source of truth
### Pack
A bounded retrieval result.
## Naming conventions
stop`;
    const entries = parseGlossary(text);
    assert.deepEqual([...entries.keys()].sort(), ["Pack", "SoT"].sort());
    const sot = entries.get("SoT")!;
    assert.ok(sot.tokens.includes("sot"));
    assert.ok(sot.tokens.includes("source"));
    assert.ok(sot.tokens.includes("truth"));
  });

  it("stops term collection after leaving ## Terms", () => {
    const text = `## Terms
### T1
body
## Other
### T2
ignored`;
    const entries = parseGlossary(text);
    assert.ok(entries.has("T1"));
    assert.ok(!entries.has("T2"));
  });

  it("supports multi-word terms", () => {
    const text = `## Terms
### searchCanon / search
The public search function.`;
    const entries = parseGlossary(text);
    const entry = entries.get("searchCanon / search")!;
    assert.ok(entry.tokens.includes("search"));
    assert.ok(entry.tokens.includes("searchcanon"));
  });
});

describe("expandGlossaryQuery", () => {
  const glossary = parseGlossary(`## Terms
### SoT
source of truth
`);

  it("appends canonical term tokens for a matching synonym", () => {
    assert.match(expandGlossaryQuery("sot", glossary), /source/);
    assert.match(expandGlossaryQuery("sot", glossary), /truth/);
    assert.match(expandGlossaryQuery("sot", glossary), /sot/);
  });

  it("returns the query unchanged when nothing matches", () => {
    assert.equal(expandGlossaryQuery("zzz", glossary), "zzz");
  });

  it("returns the query unchanged for a null glossary", () => {
    assert.equal(expandGlossaryQuery("sot", null), "sot");
  });
});
```

Append to `tests/search-canon.test.ts`:

```ts
  it("glossary expansion makes SoT find source-of-truth docs", async () => {
    fs.writeFileSync(
      path.join(root, "docs", "canon", "CANON_CONTRACT.md"),
      `# Canon Contract

## Machine contract

\`\`\`yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - { id: glossary, path: GLOSSARY.md, role: glossary, required: true, template: GLOSSARY }
templates:
  - { id: GLOSSARY, path: templates/GLOSSARY.md }
policies:
  max_lines: 400
  ignore: []
\`\`\`
`,
    );
    fs.writeFileSync(
      path.join(root, "docs", "canon", "GLOSSARY.md"),
      `# Glossary
## Terms
### SoT
source of truth
`,
    );
    fs.writeFileSync(
      path.join(root, "docs", "canon", "plain.md"),
      "source of truth retrieval",
    );
    await syncCanonIndex(root);
    const pack = searchCanon(root, "SoT");
    assert.ok(pack.hits.some((h) => h.path.endsWith("plain.md")));
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/search-glossary.test.ts tests/search-canon.test.ts`
Expected: new tests FAIL (`parseGlossary`/`expandGlossaryQuery` not exported / no expansion).

- [ ] **Step 3: Implement `src/search/glossary.ts`**

```ts
// src/search/glossary.ts
import fs from "node:fs";
import path from "node:path";
import { parseContractMarkdown } from "../contract/parse.js";
import { tokenize } from "../index/tokenize.js";
import { canonDir, contractPath } from "../paths.js";

export type GlossaryEntry = { term: string; tokens: string[] };

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const CLOSING_ATX_RE = /\s+#+\s*$/;

export function parseGlossary(text: string): Map<string, GlossaryEntry> {
  const entries = new Map<string, GlossaryEntry>();
  let inTerms = false;
  let currentTerm: string | null = null;
  const bodyTokens: string[] = [];

  const flush = (): void => {
    if (currentTerm !== null) {
      const tokens = [...new Set([...tokenize(currentTerm), ...bodyTokens])];
      entries.set(currentTerm, { term: currentTerm, tokens });
    }
    bodyTokens.length = 0;
  };

  for (const line of text.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (match) {
      const level = match[1]!.length;
      const headingText = match[2]!.trim().replace(CLOSING_ATX_RE, "");
      if (level === 2) {
        flush();
        inTerms = headingText === "Terms";
        currentTerm = null;
      } else if (inTerms && level === 3) {
        flush();
        currentTerm = headingText;
      } else if (inTerms && level < 3) {
        flush();
        inTerms = false;
        currentTerm = null;
      }
    } else if (inTerms && currentTerm !== null && line.trim() !== "") {
      bodyTokens.push(...tokenize(line));
    }
  }
  flush();
  return entries;
}

export function loadGlossary(root: string): Map<string, GlossaryEntry> | null {
  try {
    const markdown = fs.readFileSync(contractPath(root), "utf8");
    const contract = parseContractMarkdown(markdown);
    const glossary = contract.sections.find((section) => section.role === "glossary");
    if (!glossary) return null;
    const glossaryFile = path.resolve(canonDir(root), glossary.path);
    const glossaryRelative = path.relative(canonDir(root), glossaryFile);
    if (
      glossaryRelative === ".." ||
      glossaryRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(glossaryRelative)
    ) {
      return null;
    }
    return parseGlossary(fs.readFileSync(glossaryFile, "utf8"));
  } catch {
    return null;
  }
}

export function expandGlossaryQuery(
  query: string,
  glossary: Map<string, GlossaryEntry> | null,
): string {
  if (!glossary || glossary.size === 0) return query;
  const terms = tokenize(query);
  if (terms.length === 0) return query;
  const extra: string[] = [];
  for (const term of terms) {
    for (const entry of glossary.values()) {
      if (entry.tokens.includes(term)) {
        extra.push(...entry.tokens);
      }
    }
  }
  if (extra.length === 0) return query;
  return `${query} ${extra.join(" ")}`;
}
```

- [ ] **Step 4: Wire expansion into `src/search/search.ts`**

Add imports at the top:

```ts
import { tokenize } from "../index/tokenize.js";
import { expandGlossaryQuery, loadGlossary } from "./glossary.js";
```

In `searchCanon`, replace the scoring line (`const ranked = handle.score(trimmed).slice(0, maxHits);`) with:

```ts
  const glossary = loadGlossary(root);
  const effective = expandGlossaryQuery(trimmed, glossary);
  const ranked = handle.score(effective).slice(0, maxHits);
```

Snippets continue to use `trimmed` (the original query) — do not change the `extractSnippetWindows(content, trimmed, ...)` call.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test tests/search-glossary.test.ts tests/search-canon.test.ts`
Expected: all PASS (existing search-canon tests use a fixture with no contract → `loadGlossary` fails open → unchanged behavior).

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/search/glossary.ts src/search/search.ts tests/search-glossary.test.ts tests/search-canon.test.ts
git commit -m "feat: glossary-aware query expansion in doc search"
```

---

### Task 5: Dogfood rebuild, verification, and canon-audit

**Files:**
- No source changes. Verification only.
- Consumes: Tasks 1–4.

- [ ] **Step 1: Rebuild this repo's own indexes**

Run: `npm run build && doc-canon index && doc-canon validate`
Expected: index rebuilt (full — tokenizer change + `tokenizer_version` bump force it), `validate` exit 0.

- [ ] **Step 2: Verify the failing queries from the spec's Problem section**

Run:
```bash
doc-canon search "indexes" --json
doc-canon search "how documentation indexing works" --json
doc-canon search "SoT" --json
```
Expected: `indexes` now hits docs containing `index` (morphology fixed); the "how documentation indexing works" query no longer ranks `future_plans/p2a-code-ast-index.md` first (liveness downweight); `SoT` expands to `source of truth` (glossary). Confirm the ranking change on the live corpus.

- [ ] **Step 3: Verify Pack shape is unchanged**

Run: `doc-canon search "bm25" --json` and confirm the JSON still has the `{ query, index_id, freshness, warnings, hits }` shape.

- [ ] **Step 4: Run the whole suite once more**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Load and run canon-audit**

Load `.claude/skills/canon-audit/SKILL.md` via the skill tool and follow it to close the slice — confirm living canon matches shipped behavior (stemming, heading weights, liveness, glossary expansion, `schema_version: 2`, `tokenizer_version`), P4/P5 now `absorbed`, P6 draft intact, no new divergences. Commit any canon refinements it produces.

- [ ] **Step 6: Final commit if the audit changed anything**

```bash
git add -A
git commit -m "docs(canon): audit doc-search quality slice (P4 + liveness + P5)"
```
(If the audit produced no changes, skip this step.)
