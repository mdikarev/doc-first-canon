# P0b — Smart cache for canon/inventory

- **Status:** draft
- **Focus:** Deterministic content hashes so agents/CLI can skip redundant re-scout or re-analysis when inputs are unchanged—without harming answer quality.
- **Depends on:** P0 Scout → Expand → Execute recipe (patterns clear)
- **Unblocks:** Cheaper repeat audits/syncs on large repos; optional building block for P1 packs

## Intent

Avoid redoing expensive inventory/canon reads when nothing relevant changed, using **content hashes** (or equivalent deterministic fingerprints)—not embeddings.

## In scope

- Hashing strategy for inventory and/or canon section files
- Where artifacts live (likely `.doc-canon/`, gitignored) vs recomputed ephemeral checks
- How skills decide “unchanged → skip re-read” while preserving the P0 quality-over-thrift / expand invariant
- Optional tiny CLI helpers if guidance alone is insufficient

## Out of scope

- Scout → Execute recipe itself (P0)
- BM25 / context pack (P1)
- AST extractors (P2)
- Vector / embedding caches

## Absorbs into

Likely: `CLI.md`, `ARCHITECTURE.md`, `SKILLS.md`, possibly glossary terms for cache fingerprints; skill guidance for skip/revalidate.

## Open questions

- Exact artifact schema and invalidation rules (per-file vs whole-inventory)
- Whether cache is advisory for skills only or also speeds `check`
- Interaction with expand gate: never treat “cache hit” as license to skip needed evidence
- Brainstorm and design in a dedicated session before implementation
