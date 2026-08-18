# P4 — BM25 scoring (stemming + heading weights)

- **Status:** absorbed
- **Focus:** Raise BM25 recall/precision so agents deep-read fewer files: light EN/RU stemming plus higher weight for tokens that appear in headings, without changing the Pack shape.
- **Depends on:** Stable BM25 index (P0b) and retrieval/search pack (P1)
- **Unblocks:** Cheaper Scout/Expand cycles; cleaner base for glossary-aware search (P5)

## Intent

The current tokenizer (`src/index/tokenize.ts`) lowercases and splits on non-letter/digit only, so morphologically related forms do not match: a query like `indexes` or `reindex` will not hit `index`, and heading context does not influence ranking. `src/index/bm25.ts` scores all tokens uniformly. As a result, search can return thin or off-target packs, forcing the Scout → Expand gate to expand and read more than necessary — a direct token cost. This initiative makes scoring smarter: light stemming for English and Russian plus heading-aware term weighting, keeping the retrieval protocol and Pack shape unchanged.

## In scope

- Lightweight, dependency-free stemmer for English and Russian applied in the tokenizer path so index and query tokenize identically (consistency is required for BM25 matching)
- Heading-aware weighting: tokens occurring in markdown headings (`#`–`######`) score higher than body tokens, via a per-term score multiplier applied in `src/index/bm25.ts` (see Decisions)
- Rebuild semantics stay hash-driven: a tokenizer change triggers a full rebuild; `tokenizer_version` in the manifest forces it when the constant diverges; `doc-canon index` needs no new flags
- Artifact compatibility: `bm25-index.json` bumps to `schema_version: 2` (shape change: optional `heading_terms`), read tolerantly by the reader (see Decisions)
- `token_count` in the manifest reflects the new tokenization (used by stats/budget initiatives later)
- Tests: tokenizer unit tests (EN/RU stems, multi-word forms), scoring tests that heading hits outrank body-only hits, and a search integration test that the Pack shape is unchanged

## Out of scope

- Changing the Pack shape or `searchCanon` public options/signatures
- Phrase, prefix, or synonym search — query expansion is P5
- Replacing BM25 with embeddings / vector retrieval
- Per-language analyzer configuration or pluggable tokenizers (P2 territory)
- Changing `doc-canon index` / `search` CLI surface

## Absorbs into

Likely: `ARCHITECTURE.md` (retrieval notes), `CLI.md` (`search`/`index` behavior notes), `GLOSSARY.md` (stemmer/tokenizer terms). No `policies` knob in v1 — heading weight stays a fixed default.

## Decisions

Resolved against the doc-search quality scoring slice ([`2026-08-18-doc-search-quality-scoring-design.md`](../../superpowers/specs/2026-08-18-doc-search-quality-scoring-design.md)):

- **Stemming:** a new dependency-free `stem(token)` applies light suffix-strip inside `tokenize` (index and query tokenize identically), so BM25 matching collapses inflectional forms. EN: strip `ing`/`ed`/`ly`/`er`/`est`, `ies→y`, `es`, `s`; RU: strip `ов`/`ев`/`ами`/`ями`/`ом`/`ем`/`ах`/`ях`/`ый`/`ий`/`ой`/`ая`/`яя`/`ое`/`ее`/`ие`/`ые`/`и`/`ы`/`а`/`я`/`о`/`е`/`у`/`ю`. Only tokens longer than 3 chars are stemmed; first matching rule wins, single rule application (no recursive stripping). `reindex` stays out of reach — prefix morphology is not suffix stripping.
- **Heading weighting:** per-term score multiplier `HEADING_WEIGHT = 1.5` when the term is in the doc's heading set, stored as an optional `heading_terms` field in the BM25 state. The token-prefix (`h:index`) approach is rejected — it breaks query→heading matching.
- **Index schema:** `bm25-index.json` bumps to `schema_version: 2`; the reader tolerates a missing `heading_terms` field (treated as no heading terms). The manifest pair stays internally consistent (shared `index_id`, fail-closed on mismatch).
- **Tokenizer versioning:** `tokenizer_version` is added to `index-manifest.json`; a mismatch vs. the current constant forces a full rebuild (mirrors `grammar_versions` for the code index) — `doc_hash` is a content hash and cannot detect a tokenizer change alone.

## Open questions

*Resolved by the Decisions above.*

- Stemming quality bar: how aggressive for Russian (suffix stripping vs. full morphological) while staying dependency-free?
- Heading weighting approach: token prefix (`h:index`) vs. per-term score multiplier; fixed weight vs. contract `policies` knob
- Whether the `bm25-index.json` `schema_version` must bump when tokenization semantics change, or whether hash-driven rebuild + matching tokenization is enough
