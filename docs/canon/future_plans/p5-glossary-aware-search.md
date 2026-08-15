# P5 — Glossary-aware search

- **Status:** draft
- **Focus:** Use `GLOSSARY.md` to boost canonical terms and expand queries with glossary synonyms, improving search recall and term consistency across canon skills.
- **Depends on:** Stable retrieval/search (P1); P4 scoring provides the weighting seams but is not strictly required
- **Unblocks:** Fewer thin/off-target packs for terminology-heavy queries; keeps agents and skills using canonical terms

## Intent

`docs/canon/GLOSSARY.md` is the canon's term registry, and `src/commands/check.ts` already extracts glossary terms (h3 headings under `Terms`) to build `text_hits` in the inventory. Search, however, treats the query as raw tokens with no knowledge of the glossary. A query using a non-canonical form or a canonical term with a long form (`SoT` vs `source of truth`, `docs_stale`) can return weak packs, making the Scout → Expand gate expand unnecessarily. This initiative makes `searchCanon` glossary-aware: boost documents that contain canonical terms and expand the query with glossary synonyms before scoring.

## In scope

- Read glossary terms at index/search time from the local `GLOSSARY.md` (reusing the heading extraction already used by `check.ts`), or record a glossary snapshot in the index manifest
- Query-side glossary expansion: map query tokens/terms to canonical terms and their synonyms before BM25 scoring
- Score-side boost: prefer documents whose text contains canonical glossary terms for matching queries
- Keep the Pack shape unchanged; extend `searchCanon` options (e.g., glossary toggle) only if needed and defaulting on
- Tests: term-synonym expansion (`SoT` → `source of truth`), canonical-term boost ranking, glossary-missing tolerance (fail open to plain search), Pack shape unchanged

## Out of scope

- A general synonym dictionary or NLP-based expansion beyond the local glossary
- Editing `GLOSSARY.md` as part of search; glossary authorship stays with `canon-write` / the user
- Changing glossary extraction in `check.ts` semantics (inventory `text_hits` is untouched by this initiative)
- Embeddings / semantic search

## Absorbs into

Likely: `ARCHITECTURE.md` (retrieval notes), `CLI.md` (`search` behavior), `SKILLS.md` (Scout protocol note on glossary-aware queries), `GLOSSARY.md` (new terms for expansion mechanics), acceptance skill scenarios.

## Open questions

- Where the glossary snapshot lives: read `GLOSSARY.md` live at search time vs. store terms in the index manifest — trade-off between freshness and search performance
- Expansion strategy: single-term synonym mapping vs. multi-word canonical terms (`docs_stale`, `source of truth`); phrase handling in the current tokenizer
- Whether glossary boost needs a `policies` knob or a fixed default
- Interaction with P4 heading weights: do glossary terms in headings compound?
