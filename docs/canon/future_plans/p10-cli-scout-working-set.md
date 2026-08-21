# P10 — CLI scout: generated working-set manifest

- **Status:** draft
- **Focus:** One command that turns a topic query into a ready-made working-set manifest (paths +
  contract role + snippet stubs + a sufficient/need-more verdict hint), replacing the hand-built
  Scout step in the managed skills.
- **Depends on:** P9's structured-output patterns where convenient (optional).
- **Unblocks:** Uniform Scout discipline across LLMs and harnesses with less ritual chatter in agent
  context.

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

- Verdict thresholds (hit count, score floor) and whether they should be per-repo configurable.
- Whether scout should also emit `doc_miss` / `code_miss` notes on fail-closed fallback.
