# P10 — CLI scout: generated working-set manifest

- **Status:** absorbed
- **Focus:** One command that turns a topic query into a ready-made working-set manifest (paths +
  contract role + snippet stubs + a sufficient/need-more verdict hint), replacing the hand-built
  Scout step in the managed skills.
- **Depends on:** P9's structured-output patterns (absorbed in doc-canon 0.9.0).
- **Unblocks:** Uniform Scout discipline across LLMs and harnesses with less ritual chatter in agent
  context.
- **Design (2026-08-21, approved):** Verdict thresholds are hardcoded CLI defaults (`sufficient` when
  >=2 docs hits and top score >= 1.0, else `need_more`); no per-repo config in v1. `scout` owns the
  fail-closed path the same way `search` does (self-heal stale via `refreshStaleIndex`, rebuild and
  retry; on missing/unbuildable index, fail with the standard error + hint). Code-index probe runs
  automatically when a code index exists and covered source is present (`--no-code` opt-out); a
  missing code index is skipped silently (docs-only), not an error. `doc_miss`/`code_miss` notes
  stay with the agent (they concern reading files outside the pack). `need_more` is a valid result,
  not an error.

## Intent

The Scout → Expand protocol in `canon-write`, `canon-audit`, and `canon-bootstrap` asks the agent
to run `doc-canon search`, then assemble a working-set manifest (path, role, stub) by hand and show a
verdict. That is routine the CLI can own: `doc-canon scout "<topic>"` emits the manifest directly —
paths ranked by search, each annotated with its contract role, brief snippet stubs, and a deterministic
verdict hint (`sufficient` / `need more`) based on hit count and top-score thresholds. Agents keep
the semantic Expand decision but stop hand-building the manifest.

## In scope

- `doc-canon scout "<topic>"`: search pack + contract-role annotation + snippet stubs → manifest.
- `--json` manifest shape and a compact human mode; `--max-hits` / `--snippet-lines` reuse.
- Verdict hint as a deterministic heuristic; the agent may still override it at the Expand gate.
- Optional code-index probe for covered-language topics (scout seeds both packs when relevant).

## Out of scope

- Semantic judgements: what counts as "enough" for a given task stays the agent's Expand gate.
- Changing the search engine, ranking, or glossary expansion itself (that is the existing search).
- Writing or deleting canon files.

## Absorbs into

`CLI.md` (new `scout` command), `SKILLS.md` (Scout protocol steps of the three skills),
`ARCHITECTURE.md` (retrieval layer), `GLOSSARY.md` (Working set, Scout).

## Open questions

- Resolved 2026-08-21: verdict thresholds are hardcoded defaults (>=2 hits, top score >= 1.0), not
  per-repo configurable — revisit only if real use demands tuning.
- Resolved 2026-08-21: `scout` does not emit `doc_miss`/`code_miss` notes — those stay with the
  agent's Expand gate; `scout` self-heals stale indexes and fails with the standard error + hint when
  an index is missing/unbuildable.
