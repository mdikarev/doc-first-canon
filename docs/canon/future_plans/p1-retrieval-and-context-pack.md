# P1 — Retrieval & context pack

- **Status:** draft
- **Focus:** Deterministic ways to **select** canon (and later related) context for skills without dumping entire docs.
- **Depends on:** P0 patterns (progressive disclosure / Scout) ideally in place or designed
- **Unblocks:** Scale to larger canons; shared pack for coding agents later

## Intent

Add retrieval and packaging so agents request “what matters for X” instead of reading every markdown file.

## In scope

- Local **keyword / BM25-style** search over `docs/canon/` (CLI, no LLM)
- Optional **`doc-canon context`** (or equivalent) that emits a bounded pack from INDEX + query / section ids
- Contract/policy knobs for pack size (align with `policies.max_lines` spirit)

## Out of scope

- **Git diff analyzer** (explicitly deferred; revisit later if needed)
- Vector embeddings / hosted RAG as the first search engine
- Pluggable AST extractors (P2)
- Delta/patch as the primary doc-edit format

## Absorbs into

Likely: `CLI.md`, `ARCHITECTURE.md`, `SKILLS.md`, possibly glossary terms for pack/search.

## Open questions

- Search corpus: canon only vs canon + selected import sources
- Pack format (concat markdown vs manifest of paths)
- How skills must call search/context before Execute
