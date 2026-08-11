# Canon-audit stale discovery — Design Spec

**Date:** 2026-08-11  
**Status:** Approved in brainstorming; ready for implementation planning  
**Approach:** Guidance-only — clarify Report ownership in `canon-audit` (+ short living-canon sync); no new CLI

## Problem

`canon-audit` tells agents to mark prior `source: skill` findings that the current audit cannot confirm as `status: stale`, but it does not say how the agent learns which prior findings exist. Agents may invent a baseline, skip stale marking, or overwrite without a read of `.doc-canon/report.json`.

## Goals

1. Make discovery of prior skill findings explicit: run `doc-canon report` before merging new skill findings.
2. Keep the stale criterion: a prior skill finding becomes `stale` when this audit does not reproduce it.
3. Define reproduction as a match on normalized `(kind, paths)` (same key already used for dedupe).
4. Preserve read-modify-write invariants: never wipe `source: cli`; never silently delete or resolve unconfirmed skill findings.

## Non-goals

- New CLI commands or merge helpers
- Schema changes to `report.json`
- Automatic stale marking in `doc-canon check`
- Changes to discrepancy Open → Resolved lifecycle
- Changing how `structure` / `consistency` vs `conflict` / `drift` are filed

## Decisions

| Topic | Choice |
| --- | --- |
| Delivery | Skill prose only (+ short `SKILLS.md` sync + asset phrase test) |
| Discovery | `doc-canon report` before merge (after semantic pass; report already refreshed by earlier `check`) |
| Stale criterion | Prior `source: skill` not reproduced by this audit → `status: stale` |
| Reproduction key | Normalized `(kind, paths)` |
| Confirmed prior | Keep same `F-NNN`, keep/set `status: open`; summary/evidence may update (paths stay the match key) |
| Already-stale prior, still unreproduced | Leave `stale` |
| New finding (no prior match) | Allocate new `F-NNN` from max existing id |
| CLI findings | Untouched |

## Merge algorithm

After the semantic pass, before writing `.doc-canon/report.json`:

1. Run `doc-canon report` and collect all findings with `source: skill` as **prior**.
2. Build the set of **confirmed** findings from this audit.
3. Match confirmed ↔ prior by normalized `(kind, paths)`.
4. On match: keep the prior `id`, set `status: open`, update summary/evidence as needed.
5. Prior with no match: set `status: stale` (do not delete; do not treat as resolved discrepancy by this step alone).
6. Confirmed with no prior: assign a new `F-NNN`.
7. Read-modify-write the report: emit updated skill findings plus every existing `source: cli` finding unchanged.

Stale means “not reproduced by this audit,” not “missing from the report after `check`.” `check` already preserves skill findings; `report` is the discovery surface.

## Where to change

| Artifact | Change |
| --- | --- |
| `embedded/skills/canon-audit/SKILL.md` | Expand **Report ownership** with the discovery step and match/stale rules above |
| `.cursor/skills/canon-audit/SKILL.md` | Sync via normal upgrade/copy path used in this repo |
| `docs/canon/SKILLS.md` | One short phrase on the `canon-audit` row: prior skill findings discovered via `doc-canon report` before merge |
| `tests/embedded-assets.test.ts` | Assert audit skill mentions `doc-canon report` (and retain existing stale/merge phrases) |

Living `SKILLS.md` updates go through `canon-write` (canon-first). Skill bodies are managed assets.

## Testing

- Extend the existing embedded-assets test that locks audit merge/lifecycle phrases to require `doc-canon report`.
- No new runtime merge unit tests (behavior remains agent-executed guidance).

## Out of scope / follow-ups

- Optional later: CLI helper to apply stale-by-key if agent RMW proves error-prone.
- Optional later: document the same algorithm in acceptance skill scenarios.
