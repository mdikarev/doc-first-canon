# P7 — Strict search discipline

- **Status:** absorbed
- **Design:** [`docs/superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md`](../../superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md) — SoT for the enforcement mechanics: CLI-layer auto-reindex, probe log + `discipline` gate, and the mandatory search-first gate with machine-parseable miss notes
- **Focus:** Make the search-first reading rule structurally enforced rather than guidance-only — self-healing freshness, observable probes, and a hard skill gate.
- **Depends on:** P0b (BM25 index), P1 (search + pack), P2a/P2b (code AST index + code search), P2c (code-index-first rules)
- **Unblocks:** Guaranteed token savings from the index route; CI-gateable probe discipline; measurement data for context-cost tracking

## Intent

The index and search tools only pay for themselves if agents actually use them — and guidance alone leaks
(observed: whole-file reads with the rule in context, silently stale index, suppressible warnings). This
initiative reverses P1's "no auto-reindex inside `search`" at the CLI layer, adds a probe log plus a
`discipline` command/findings that make skipped probes observable and CI-gateable, and hardens the
search-first rule into a mandatory gate (search when an index is available; fallback only when building
failed; every read outside a pack carries a machine-parseable `code_miss` / `doc_miss`). Quality over thrift
is preserved: the expand valve and legal deep reads stay unchanged.

## In scope

- CLI-layer auto-reindex on stale for `search` / `code-index search` (rebuild then serve; `auto_reindexed` warning; watch-owned indexes stay warn + serve; missing index stays fail-closed)
- `.doc-canon/probe-log.jsonl` (one line per successful CLI search; trimmed to the last 1000 lines)
- `doc-canon discipline` command (probe-currency report, `--json`, exit ≠0 on un-probed state) and `kind: "discipline"` findings merged into `check`
- Mandatory search-first gate in canon skills + pointer rule / `AGENTS.md` / `CLAUDE.md`; machine-parseable `code_miss` / new `doc_miss`
- Tests: probe log, auto-reindex branches, discipline exit gate, embedded-assets phrase locks, token-cost guard stays green

## Out of scope

- Blocking enforcement (Claude Code `PreToolUse` hooks / MCP file-read mediation) — follow-up initiative
- Changing the public sync APIs `searchCanon` / `searchCodeIndex` (auto-reindex lives in the CLI layer only)
- Auto-building a missing index (missing stays fail-closed)
- Incremental per-doc BM25 updates (v1 rebuilds the whole index on stale)
- Feeding miss notes into CLI artifacts (v1: strict format only)

## Absorbs into

`CLI.md` (`search` / `code-index search` invariants, `discipline` command), `GLOSSARY.md` (`index_stale` / `code_index_stale` redefined, probe log / discipline finding / `doc_miss` terms), `SKILLS.md` (mandatory-gate recipe, Scout protocol, pointer rule), `ARCHITECTURE.md` (retrieval path). Reverses the P1 absorbed note (no-auto-reindex) in `future_plans/INDEX.md`.

## Open questions

- Probe-log trim bound (default 1000 lines) and which command owns trimming (default: `discipline` trims, idempotent) — resolved in design
- Symmetric doc/code exit-gate in `discipline` (default: symmetric) — resolved in design
- Whether adopter CI examples include `doc-canon discipline` (default: optional gate, not part of the recommended `validate` CI block) — resolved in design
