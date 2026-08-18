# P5 — Glossary-aware search

- **Status:** implementing
- **Focus:** Use `GLOSSARY.md` to boost canonical terms and expand queries with glossary synonyms, improving search recall and term consistency across canon skills.
- **Depends on:** Stable retrieval/search (P1); P4 scoring provides the weighting seams but is not strictly required
- **Unblocks:** Fewer thin/off-target packs for terminology-heavy queries; keeps agents and skills using canonical terms

## Intent

`docs/canon/GLOSSARY.md` is the canon's term registry, and `src/commands/check.ts` already extracts glossary terms (h3 headings under `Terms`) to build `text_hits` in the inventory. Search, however, treats the query as raw tokens with no knowledge of the glossary. A query using a non-canonical form or a canonical term with a long form (`SoT` vs `source of truth`, `docs_stale`) can return weak packs, making the Scout → Expand gate expand unnecessarily. This initiative makes `searchCanon` glossary-aware: boost documents that contain canonical terms and expand the query with glossary synonyms before scoring.

## In scope

- Read glossary terms live from the local `GLOSSARY.md` at search time via the contract's glossary role (reusing the heading extraction already used by `check.ts`); no manifest snapshot (see Decisions)
- Query-side glossary expansion: query terms matching a glossary term or synonym add that entry's full token set to the query term set before BM25 scoring — additive (OR), never dropping original terms
- Canonical-term weight: expanded terms carry natural idf weight at score time — no separate boost multiplier (see Decisions)
- Keep the Pack shape and `searchCanon` options unchanged; glossary-aware behavior is always on and fails open when `GLOSSARY.md` is absent
- Tests: term-synonym expansion (`SoT` → `source of truth`), canonical-term boost ranking, glossary-missing tolerance (fail open to plain search), Pack shape unchanged

## Out of scope

- A general synonym dictionary or NLP-based expansion beyond the local glossary
- Editing `GLOSSARY.md` as part of search; glossary authorship stays with `canon-write` / the user
- Changing glossary extraction in `check.ts` semantics (inventory `text_hits` is untouched by this initiative)
- Embeddings / semantic search

## Absorbs into

Likely: `ARCHITECTURE.md` (retrieval notes), `CLI.md` (`search` behavior), `GLOSSARY.md` (new terms for expansion mechanics). No `policies` knob in v1 — fixed defaults.

## Decisions

Resolved against the doc-search quality scoring slice ([`2026-08-18-doc-search-quality-scoring-design.md`](../../superpowers/specs/2026-08-18-doc-search-quality-scoring-design.md)):

- **Glossary source:** `GLOSSARY.md` is read live at search time via the contract's glossary role (same mechanism as `check.ts`), not snapshotted in the index manifest — deterministic (same file → same result), consistent with live snippet reads, and the corpus is tiny.
- **Extraction:** reuse the heading walk — `## Terms` (level 2) toggles; `### <term>` (level 3) yields the term; synonyms are the tokens of the term heading text plus the definition body tokens. Multi-word canonical terms (`docs_stale`, `source of truth`) supported.
- **Expansion strategy:** for each query term equal to a glossary term or one of its synonyms, add that entry's full token set (canonical term + synonyms) to the query term set. Expansion is additive (OR), never drops original terms.
- **Boost:** no separate boost multiplier — expanded canonical terms carry natural idf weight, so docs containing them outrank others.
- **Policies knob:** none in v1 (fixed defaults, YAGNI); the canon contract can add a knob later if demand appears.
- **P4 interaction:** heading weight and glossary expansion compound multiplicatively — terms in headings of glossary-matching docs get both.
- **Fail-open:** a missing/unparsable `GLOSSARY.md` or no contract glossary role → plain search (current behavior), no warning.

## Open questions

*Resolved by the Decisions above.*

- Where the glossary snapshot lives: read `GLOSSARY.md` live at search time vs. store terms in the index manifest — trade-off between freshness and search performance
- Expansion strategy: single-term synonym mapping vs. multi-word canonical terms (`docs_stale`, `source of truth`); phrase handling in the current tokenizer
- Whether glossary boost needs a `policies` knob or a fixed default
- Interaction with P4 heading weights: do glossary terms in headings compound?
