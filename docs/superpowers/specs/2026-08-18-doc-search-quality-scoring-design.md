# Doc-search quality — scoring slice (P4 + liveness + P5) — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Scope:** Improve `doc-canon search` ranking so agents deep-read fewer files: light EN/RU stemming, heading-aware term weighting, downweight `future_plans/**`, and glossary-aware query expansion + canonical-term boost. A companion `future_plans` initiative is added for the deferred Block B (member-access resolution in `code-index --refs`).
**Approach:** Apply stemming inside `tokenize` (index and query tokenize identically), store per-doc heading-term sets in the BM25 state and multiply heading-term score contributions by 1.5, multiply final scores for `future_plans/**` paths by 0.5, and expand/boost query terms against a live-read glossary. Pack shape and `searchCanon` signatures unchanged; deterministic and hash-rebuild-driven throughout; no new dependencies.

This spec is the SoT for the doc-search quality slice. It implements future_plans initiatives **P4** (BM25 scoring: stemming + heading weights) and **P5** (glossary-aware search), plus the liveness weighting proposed at brainstorming. It also records the new Block B initiative (code-index member-access resolution). Where this spec disagrees with the initiatives, this spec wins.

## Problem

Tests of the shipped `doc-canon search` (BM25, `src/index/bm25.ts`) show ranking gaps that force Scout → Expand gates to over-read:

1. **Morphology misses:** `tokenize` (`src/index/tokenize.ts`) only lowercases and splits on non-letter/digit. `indexes` / `indexed` / `indexing` / Russian `индекса`/`индексу` do not match `index`, because stems differ. P4 documents this. (Note: `reindex` is derivational — a prefix, not a suffix — and stays out of reach of v1 light stemming; only inflectional forms collapse.)
2. **Flat ranking for common terms:** query `index` returns near-uniform scores (0.80–0.81) across top docs — heading context does not influence ranking.
3. **`future_plans/**` dominates:** conceptual queries rank `future_plans/*.md` (directional material) above living canon (`OVERVIEW`/`CLI`/`GLOSSARY`/`ARCHITECTURE`). E.g. `how documentation indexing works` returned `p2a-code-ast-index.md` first, code-side docs outranking the docs that actually answer.
4. **Terminology blind spot:** non-canonical forms (`SoT` vs `source of truth`) return weak packs because search has no glossary knowledge.

## Goals

1. Light, dependency-free EN/RU stemming applied in the tokenizer path so index and query tokenize identically (`indexes`/`indexed`/`indexing`/`индекса` → `index`).
2. Heading-aware weighting: tokens occurring in markdown headings (`#`–`######`) score 1.5× body tokens.
3. Downweight `docs/canon/future_plans/**` by 0.5 so living canon outranks directional plans for conceptual queries.
4. Glossary-aware search: expand query terms with glossary synonyms and let canonical terms carry natural idf weight; fail open when `GLOSSARY.md` is absent.
5. Add the future_plans initiative for Block B (code-index member-access resolution).
6. Preserve: Pack shape, `searchCanon` public options (except documented additions defaulting on), determinism, hash-driven rebuild, no new dependencies.

## Non-goals

- Changing Pack shape or `searchCanon` signatures.
- Phrase, prefix, or synonym search beyond glossary expansion (no general synonym dictionary / NLP).
- Embeddings / vector retrieval (explicitly excluded by P2b non-goals; breaks determinism).
- Per-language analyzer config or pluggable tokenizers.
- Changing `doc-canon index` / `search` CLI surface (no new flags; `tokenizer_version` is internal).
- Editing `GLOSSARY.md` from search; authorship stays with canon-write.
- Block B implementation — only its initiative doc is added here.
- Code-index member-access resolution (Block B) implementation.

## Decisions

| Topic | Choice |
| --- | --- |
| Stemming | New `src/index/stem.ts`, `stem(token): string`, light suffix-strip, dependency-free. EN: strip `ing/ed/ly/er/est/ies→y/es/s`; RU: strip `ов/ев/ами/ями/ом/ем/ах/ях/ый/ий/ой/ая/яя/ое/ее/ие/ые/и/а/я/о/е/у/ю`. Only stems tokens longer than 3 chars. Applied inside `tokenize` (index and query identical). |
| Tokenizer versioning | Add `tokenizer_version` to `index-manifest.json`; mismatch vs current constant forces a full rebuild (mirrors `grammar_bumped` for the code index). `doc_hash` is a content hash and cannot detect a tokenizer change alone. |
| Heading weighting | Store per-doc `headingTerms` in `Bm25State` (optional field); at score time multiply the per-term contribution by `HEADING_WEIGHT = 1.5` when the term is in the doc's heading set. Rejected token-prefix (`h:index`) approach — it breaks query→heading matching. |
| Liveness | In `score()`, multiply the final per-doc score by `FUTURE_PLANS_WEIGHT = 0.5` when the path starts with `future_plans/`. Fixed constant, no schema change, no policies knob. |
| Glossary source | Live-read `GLOSSARY.md` at search time via the contract's glossary role (same mechanism as `check.ts`), not a snapshot in the manifest. Deterministic (same file → same result), consistent with live snippet reads, corpus is tiny. |
| Glossary extraction | Reuse the heading walk: `## Terms` (level 2) toggles; `### <term>` (level 3) yields the term; synonyms are the tokens of the term heading text plus the definition body tokens. Multi-word canonical terms (`docs_stale`, `source of truth`) supported. |
| Query expansion | For each query term, if it equals a glossary term or one of its synonyms, add that entry's full token set (canonical term tokens + synonym tokens) to the query term set before scoring. Expansion is additive (OR), never drops original terms. |
| Glossary boost | No separate boost multiplier — expanded canonical terms carry natural idf weight; docs containing them outrank others. Heading weight and glossary expansion compound multiplicatively (terms in headings of glossary-matching docs get both). |
| Policies knob | None in v1 — fixed defaults (YAGNI); the canon contract can add a knob later if demand appears. |
| bm25-index schema | `schema_version: 2` for `bm25-index.json` (shape changes: new optional `heading_terms` field). Reader (`fromJSON`) tolerant of the missing field (treats it as no heading terms). Manifest pair stays internally consistent (shared `index_id`, fail-closed on mismatch). |
| Search options | `searchCanon` options unchanged; glossary-aware behavior is always on (no toggle) and fail-open when `GLOSSARY.md` is absent. |
| Block B initiative | New future_plans initiative: member-access resolution in `code-index --refs` — resolve `obj.method()` call sites where `obj` is a local binding initialized from `new ImportedName(...)`, syntactically, within P2a's cheap-references tier. Draft. |

## Architecture

```text
tokenize(text)  (src/index/tokenize.ts)
   └─ NEW: stem(token) per token (EN/RU suffix-strip, len>3 guard)
        │  — used identically at index build and query time
        ▼
Bm25Index.build(docs, indexId)          (src/index/bm25.ts)
   ├─ postings[path][term] = tf         (stemmed tokens)
   ├─ docLengths[path]                  (stemmed count)
   └─ NEW: headingTerms[path] = tokens of lines starting with '#'..'######'
        │
        ▼
bm25-index.json  schema_version 2  (optional heading_terms)   (src/index/io.ts)
index-manifest.json  + NEW tokenizer_version                    (src/index/sync.ts)
        │
        ▼
searchCanon(root, query)                (src/search/search.ts)
   ├─ NEW: loadGlossary(root) → terms+synonyms                 (src/search/glossary.ts)
   ├─ expand query terms (synonyms → canonical tokens)
   ├─ handle.score(expandedQuery):
   │     term contribution × 1.5 if term ∈ headingTerms[doc]
   │     final score × 0.5 if path starts with future_plans/
   └─ bounded pack (shape unchanged)
```

**Invariants**

- Deterministic: identical corpus + index + query → identical bytes. Stemming, heading sets, liveness, and glossary reads are pure over deterministic inputs.
- Index and query tokenize identically (stemming is inside `tokenize`).
- Rebuild semantics hash-driven: file hash changes trigger rebuild; a `tokenizer_version` mismatch also triggers a full rebuild.
- Pack shape, `searchCanon` options/signature, CLI surface unchanged.
- No new runtime dependencies.

## Components

| Module | Change |
| --- | --- |
| `src/index/stem.ts` (new) | `stem(token): string` — EN/RU light suffix-strip, length guard |
| `src/index/tokenize.ts` | Apply `stem` to each token before return |
| `src/index/bm25.ts` | `build` computes `headingTerms`; `Bm25State` gains optional `heading_terms`; `score` applies `HEADING_WEIGHT` and `FUTURE_PLANS_WEIGHT`; `fromJSON`/`toJSON` handle the new field |
| `src/index/types.ts` | `Bm25State` shape; `IndexManifest` gains `tokenizer_version` |
| `src/index/sync.ts` | Rebuild when `tokenizer_version` diverges; write `tokenizer_version` |
| `src/index/io.ts` | Tolerant parse of missing `heading_terms`; `schema_version` 2 |
| `src/search/glossary.ts` (new) | `loadGlossary(root)` — contract-role read, `## Terms`/`### term` walk, term+synonym map |
| `src/search/search.ts` | Glossary expansion before `score`; pass expanded query; fail open on glossary absence |

No change: `src/index/list.ts`, `src/index/paths.ts`, `src/index/pid-lock.ts`, `src/index/hash.ts`, `src/index/watch.ts`, the code index, `doc-canon code-index search`.

### Stemming rules (v1, deterministic, ordered)

- Apply only to tokens with length > 3 after lowercase.
- EN: if ends `ies` → `y`; else strip one of `ing`, `ed`, `ly`, `er`, `est`, `es`, `s` when the result length ≥ 4.
- RU: strip one of the endings `ами`, `ями`, `ов`, `ев`, `ом`, `ем`, `ах`, `ях`, `ый`, `ий`, `ой`, `ая`, `яя`, `ое`, `ее`, `ие`, `ые`, `и`, `а`, `я`, `о`, `е`, `у`, `ю` when the result length ≥ 3.
- First matching rule wins; single rule application (no recursive stripping).

### Glossary expansion (v1)

- Term → synonyms: term = `###` heading text (may contain spaces and `/`, e.g. `searchCanon / search`); synonyms = tokens of the term text plus tokens of the definition paragraph under it.
- Expansion: query term `t` → if `t` matches any synonym or equals a term, add the term's tokens to the query set. Multi-token canonical terms contribute all their tokens.
- Fail-open: missing/unparsable `GLOSSARY.md` or no contract glossary role → plain search (current behavior).

## Data flow & CLI

### `searchCanon(root, query, opts)` additions

1. Load glossary (live read). If present and query terms match synonyms/terms, build the expanded query-term set (original terms ∪ entry tokens: canonical term + synonyms).
2. `handle.score(expandedQuery)` as today, with the two score modifications inside `score`.
3. Snippet extraction, caps, freshness, warnings — unchanged.

### `score(query)` additions

- Per-term: `contribution = base * (term in headingTerms[path] ? HEADING_WEIGHT : 1)`.
- Per-doc: `total *= path.startsWith("future_plans/") ? FUTURE_PLANS_WEIGHT : 1`.
- Ordering unchanged: `score desc, path asc`; ties preserve determinism.

### CLI surface

No new flags. `doc-canon index` and `doc-canon search` behave identically; only results change.

## Error handling

| Situation | Behavior |
| --- | --- |
| `GLOSSARY.md` missing / no glossary role in contract | Fail open — plain search (current behavior), no warning |
| Glossary term with no synonyms | No expansion for that term; term itself still searchable |
| Stale/old `bm25-index.json` (schema v1, no `heading_terms`) | `fromJSON` tolerant: treated as empty heading sets; pack still emitted (freshness/stale logic unchanged) |
| `tokenizer_version` mismatch at index build | Full rebuild (status `updated`), no error |
| Query with no glossary-matched terms | Plain BM25 scoring with stemming + weights (P4-only path) |

## Testing

**Unit:** `stem` — EN (`index/indexes/indexed/indexing` → same stem; `process` → `process` not over-stripped), RU (`индекса/индексу/индексом` → `индекс`), length guard (short tokens unchanged), determinism. `tokenize` round-trip equality of index vs query strings.

**Scoring:** heading hit outranks body-only hit for equal otherwise (fixture: doc A term in `##` heading, doc B term only in body → A first). Liveness: two docs with equal term frequency, one under `future_plans/` → the living one ranks first. Expansion: `SoT` query returns docs containing `source of truth`; `searchCanon / search` multi-word term expands.

**Integration:** `tokenizer_version` bump forces rebuild (mirror the code-index `grammar_versions` test). Pack shape byte-identical except intended score changes — determinism test (`JSON.stringify` of two runs equal) still passes. Glossary missing → identical to current plain search output.

**Regression:** all existing `tests/index-*.test.ts`, `tests/search-*.test.ts`, `tests/check.test.ts` pass. `doc-canon validate` passes after canon updates.

**Out of scope:** Block B implementation, embeddings, CLI changes, synonym dictionaries.

## Performance

Stemming adds a per-token string suffix check — negligible (already O(len)). Heading-set build is one extra pass over doc lines at index time. Glossary read is one small file read per search (same cost class as live snippet reads, already accepted). No new secondary structures.

## Implementation order (after plan)

1. Canon-first: `canon-write` — GLOSSARY (stemmer/tokenizer/heading-weight/liveness/glossary-expansion terms), CLI.md (search behavior note), ARCHITECTURE.md (retrieval notes: stemming, heading weights, liveness, glossary, `tokenizer_version`, `schema_version` 2); via `canon-future-plan`: P4 and P5 → **implementing** (resolving their open questions per this spec), and add the new Block B initiative (member-access resolution) as draft. Wait for explicit go-ahead after these canon changes.
2. Implement: `stem.ts` + `tokenize` → `bm25.ts` (heading terms, weights, liveness) + `types`/`sync`/`io` (schema v2, `tokenizer_version`) → `glossary.ts` + `search.ts` (expansion) — TDD.
3. Rebuild this repo's index; verify ranking improvements on the exact failing queries from the Problem section.
4. Absorb P4/P5 into living canon; `canon-audit` to close.

## Relationship to prior artifacts

| Artifact | Role |
| --- | --- |
| `docs/canon/future_plans/p4-bm25-scoring.md` | Implemented by this slice; open questions resolved per Decisions |
| `docs/canon/future_plans/p5-glossary-aware-search.md` | Implemented by this slice; open questions resolved per Decisions |
| `docs/canon/future_plans/p2b-code-search-tools.md` | Non-goal source: no embeddings, no vector retrieval |
| `2026-08-12-p1-retrieval-and-context-pack-design.md` | Pack shape and `searchCanon` contract preserved unchanged |
| `2026-08-18-code-index-quality-refs-search-design.md` | Prior slice; Block B (member-access) is its documented next step, now captured as a future_plans initiative |
| `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` | Living absorption targets (updated at canon-first) |

## Open questions

None blocking. Deferred:

- Whether HEADING_WEIGHT / FUTURE_PLANS_WEIGHT become contract `policies` knobs later — v1 fixed defaults.
- RU stemming aggressiveness beyond v1 suffix-strip (full morphology) — only if recall data demands it.

## Related

- [`docs/canon/future_plans/p4-bm25-scoring.md`](../../canon/future_plans/p4-bm25-scoring.md)
- [`docs/canon/future_plans/p5-glossary-aware-search.md`](../../canon/future_plans/p5-glossary-aware-search.md)
- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- Living absorption targets: `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`
