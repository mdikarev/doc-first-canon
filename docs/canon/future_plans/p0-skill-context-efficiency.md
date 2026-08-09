# P0 — Skill context efficiency

- **Status:** draft
- **Focus:** Reduce tokens and noise while **canon skills** (`canon-write`, `canon-audit`, later bootstrap/contract) maintain the canon.
- **Depends on:** MVP CLI + skills (current)
- **Unblocks:** Cheaper everyday sync; clearer patterns for coding-agent context later

## Intent

Make canon maintenance cheaper and more reliable without language-specific AST: skills should discover a small working set first, then edit, instead of loading the whole tree and inventing structure.

## In scope

- **Scout → Execute** skill pattern: inventory/INDEX/report first; only then targeted section reads and writes
- Stronger **progressive disclosure** guidance: start at root `INDEX.md`, load only affected sections + templates
- **Smart cache** ideas: content hashes for inventory / canon sections; skip re-analysis when unchanged
- Skill prompt/shape changes and optional small CLI helpers that stay deterministic and language-agnostic

## Out of scope

- Deep AST, dependency graphs, schema extractors (see P2)
- Git-diff–driven context packs
- Embeddings / RAG
- Changing the rule that skills never patch application code

## Absorbs into

Likely: `SKILLS.md`, `ARCHITECTURE.md`, skill bodies under `embedded/skills/`, possibly `CLI.md` if tiny helpers ship.

## Open questions

- Exact Scout outputs (paths only vs summaries)
- Whether cache lives in `.doc-canon/` and is gitignored
- How bootstrap differs from everyday write/audit
