# P7 — Strict search discipline — Design Spec

**Date:** 2026-08-19  
**Status:** Draft for review  
**Initiative:** [`p7-strict-search-discipline.md`](../../canon/future_plans/p7-strict-search-discipline.md) (to be created via `canon-future-plan`)  
**Approach:** Make the search-first reading rule structurally enforced rather than guidance-only, in three moves: (1) `search` / `code-index search` auto-reindex on stale at the CLI layer, (2) a probe log plus discipline findings/command make skipped probes observable and CI-gateable, (3) the skill gate makes search mandatory when an index is available and miss notes machine-parseable. No blocking hooks (Level 4) in this initiative.

This spec is the detailed SoT for **P7**: it deliberately reverses two absorbed decisions — P1's "no auto-reindex inside `search`" and P2c's "miss report is prose, not a CLI feature" — and hardens the canon-write "do not hard-stop the skill" fallback into a defined gate. Where this spec and the prior artifacts disagree, this spec wins; the prior-artifact table records each reversal.

## Problem

The search-first discipline is guidance-only by design, and it leaks. Observed in the dogfood repo (2026-08-19): an analysis agent with `AGENTS.md` + `CLAUDE.md` + the pointer rule in context read ~15 whole source files without a single `doc-canon search` / `code-index search` probe; the code index had silently gone stale (5 committed files newer than the manifest); and the stale warning was suppressible (`2>/dev/null`). Each of those is a token-cost failure: wrong or absent retrieval → whole-file reads. The canon's own guard (`tests/code-analysis-token-guard.test.ts`) proves the index route is cheaper *when taken*; nothing makes agents take it.

Root causes, all deliberate prior decisions:

1. **No auto-reindex inside `search`** (P1): a stale index is served with a warning — an excuse agents can ignore and a failure mode (silently stale index) with no self-healing.
2. **Miss reporting is prose** (P2c): `code_miss` is a chat line, not machine-parseable — unverifiable, un-reportable.
3. **"Do not hard-stop the skill"** (`canon-write`): search failure downgrades to INDEX-first fallback, so skipping is never the wrong move.
4. **Guidance-only for coding agents** (P0): no observability artifact exists that would make a skipped probe visible.

## Goals

1. **Self-healing freshness:** `doc-canon search` and `doc-canon code-index search` rebuild a stale index before serving, at the CLI layer, when no watch process owns it. Stale-with-watch stays warn + serve (the watch syncs within its poll interval).
2. **Observable probes:** every successful CLI search appends a line to `.doc-canon/probe-log.jsonl`; `check` merges discipline findings; a new `doc-canon discipline` command prints them and exits ≠ 0 when the current state is un-probed (an index exists and relevant files changed after the last probe of that kind).
3. **Hard skill gate:** search is mandatory when an index is available; fallback to INDEX-first only when the index is missing *and* building failed; every deep read outside a pack requires a machine-parseable miss note (`code_miss` / new `doc_miss`).
4. **Updated managed overlays:** pointer rule, `AGENTS.md` block, `CLAUDE.md`, and the canon skills carry the gate; `skills_stamp` and npm minor bump per the soft-coupling rule; `upgrade-skills` regenerates copies.
5. **Tests:** probe-log, auto-reindex branches (stale/rebuild, stale/watch, missing), discipline exit-code gate, embedded-assets phrase locks, and the existing token-cost guard stays green.
6. **Measurement foundation:** the probe log becomes the data source for the token-savings metrics called out in the earlier context-cost review (probe coverage, probe age vs change age).

## Non-goals

- **Blocking enforcement** (Claude Code `PreToolUse` hooks / MCP file-read mediation): Level 4, explicitly deferred to a follow-up initiative. The probe log proves "the agent searched", not "the agent never read without searching" — that limit is accepted for P7.
- Changing the public sync APIs: `searchCanon` (`doc-canon/search`) and `searchCodeIndex` (`doc-canon/code-search`) keep their signatures and sync semantics; auto-reindex and probe logging live in the CLI command layer only.
- Auto-building a **missing** index: missing stays fail-closed (exit ≠ 0 + hint) — it is the guard against searching a non-canon repo, not an excuse.
- Incremental per-doc BM25 updates: v1 rebuilds the whole index on stale (measured 2.4 s / 132 files in the dogfood repo); incremental scoring is a follow-up.
- Changing `Future plans` semantics, `DISCREPANCIES.md` workflow, or the canon's quality-over-thrift expand valve. The gate makes *unjustified* reads costly; *justified* deep reads (review, audit, thin-probe expansion) stay legal and cheap.
- Feeding miss notes into any CLI artifact (v1: strict format only, parseable by future hooks/CI).

## Decisions

| Topic | Choice |
| --- | --- |
| Auto-reindex layer | **CLI commands only** (`src/commands/search.ts`, `src/commands/code-index-search-cmd.ts`): run search → `freshness === "stale"` → no live watch pid → `await sync` (doc: `syncCanonIndex`; code: `syncCodeIndex`) → re-run search. Public lib APIs unchanged |
| Rebuild trigger | Stale **and** no live watch pid (own kind's pid file via `readWatchPid`/`isPidAlive`); watch alive → warn + serve stale (unchanged P1 behavior for that branch) |
| Missing index | Fail-closed, unchanged (exit ≠ 0 + build hint) |
| Reindex signal | Reuse the Pack `warnings` array → `"auto_reindexed"`; no Pack schema change. Human mode prints a stderr warning in the existing style; `--json` carries `warnings: ["auto_reindexed"]` (alongside `freshness: "fresh"` from the re-run) |
| Probe log | `.doc-canon/probe-log.jsonl` (already gitignored), one JSON line per **successful** CLI search: `{ts, kind: "doc"\|"code", query, mode, hits, freshness, reindexed}` where `mode` is present only for code searches (`"symbols"`\|`"refs"`); append-only; `discipline`/`check` trim to the last 1000 lines when reading |
| Discipline findings | New `FindingKind` value `"discipline"` in `src/report/types.ts`. Safe: `readReport` is lenient (raw `JSON.parse`, no kind validation) and `mergeCliFindings` preserves skill findings; `schema_version` stays 1. Findings carry human-readable summaries; numeric detail lives in `discipline` output |
| `doc-canon discipline` | New thin command: reads probe log + index manifests, prints a human table (last doc/code probe age, files changed since each probe, probe count) and `--json`; **exit ≠ 0** when an index exists and relevant files changed after the last probe of that kind (un-probed state). Missing index or never-probed fresh clone → not-applicable, exit 0 |
| `check` integration | Merges one compact discipline finding set via existing `mergeCliFindings` (informational; does not change `check`'s exit code — only `discipline` gates) |
| Gate rule (skills + pointer) | "If an index exists (or can be built) → `doc-canon search` / `code-index search` is **mandatory** before any deep read of `docs/canon/**` or covered-language source. Fallback to INDEX-first / source-first only when the index is missing **and** building failed, with a miss note per file." Replaces canon-write's "do not hard-stop the skill" |
| Miss formats | Machine-parseable: `code_miss: <query> -> source:<path>` (existing format, now a strict regex) and `doc_miss: <query> -> docs:<path>` (new, mirror) |
| Reversed decisions | P1 "no auto-reindex inside `search`" (reversed at CLI layer); P2c "miss = prose, not a CLI feature" (format only — still not an artifact); P0 "guidance only" (observability added) |
| Managed overlay coupling | `embedded/agents/AGENTS.block.md`, `embedded/rules/doc-canon.mdc`, `embedded/skills/canon-write|canon-audit|canon-bootstrap/SKILL.md` + this repo's own `AGENTS.md`/`CLAUDE.md`/`.cursor`/`.claude` copies regenerated via `upgrade-skills`; npm minor + `skills_stamp` bump |
| Canon absorption | `CLI.md` (search + code-index search sections, invariants, `discipline`), `GLOSSARY.md` (`index_stale` redefinition, probe log, discipline finding, `doc_miss`), `SKILLS.md` (gate recipe), `ARCHITECTURE.md` (retrieval path), `future_plans/INDEX.md` (P1 absorbed note amended; new P7 initiative). README mirrored (not SoT) |
| Status flow | P7 `draft → implementing` via `canon-future-plan` (Design → this spec); `absorbed` after implementation |

## Architecture

Auto-reindex and probe logging live entirely in the CLI command layer; the library and index artifacts are untouched.

```text
doc-canon search "topic"                     doc-canon code-index search "sym"
        │                                           │
        ▼                                           ▼
  searchCanon(root, q)                       searchCodeIndex(root, q, opts)
  freshness = stale?                         freshness = stale?
        │  no                                     │  no
        ▼                                        ▼
  serve pack (warn if watch alive)          serve pack (warn if watch alive)
        │  yes (no live watch)                   │  yes (no live watch)
        ▼                                        ▼
  await syncCanonIndex(root)                await syncCodeIndex(root)
        │                                           │
        ▼                                           ▼
  re-run search → fresh pack                re-run search → fresh pack
  warnings += "auto_reindexed"              warnings += "auto_reindexed"
        │                                           │
        ▼                                           ▼
  append probe-log line                     append probe-log line
        │                                           │
        ▼                                           ▼
  print pack / --json                       print pack / --json
```

```text
doc-canon discipline
        ▼
  read probe-log.jsonl (trim to last 1000)
  read index manifests (doc + code) + live hashes
        ▼
  compute: last doc/code probe age; files changed since each probe
        ▼
  print table | --json
  exit ≠ 0 iff an index exists AND relevant files changed
        after the last probe of that kind (un-probed state)
```

**Invariants**

- Public sync APIs (`searchCanon`, `searchCodeIndex`) never auto-reindex and never log; deterministic for library consumers.
- A stale index served with a live watch still carries `index_stale`/`code_index_stale` (the watch owns freshness).
- Missing index stays fail-closed in both commands and in `discipline` (not-applicable, exit 0).
- Probe log writes are non-fatal: an unwritable `.doc-canon/` warns once and serves the pack anyway — discipline must never break search.
- Quality over thrift preserved: the expand valve and legal deep reads (review/audit) are unchanged; only *unjustified* reads now carry a mandatory visible note.
- `reindexed` in the probe line is derived from the command's rebuild decision, keeping the log and the pack consistent.

## Components

| Module | Role |
| --- | --- |
| `src/commands/search.ts` | Auto-reindex on stale (doc index, doc watch pid check); append probe line (`kind: "doc"`); pass `reindexed` |
| `src/commands/code-index-search-cmd.ts` | Auto-reindex on stale (code index, code watch pid check); append probe line (`kind: "code"`, `mode`) |
| `src/probe-log.ts` (new, shared) | Append line + read/trim to 1000; path `.doc-canon/probe-log.jsonl`; reused by commands, `check`, `discipline` |
| `src/report/types.ts` | `FindingKind` gains `"discipline"` |
| `src/commands/check.ts` | Compute and merge discipline findings via `mergeCliFindings` (informational) |
| `src/commands/discipline.ts` (new) + `src/cli.ts` | Human table + `--json`; un-probed exit-gate |
| `embedded/agents/AGENTS.block.md` | One sentence: search is mandatory when the index is available; reads outside a pack require `code_miss`/`doc_miss` |
| `embedded/rules/doc-canon.mdc` | "Search-first is mandatory" restatement of the code-analysis order + doc-side gate + miss formats |
| `embedded/skills/canon-write|canon-audit|canon-bootstrap/SKILL.md` (+ dual-written copies) | Hard gate: mandatory probe step; fail-closed → build → retry → only then fallback with per-file miss note |
| `docs/canon/CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md` | Living absorption (via `canon-write`, user-run) |
| `docs/canon/future_plans/p7-strict-search-discipline.md` + `INDEX.md` | New initiative (via `canon-future-plan`, user-run); P1 absorbed note amended |

### Rule text (embedded content)

`embedded/agents/AGENTS.block.md` — replace the current "Try `doc-canon search` first; on fail-closed fall back" opening with:

> For design and development, treat `docs/canon/` as the context source of truth. **Search first — it is mandatory when the index is available:** run `doc-canon search "<topic>"` (and `doc-canon code-index search` for covered-language code) before deep reads; on fail-closed (missing index) run `doc-canon index` / `code-index build` and retry; only if building fails, fall back to `docs/canon/INDEX.md` and note every read outside a pack (`doc_miss` / `code_miss`). `docs/canon/future_plans/` holds directional initiatives…

`embedded/rules/doc-canon.mdc` — the "Code analysis order" section gains a mandatory-first sentence and the doc-side mirror:

```markdown
## Search-first is mandatory

For design and development, `doc-canon search "<topic>"` (and `doc-canon code-index search` for covered languages) is **mandatory before deep reads when an index exists or can be built** — `doc-canon search` self-heals a stale index, and a missing index fails closed with a build hint; run `doc-canon index` / `doc-canon code-index build`, then retry. Only if building fails, fall back to INDEX-first / source-first and note each read outside a pack: `doc_miss: <query> -> docs:<path>` or `code_miss: <query> -> source:<path>`. The expand valve is unchanged: a thin probe licenses targeted reads as evidence with a miss note — never silent under-reading, never silent skipping.
```

`embedded/skills/canon-write/SKILL.md` — Scout step hardens to:

> 1. **Mandatory probe:** run `doc-canon search "<topic>"` (and `doc-canon code-index search` when covered source is in scope); build the working-set manifest from pack paths and snippet stubs.
> 2. **Fail-closed:** if the index is missing, run `doc-canon index` (and `code-index build` when covered source exists), then re-run the search. Only if building fails, continue with INDEX-first progressive disclosure and record `doc_miss: <query> -> docs:<path>` for every file read outside the pack.
> 3. Deep-read only files present in the pack or with a recorded miss note; the Expand gate (`sufficient` / `need more`) is unchanged.

`canon-audit` and `canon-bootstrap` mirror the same hard gate (their index-first steps already exist; they gain the mandatory wording and the `doc_miss` format).

## Data flow

1. Agent begins a task touching canon docs or covered-language code; runs `doc-canon search` / `code-index search` per the gate.
2. Command serves a pack — self-healing a stale index first (rebuild, re-run, `auto_reindexed`), failing closed on a missing index with a build hint — and appends a probe-log line.
3. Agent deep-reads only pack files; anything else gets a one-line `doc_miss`/`code_miss` note (machine-parseable format).
4. `check` merges discipline findings into `report.json`; humans/CI run `doc-canon discipline` to gate on un-probed state.
5. After canon writes, the existing post-write `doc-canon index` keeps the index fresh, so subsequent probes rarely reindex.

## Error handling

| Situation | Behavior |
| --- | --- |
| Index stale, no live watch | Rebuild (await sync), re-run search, serve fresh with `warnings: ["auto_reindexed"]`; `discipline` sees a fresh probe |
| Index stale, live watch | Warn + serve stale (watch syncs within its poll interval); no rebuild |
| Index missing | Fail-closed, exit ≠ 0 + hint to run `doc-canon index` / `code-index build` (unchanged) |
| Rebuild fails (parse/corrupt corpus) | Fail-closed with the manual-build hint; no pack served |
| Probe log unwritable | Non-fatal: warn once on stderr; pack still served; `discipline` reports log-unavailable |
| `discipline` with no log / no index | Not-applicable: exit 0, clear message |
| Un-probed state (index exists, files changed since last probe) | `discipline` exits ≠ 0 (CI gate); `check` shows an informational `discipline` finding |

## Testing

**Auto-reindex (CLI-level)** — new `tests/search-auto-reindex.test.ts` + `tests/code-search-auto-reindex.test.ts`: fixture repo + index; mutate a corpus/source file; run the command; assert the pack is fresh with `warnings` containing `auto_reindexed`; a live watch pid (stubbed via the pid file) suppresses rebuild and keeps the stale warning; a missing index exits ≠ 0 with the hint.

**Probe log** — new `tests/probe-log.test.ts`: successful doc and code searches append lines with correct fields; a failed search (missing index, empty query) appends nothing; `readProbeLog` trims to 1000 lines.

**Discipline gate** — new `tests/discipline-cmd.test.ts`: un-probed state exits ≠ 0; after a fresh probe exits 0; fresh clone (no index) exits 0 (not-applicable); `--json` shape stable.

**Finding merge** — `tests/check.test.ts` (or `report-merge` tests): discipline findings merged via `mergeCliFindings`; `FindingKind` accepts `"discipline"`.

**Embedded assets** — `tests/embedded-assets.test.ts`: phrase locks for the mandatory-search sentence in `AGENTS.block.md` / `doc-canon.mdc`, the hard-gate wording in the three skill sources, and the `doc_miss:` format; copied repos receive them via `copyManagedAssets`.

**Existing guard** — `tests/code-analysis-token-guard.test.ts` stays green; optionally extend with a discipline-flow fixture (edit → probe → pack fresh) to lock the self-heal path.

## Implementation order (after plan)

1. Canon-first via `canon-write` (user-run): `CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md`; create `future_plans/p7-strict-search-discipline.md` + mark P7 `implementing` and amend the P1 absorbed note via `canon-future-plan` (user-run).
2. Wait for explicit go-ahead after the substantial canon updates.
3. Implement (TDD): shared `src/probe-log.ts`; auto-reindex + probe append in `src/commands/search.ts` and `src/commands/code-index-search-cmd.ts`; `FindingKind` extension; `check` discipline findings; new `src/commands/discipline.ts` + `src/cli.ts` registration.
4. Write the new tests; keep the full suite green.
5. Update managed overlays (`embedded/agents`, `embedded/rules`, three skill sources); regenerate this repo's copies via `upgrade-skills`; bump npm minor + `skills_stamp`; mirror README.
6. Close with `canon-audit` on the affected topic; mark P7 `absorbed` via `canon-future-plan`.

## Relationship to prior artifacts

| Artifact | Role after this spec |
| --- | --- |
| `2026-08-12-p1-retrieval-and-context-pack-design.md` + P1 initiative | **Reversed:** "no auto-reindex inside `search`" (CLI layer); stale warn+serve row amended; absorbed note updated |
| `2026-08-18-p2c-code-analysis-rules-design.md` + P2c initiative | **Hardened:** `code_miss` becomes machine-parseable; guidance becomes a gate; expand-when-thin preserved |
| `2026-08-09-skill-context-efficiency-design.md` (P0) | **Extended:** observability added to the guidance-only discipline |
| `2026-08-18-p2a-code-ast-index-design.md`, `2026-08-18-p2b-code-search-tools-design.md` | Consumed unchanged: code index surface and search tools stay as shipped; P7 only wraps them |
| `src/report/merge.ts`, `src/report/io.ts` | Reused: lenient reader + skill-preserving merge make the new `discipline` finding kind safe |
| `docs/canon/CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md`, `future_plans/INDEX.md` | Living absorption targets (updated via canon skills, user-run) |
| `tests/code-analysis-token-guard.test.ts` | Stays green; the token-cost claim it guards is now reinforced by the gate |

## Open questions

None blocking design. Deferred to the implementation plan:

- Exact trim bound for the probe log (default 1000 lines) and whether `check` or `discipline` owns trimming (default: both idempotent, `discipline` trims).
- Whether the `discipline` exit-gate should also warn (not fail) when only *documentation* changed (default: same gate for both kinds, symmetric).
- Whether adopter CI examples should include `doc-canon discipline` (default: document as optional gate, not part of the recommended `validate` CI block).

## Related

- [`docs/canon/future_plans/p1-retrieval-and-context-pack.md`](../../canon/future_plans/p1-retrieval-and-context-pack.md) — decision being reversed (no auto-reindex)
- [`docs/canon/future_plans/p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md) — discipline being hardened (miss format, gate)
- [`2026-08-18-p2c-code-analysis-rules-design.md`](2026-08-18-p2c-code-analysis-rules-design.md) — prior design for the code-analysis rules
- [`2026-08-12-p1-retrieval-and-context-pack-design.md`](2026-08-12-p1-retrieval-and-context-pack-design.md) — pack/freshness policy being amended
- Living absorption targets: `CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md`
