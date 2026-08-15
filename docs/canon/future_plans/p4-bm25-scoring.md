# P4 — BM25 scoring (stemming + heading weights)

- **Status:** draft
- **Focus:** Raise BM25 recall/precision so agents deep-read fewer files: light EN/RU stemming plus higher weight for tokens that appear in headings, without changing the Pack shape.
- **Depends on:** Stable BM25 index (P0b) and retrieval/search pack (P1)
- **Unblocks:** Cheaper Scout/Expand cycles; cleaner base for glossary-aware search (P5)

## Intent

The current tokenizer (`src/index/tokenize.ts`) lowercases and splits on non-letter/digit only, so morphologically related forms do not match: a query like `indexes` or `reindex` will not hit `index`, and heading context does not influence ranking. `src/index/bm25.ts` scores all tokens uniformly. As a result, search can return thin or off-target packs, forcing the Scout → Expand gate to expand and read more than necessary — a direct token cost. This initiative makes scoring smarter: light stemming for English and Russian plus heading-aware term weighting, keeping the retrieval protocol and Pack shape unchanged.

## In scope

- Lightweight, dependency-free stemmer for English and Russian applied in the tokenizer path so index and query tokenize identically (consistency is required for BM25 matching)
- Heading-aware weighting: tokens occurring in markdown headings (`#`–`###`) score higher than body tokens, either via token prefixing or score weighting in `src/index/bm25.ts`
- Rebuild semantics stay hash-driven: a tokenizer change invalidates `doc_hash` for every doc and triggers a full rebuild; `doc-canon index` needs no new flags
- Artifact compatibility decision: keep `schema_version: 1` for `bm25-index.json` if the state shape is unchanged, or document a schema bump in the manifest pair if not
- `token_count` in the manifest reflects the new tokenization (used by stats/budget initiatives later)
- Tests: tokenizer unit tests (EN/RU stems, multi-word forms), scoring tests that heading hits outrank body-only hits, and a search integration test that the Pack shape is unchanged

## Out of scope

- Changing the Pack shape or `searchCanon` public options/signatures
- Phrase, prefix, or synonym search — query expansion is P5
- Replacing BM25 with embeddings / vector retrieval
- Per-language analyzer configuration or pluggable tokenizers (P2 territory)
- Changing `doc-canon index` / `search` CLI surface

## Absorbs into

Likely: `ARCHITECTURE.md` (retrieval notes), `CLI.md` (`search`/`index` behavior notes), `GLOSSARY.md` (stemmer/tokenizer terms), possibly `CANON_CONTRACT.md` policies if heading weight becomes configurable.

## Open questions

- Stemming quality bar: how aggressive for Russian (suffix stripping vs. full morphological) while staying dependency-free?
- Heading weighting approach: token prefix (`h:index`) vs. per-term score multiplier; fixed weight vs. contract `policies` knob
- Whether the `bm25-index.json` `schema_version` must bump when tokenization semantics change, or whether hash-driven rebuild + matching tokenization is enough
