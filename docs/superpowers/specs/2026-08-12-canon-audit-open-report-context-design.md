# Canon-audit open-report LLM context — Design Spec

**Date:** 2026-08-12  
**Status:** Approved in brainstorming; ready for implementation planning  
**Approach:** Guidance-only — skill filters what enters LLM reasoning context; no prune, no new CLI

## Problem

`canon-audit` discovers and merges via full `doc-canon report` / `.doc-canon/report.json`. As skill findings accumulate (especially long-lived `status: stale`), dumping the whole report into the model’s working context wastes tokens without helping Scout, Expand, or semantic judgement. Disk size is not the concern; LLM context is.

## Goals

1. Keep audit deep-read / Scout reasoning on **open** findings only.
2. Preserve on-disk stale findings and existing Report ownership merge (full prior skill set for `(kind, paths)` matching and `F-NNN` stability).
3. Make the split explicit in managed `canon-audit` (+ short living-canon sync): open for context, full report only at merge.

## Non-goals

- Deleting or auto-pruning `status: stale` from `.doc-canon/report.json`
- New CLI flags (e.g. `doc-canon report --status open`) — optional follow-up
- Schema changes to `report.json`
- Changing stale criterion, discrepancy lifecycle, or `check` merge rules
- Changing when agents run `doc-canon report` for merge discovery

## Decisions

| Topic | Choice |
| --- | --- |
| Delivery | Skill prose only (+ short `SKILLS.md` sync + phrase lock in embedded-assets test) |
| Scout / Expand / semantic deep-read | Prefer open findings only (`status: open`, both `cli` and `skill`); do not paste or paraphrase stale bodies |
| Stale visibility in context | One compact note allowed, e.g. `stale_skipped: N` (count only) |
| Merge / Report ownership | Unchanged: full `doc-canon report` after semantic pass for prior skill discovery, match, stale marking, RMW write-back |
| Disk retention | Keep “do not delete” stale |
| `Read` of `report.json` | Discouraged for “understand the picture”; use open slice for reasoning, full dump only on the merge step |

## Agent protocol (delta to Report ownership)

1. After `check` (and during Scout → Expand → semantic pass): if report evidence is needed for judgement, materialize an **open-only** view (filter tool output / note open ids). Do not load stale finding summaries into the reasoning transcript.
2. After the semantic pass, before writing `.doc-canon/report.json`: run full `doc-canon report` and apply the existing match/stale/`F-NNN` algorithm unchanged.
3. After write-back, when summarizing to the user, default to open findings; mention stale only as a count or if the user asks.

## Where to change

| Artifact | Change |
| --- | --- |
| `embedded/skills/canon-audit/SKILL.md` | Add an **Open findings for LLM context** (or equivalent) subsection under Report ownership / Audit flow: open-only for Scout/deep-read; full report only at merge; `stale_skipped: N` |
| `.cursor/skills/canon-audit/SKILL.md` | Sync via repo upgrade/copy path |
| `docs/canon/SKILLS.md` | Short phrase on `canon-audit` row: open findings for audit context; full report at merge only |
| `tests/embedded-assets.test.ts` | Lock phrases for open-context discipline (e.g. open findings / `stale_skipped` / full report at merge) |

Living `SKILLS.md` updates go through `canon-write` (canon-first). Skill bodies are managed assets.

## Testing

- Extend embedded-assets phrase locks for the new audit guidance.
- No runtime CLI tests (no CLI change).
- Optional acceptance scenario note: audit must not deep-read stale bodies for semantic pass.

## Out of scope / follow-ups

- `doc-canon report --status open` (or `--json` filter) as a deterministic open slice.
- Retention/prune policy for stale on disk if disk growth ever matters.
- Compact machine “open report” sidecar — not needed if skill filter holds.
