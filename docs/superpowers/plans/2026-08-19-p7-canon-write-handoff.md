# P7 — Canon-write handoff (exact edits)

**Date:** 2026-08-19
**Purpose:** Exact replacement text for the `docs/canon/**` updates of [P7 — Strict search discipline](../../superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md). Apply via `canon-write`, then `doc-canon validate` (and create the new initiative file + INDEX row via `canon-future-plan`). This file is a transient handoff — delete it after application.

---

## 1. `docs/canon/CLI.md`

### 1a. Scope / Covers (line 9)

**Replace** the command list opener and the two "without auto-reindexing" clauses:

> **Covers:** commands `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, `code-index`; …

**With:**

> **Covers:** commands `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, `discipline`, `code-index`; …

**Replace** the doc-search clause:

> …search that index and return a bounded context pack without auto-reindexing; build/update a deterministic AST index …

**With:**

> …search that index and return a bounded context pack, self-healing a stale index at the CLI layer (rebuild then serve) and recording every successful search in `.doc-canon/probe-log.jsonl`; report probe discipline via `discipline`; build/update a deterministic AST index …

**Replace** the code-search clause:

> …search that code index (`code-index search`) and return a bounded code pack without auto-reindexing.

**With:**

> …search that code index (`code-index search`) and return a bounded code pack with the same self-healing and probe logging.

### 1b. Interfaces table — new `discipline` row (after the `report` row, line 39)

> | `discipline` | Read `.doc-canon/probe-log.jsonl` (last doc/code probe age, probe count) plus the index manifests (files changed since each probe) and print a probe-discipline report: human table on stdout, `--json` for machine use; exit ≠0 when an index exists and relevant files changed after the last probe of that kind (un-probed state); missing index or never-probed fresh clone → not-applicable, exit 0; `--root` |

### 1c. Command flags table — new `discipline` row (after `report` row, line 58)

> | `discipline` | `--root <path>` (default `.`), `--json` |

### 1d. Artifacts list (line 64)

**Replace:**

> Artifacts: `.doc-canon/inventory.json`, `.doc-canon/report.json`, `.doc-canon/index-manifest.json`, `.doc-canon/bm25-index.json`, `.doc-canon/code-index-manifest.json`, `.doc-canon/code-ast-index.json` (may be gitignored in target repos).

**With:**

> Artifacts: `.doc-canon/inventory.json`, `.doc-canon/report.json`, `.doc-canon/index-manifest.json`, `.doc-canon/bm25-index.json`, `.doc-canon/code-index-manifest.json`, `.doc-canon/code-ast-index.json`, `.doc-canon/probe-log.jsonl` (may be gitignored in target repos).

### 1e. `search` invariant (line 66)

**Replace:**

> `search` fails with exit ≠0 for an empty or whitespace-only query and for a missing or corrupt index; index failures include a hint to run `doc-canon index`. A stale index is served with exit 0 and an `index_stale` signal: human mode prints a warning on stderr; `--json` includes `warnings` (and `freshness`) in the Pack on stdout with no stderr warning. Zero hits also exit 0. `search` never auto-reindexes. Ranking internally applies stemming, heading weights, the `future_plans/**` downweight, and glossary expansion (fail-open when `GLOSSARY.md` is absent) — no flags or output-shape changes.

**With:**

> `search` fails with exit ≠0 for an empty or whitespace-only query and for a missing or corrupt index; index failures include a hint to run `doc-canon index`. A stale index is **self-healed at the CLI layer when no watch owns it**: the command rebuilds the index, re-runs the search, and serves a fresh pack with `warnings: ["auto_reindexed"]` in `--json` (human mode: `auto_reindexed` warning on stderr). If a live watch holds the index lock, the stale index is served with exit 0 and an `index_stale` signal instead: human mode prints a warning on stderr; `--json` includes `warnings` (and `freshness`) in the Pack on stdout with no stderr warning. Zero hits also exit 0. Every successful search appends one line to the probe log; searches never mutate the index while a watch is running. Ranking internally applies stemming, heading weights, the `future_plans/**` downweight, and glossary expansion (fail-open when `GLOSSARY.md` is absent) — no flags or output-shape changes.

### 1f. `code-index search` invariant (line 68)

**Replace:**

> `code-index search` fails with exit ≠0 for an empty query, an empty `--refs` name, a missing/corrupt code index (hint to run `doc-canon code-index build`), invalid flags, `--refs` combined with a positional query / `--kind` / `--file`, and `--body` combined with `--refs`. A stale code index is served with exit 0 and a `code_index_stale` warning (human mode on stderr; `--json` carries `warnings` + `freshness`). Zero hits exit 0. `code-index search` never auto-reindexes.

**With:**

> `code-index search` fails with exit ≠0 for an empty query, an empty `--refs` name, a missing/corrupt code index (hint to run `doc-canon code-index build`), invalid flags, `--refs` combined with a positional query / `--kind` / `--file`, and `--body` combined with `--refs`. A stale code index is **self-healed at the CLI layer when no watch owns it**: the command rebuilds the code index, re-runs the search, and serves a fresh pack with `warnings: ["auto_reindexed"]` (`--json`; `auto_reindexed` warning on stderr in human mode). If a live watch holds the code-index lock, the stale index is served with exit 0 and a `code_index_stale` warning (human mode on stderr; `--json` carries `warnings` + `freshness`). Zero hits exit 0. Every successful search appends one line to the probe log.

### 1g. Usage guide closing (line 94)

**Replace:**

> Each hit carries a bounded snippet window from the live source file. A missing/corrupt index fails closed with a hint to run `doc-canon code-index build`; a stale index serves the pack with a `code_index_stale` warning; zero hits exit 0. `code-index search` never auto-reindexes — agents follow code-index-first, and on empty/thin packs read source as evidence and note `code_miss`.

**With:**

> Each hit carries a bounded snippet window from the live source file. A missing/corrupt index fails closed with a hint to run `doc-canon code-index build`; a stale index is self-healed at the CLI layer when no watch owns it (rebuild then serve, `auto_reindexed` warning), otherwise serves the pack with a `code_index_stale` warning; zero hits exit 0. Agents follow the mandatory code-index-first gate: `code-index search` before whole-file source reads, and on empty/thin packs read source as evidence and note `code_miss: <query> -> source:<path>`.

### 1h. Current state (line 15)

**Replace:**

> Commands: `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, plus the `code-index` subcommands …

**With:**

> Commands: `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, `discipline`, plus the `code-index` subcommands …

---

## 2. `docs/canon/GLOSSARY.md`

### 2a. `index_stale` (lines 105–106)

**Replace:**

> A non-fatal search warning that one or more indexed document hashes differ from the live canon corpus. Search serves the Pack with exit 0, surfaces the warning, and does not auto-reindex.

**With:**

> A non-fatal freshness signal that one or more indexed document hashes differ from the live canon corpus. `doc-canon search` self-heals at the CLI layer when no watch owns the index: it rebuilds, re-runs, and serves a fresh Pack with an `auto_reindexed` warning; with a live watch the stale Pack is served with the `index_stale` warning. A missing index fails closed.

### 2b. `code_index_stale` (lines 126–127)

**Replace:**

> A non-fatal freshness signal for the code AST index: one or more indexed source hashes differ from the live tree. Reported independently of the canon `index_stale`.

**With:**

> A non-fatal freshness signal for the code AST index: one or more indexed source hashes differ from the live tree. `code-index search` self-heals at the CLI layer when no watch owns the index (rebuild then serve, `auto_reindexed` warning); with a live watch the stale pack is served with `code_index_stale`. Reported independently of the canon `index_stale`.

### 2c. `code_miss` (lines 132–133)

**Replace:**

> An agent-facing miss report when a code-index probe returns nothing or a thin set: the agent reads source as evidence and notes `code_miss: <query> -> source:<path>`, mirroring the canon's visible Expand gate. Code-index-first analysis applies to the five covered languages (TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages go straight to source.

**With:**

> A machine-parseable miss report (strict format `code_miss: <query> -> source:<path>`) required when a whole-file source read happens outside a search pack — the probe returned nothing or a thin set, or the index is unavailable. The agent reads source as evidence and notes the miss, mirroring the canon's visible Expand gate. Code-index-first analysis is mandatory for the five covered languages (TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages go straight to source without a probe.

### 2d. New terms (insert after `searchCanon / search`, line 100)

> ### Probe log
> `.doc-canon/probe-log.jsonl`: an append-only record of successful CLI searches (`doc-canon search` / `code-index search`), one JSON line per call — timestamp, kind (`doc` / `code`), query, mode (code only: `symbols` / `refs`), hit count, freshness, and whether the command auto-reindexed. The observability basis for the strict search-first gate: `doc-canon discipline` and `check` read it (trimmed to the last 1000 lines) to report probe currency.
>
> ### Discipline finding
> A `kind: "discipline"` finding in `.doc-canon/report.json` (merged via the CLI finding merge) summarizing probe currency: age of the last doc/code probe and how many docs or source files changed after it. Informational in `check`; the `doc-canon discipline` command turns the same state into an exit-gate (exit ≠0 on un-probed state).
>
> ### doc_miss
> The documentation-side miss note, mirror of `code_miss`: `doc_miss: <query> -> docs:<path>`, required when a deep read of `docs/canon/**` happens outside a search pack (index unavailable or thin result).

---

## 3. `docs/canon/SKILLS.md`

### 3a. Shared recipe (line 17)

**Replace:**

> Agents that use the canon follow a shared dual-audience recipe: try `doc-canon search` → Scout a working-set manifest → Expand gate (`sufficient` / `need more`) → Execute with targeted deep reads. Search failure falls back to progressive disclosure from `INDEX.md`.

**With:**

> Agents that use the canon follow a shared dual-audience recipe: **search first — mandatory when the index is available** — `doc-canon search "<topic>"` → Scout a working-set manifest → Expand gate (`sufficient` / `need more`) → Execute with targeted deep reads. A missing index is built first (`doc-canon index`; `code-index build` when covered source exists); only if building fails does the flow fall back to progressive disclosure from `INDEX.md`, with every deep read outside a pack noted (`doc_miss: <query> -> docs:<path>` / `code_miss: <query> -> source:<path>`).

### 3b. Pointer rule / `AGENTS.md` / `CLAUDE.md` (line 33)

**Replace:**

> always-on context priority — try canon search first, then fall back to `docs/canon/INDEX.md` when search fails closed; build a small working set and expand if unsure before deep reads (no mandatory chat ritual);

**With:**

> always-on context priority — search first, **mandatory when the index is available** (`doc-canon search`; `doc-canon code-index search` for covered languages); fall back to `docs/canon/INDEX.md` only when the index is missing and building failed, noting every read outside a pack (`doc_miss` / `code_miss`); build a small working set and expand if unsure before deep reads (no mandatory chat ritual);

### 3c. Scout retrieval protocol (lines 37–39)

**Replace:**

> 1. Scout always tries `doc-canon search "<topic>"` first and builds the working-set stub from the returned pack paths and snippets.
> 2. If search fails closed because the index is missing or corrupt, surface an explicit hint to run `doc-canon index`, then continue with INDEX-first Scout. Do not hard-stop the skill.
> 3. If search returns `index_stale`, surface the warning, continue using the pack, and Expand when the evidence is thin.

**With:**

> 1. Scout always runs `doc-canon search "<topic>"` first (and `doc-canon code-index search` when covered source is in scope) and builds the working-set stub from the returned pack paths and snippets.
> 2. If search fails closed because the index is missing or corrupt, run `doc-canon index` (and `code-index build` when covered source exists), then re-run the search. Only if building fails do we continue with INDEX-first Scout, recording `doc_miss: <query> -> docs:<path>` for every file read outside the pack. Search failure alone never licenses INDEX-first fallback.
> 3. If search returns `index_stale`, note that the CLI self-heals when no watch owns the index; with a live watch, surface the warning, continue using the pack, and Expand when the evidence is thin.

### 3d. Post-write index note (line 42)

**Replace:**

> After any successful substantive write to `docs/canon/**`, the responsible managed skill runs one-shot `doc-canon index`. If a running watch holds the index lock, surface the one-shot failure and rely on the watch, or suggest `doc-canon index --stop` before re-indexing; do not fight the lock or reindex inside `search`.

**With:**

> After any successful substantive write to `docs/canon/**`, the responsible managed skill runs one-shot `doc-canon index`. If a running watch holds the index lock, surface the one-shot failure and rely on the watch, or suggest `doc-canon index --stop` before re-indexing; do not fight the lock. (`search` self-heals a stale index only when no watch owns it.)

---

## 4. `docs/canon/ARCHITECTURE.md`

### 4a. Two layers (line 5)

**Append** to the paragraph, after "quality over thrift.":

> Search-first is mandatory when the index is available: `doc-canon search` / `code-index search` self-heal a stale index at the CLI layer (rebuild then serve) and record every successful search in `.doc-canon/probe-log.jsonl`; `doc-canon discipline` reports probe currency and gates on un-probed state.

### 4b. Retrieval bullet (line 33)

**Append** to the `- **Retrieval**` bullet, after "…consume the resulting context pack":

> The CLI `search` command self-heals a stale index (rebuild then re-run, `auto_reindexed` warning) when no watch owns it, and both search commands append one probe-log line per successful call; `check` merges `discipline` findings, and `doc-canon discipline` reports probe currency and exits ≠0 on un-probed state.

### 4c. Key flow 10 (line 45)

**Append** to flow 10, after "…not index construction, artifact IO, hashes, or watch behavior.":

> Since P7, a stale index is self-healed at the CLI layer when no watch owns it, and every successful search is recorded in the probe log.

---

## 5. `docs/canon/future_plans/INDEX.md`

### 5a. Initiatives table — new row (after the P6a-python row, line 45)

> | 7 | Strict search discipline | implementing | [p7-strict-search-discipline.md](p7-strict-search-discipline.md) |

### 5b. Ordering note (line 47)

**Append** a sentence at the end:

> P7 (strict search discipline) is `implementing`: it reverses P1's no-auto-reindex decision at the CLI layer, adds the probe log / `discipline` gate, and hardens the search-first rule into a mandatory gate with machine-parseable miss notes (`code_miss` / `doc_miss`) — see its initiative file and design spec.

---

## 6. New file `docs/canon/future_plans/p7-strict-search-discipline.md`

Create via `canon-future-plan` (must satisfy the future-plans validate zone: `FUTURE_PLAN` headings + INDEX row):

```markdown
# P7 — Strict search discipline

- **Status:** implementing
- **Design:** [`docs/superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md`](../../superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md) — SoT for the enforcement mechanics: CLI-layer auto-reindex, probe log + `discipline` gate, and the mandatory search-first gate with machine-parseable miss notes
- **Focus:** Make the search-first reading rule structurally enforced rather than guidance-only — self-healing freshness, observable probes, and a hard skill gate.
- **Depends on:** P0b (BM25 index), P1 (search + pack), P2a/P2b (code AST index + code search), P2c (code-index-first rules)
- **Unblocks:** Guaranteed token savings from the index route; CI-gateable probe discipline; measurement data for context-cost tracking

## Intent

The index and search tools only pay for themselves if agents actually use them — and guidance alone leaks (observed: whole-file reads with the rule in context, silently stale index, suppressible warnings). This initiative reverses P1's "no auto-reindex inside `search`" at the CLI layer, adds a probe log plus a `discipline` command/findings that make skipped probes observable and CI-gateable, and hardens the search-first rule into a mandatory gate (search when an index is available; fallback only when building failed; every read outside a pack carries a machine-parseable `code_miss` / `doc_miss`). Quality over thrift is preserved: the expand valve and legal deep reads stay unchanged.

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

- Probe-log trim bound (default 1000 lines) and which command owns trimming (default: `discipline` trims, idempotent)
- Symmetric doc/code exit-gate in `discipline` (default: symmetric)
- Whether adopter CI examples include `doc-canon discipline` (default: optional gate, not part of the recommended `validate` CI block)
```

---

## Validation

After applying: `doc-canon validate` must pass (new initiative file satisfies the future-plans validate zone via the INDEX row + required headings). Then the spec's implementation order resumes: wait for explicit go-ahead → implementation plan → code.
