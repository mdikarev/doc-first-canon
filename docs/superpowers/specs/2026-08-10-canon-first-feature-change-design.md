# Canon-first feature-change order — Design Spec

**Date:** 2026-08-10  
**Status:** Approved for implementation planning  
**Approach:** Pointer + living canon + usage-flows + light skill cross-link + acceptance/asset tests; no new CLI or skill

## Problem

Managed guidance tells coding agents to **read** and **lean on** `docs/canon/`, and day-to-day flows emphasize **post-hoc** sync (`canon-write` / `check` / `audit` after edits). Nothing requires a fixed order for intentional feature work: agents can implement behavior first and only later (or never) update the SoT. Specs/plans outside the canon are also unordered relative to canon edits.

## Goals

1. For **new or changed functionality** (behavior / public contract), agents follow: **canon → optional spec/plan → code**.
2. Ship the discipline in **product** managed assets (pointer rule + `AGENTS.md`) and keep this repo aligned as the reference consumer.
3. Coding agents **must not** edit `docs/canon/**` themselves; they invoke **`canon-write`** (or stop and ask the user to run it).
4. After **substantial** canon changes, wait for explicit user go-ahead before code; after **spot** section sync, may proceed to optional spec/code in the same session.
5. Keep **post-hoc sync** and **`code_stale`** paths; document them as distinct cycles from feature-change order.
6. Reflect the dual cycle in living canon (`SKILLS`, `ARCHITECTURE`), usage flows, acceptance scenarios, and embedded-asset tests; bump `skills_stamp` so `upgrade-skills` delivers the rule.

## Non-goals

- New managed skill (e.g. `canon-feature`) or mandatory chat ritual checklist in the pointer
- CLI / contract / template schema changes
- Mandating `docs/superpowers/specs/` (or any fixed path) in target repositories
- Requiring a design spec for every small behavior tweak
- Changing “canon skills never edit application code”
- Turning `future_plans/**` into a task tracker; feature-change order applies to **living** SoT before code (initiatives stay directional until absorbed)
- Automated end-to-end agent execution tests

## Decisions

| Topic | Choice |
| --- | --- |
| Audience | Product managed assets **and** this repository |
| Delivery | Approach 2: pointer/`AGENTS` + living canon + usage-flows + short `canon-write` cross-link + acceptance + asset string tests |
| Spec step | **Optional**; write or sync a local design/plan artifact only when the change is large enough; path is project-local (specs, roadmap, issue)—not prescribed by doc-canon |
| Canon authorship | Coding agents **never** edit `docs/canon/**`; always via `canon-write` |
| Approval gate | **Substantial** canon change → stop for user “ok / implement”; spot sync → may continue |
| Exceptions | Pure bugfix with intended behavior unchanged; `code_stale` (canon already correct); non-behavioral edits (typo, tests, refactor without contract change) |
| Post-hoc sync | Remains valid after opportunistic or emergency code edits; does not replace canon-first for intentional feature work |
| Stamp | Bump package/`skills_stamp` (e.g. `0.4.0` → `0.5.0`) when managed rule/skill/`AGENTS` text changes |

## Feature-change order

1. **Classify** the request. If it is an exception (above), skip canon-first; for `code_stale`, implement from existing canon / Open coding task.
2. If there is no `docs/canon/` yet, stop and bootstrap/`init` first.
3. **Canon first:** invoke `canon-write` (or ask the user to run the skill). Do not start application-code changes for the feature until living canon reflects the desired behavior and `doc-canon validate` has passed under the skill’s normal success gate.
4. **Optional spec/plan:** if the change spans multiple modules/sections, needs a non-obvious design, or will be handed to another session/agent—create or sync a project-local design/plan artifact from the updated canon. Otherwise skip.
5. **Approval:** if the canon edit was **substantial**, wait for explicit user confirmation before coding. If it was spot sync only, may proceed.
6. **Implement** application code (and tests) against the canon (and spec/plan if present).
7. If mid-flight docs↔code conflict appears, do not silently pick a side; use `canon-audit` / `DISCREPANCIES.md` as today.

### Substantial (for the pre-code approval gate)

Align with `canon-write` language: new meaning, invariant change, behavioral claim, non-trivial factual sync; also new section or multiple sections.

**Not substantial for this gate:** typo/link polish; single already-clear section sync that does not change invariants.

### When a spec/plan is warranted

- **Yes:** multi-section/module design, ambiguous architecture, handoff to another agent/session.
- **No:** one section already states the behavior; change is local and unambiguous after canon.

## Dual cycles (documentation shape)

| Cycle | When | Order |
| --- | --- | --- |
| Feature change | Intentional new/changed behavior | `canon-write` → optional spec/plan → (gate if substantial) → code |
| Everyday / post-hoc sync | After meaningful code or canon drift discovered late | `canon-write` / `check` / `canon-audit` as in current day-to-day flow |
| Code stale | Canon correct, code wrong | Open coding task / implement without rewriting canon first |

## Stop / error conditions

| Case | Behavior |
| --- | --- |
| Coding agent started feature code without canon update | Stop; do not continue feature coding; run `canon-write` first |
| `validate` fails after canon edits | Do not proceed to spec/code |
| Ambiguous desired behavior | `canon-write` clarify protocol; coding agent must not invent SoT |
| New section kind needed | `canon-contract` before/within write, as today |
| `canon-write` unavailable | Stop; ask user to run skill / `upgrade-skills`; do not edit canon around the skill |
| No canon tree | Bootstrap/`init` before this order |

## Files to change (implementation)

- `embedded/rules/doc-canon.mdc` — concise always-on feature-change order, exceptions, no self-edit of canon, substantial wait
- Managed `AGENTS.md` block source (same content intent, short)
- `embedded/skills/canon-write/SKILL.md` — short note that coding agents invoke this skill **before** feature code; no workflow rewrite
- `.cursor/skills/**` / local rule mirrors — sync via existing upgrade/copy practice for this repo
- `docs/canon/SKILLS.md` — dual-cycle responsibilities; pointer/coding-agent obligations
- `docs/canon/ARCHITECTURE.md` — new key flow “Feature change”
- `docs/canon/GLOSSARY.md` — optional 1–2 sentence term (*canon-first* / *feature-change order*)
- `docs/guides/usage-flows.md` — new EN+RU journey; clarify Day-to-day as post-hoc
- `docs/acceptance/skill-scenarios.md` — feature-change order + pointer/`AGENTS` bullet
- `tests/embedded-assets.test.ts` (or equivalent) — required marker strings
- Package `skills_stamp` / default contract stamp bump to next minor (e.g. `0.5.0`)

## Success criteria

- Pointer/`AGENTS` text in embedded assets states canon-first → optional spec → code, exceptions, and “no self-edit of canon”
- Living canon and usage-flows describe feature-change vs post-hoc vs `code_stale` without contradiction
- `canon-write` mentions pre-code invocation for feature work
- Acceptance scenario covers the order and substantial wait
- Asset tests fail if markers are removed; `skills_stamp` bumped so upgrades pick up the rule
- No new CLI command or managed skill binary

## Out of scope follow-ups

- Stronger enforcement (dedicated skill, hooks that block code edits)
- Project-template for where specs live in consumer repos
- Merging brainstorming/`writing-plans` into managed doc-canon skills
