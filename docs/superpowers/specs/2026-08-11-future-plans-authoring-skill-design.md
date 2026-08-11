# P0c — Future plans authoring skill — Design Spec

**Date:** 2026-08-11  
**Status:** Approved for implementation planning  
**Initiative:** [`docs/canon/future_plans/p0c-future-plans-authoring-skill.md`](../../canon/future_plans/p0c-future-plans-authoring-skill.md)  
**Approach:** Dedicated managed skill + INDEX-driven `future_plans/` validate zone (no per-initiative contract rows)

## Problem

Adding an initiative is split across everyday prose (`canon-write`) and structural registration (`canon-contract`). Agents improvise shape, numbering, and INDEX rows. Each initiative file is also an optional contract section (`required: false`), so every new draft needs a contract edit even though initiatives are not behavioral SoT — only `future_plans/INDEX.md` needs to be the list source of truth.

## Goals

1. Ship a dedicated managed skill `canon-future-plan` that authors/refines directional initiatives from `FUTURE_PLAN`, keeps prose non-checklist, and keeps `future_plans/INDEX.md` in sync in the same pass.
2. Stop requiring per-file registration in `CANON_CONTRACT.md` for initiative markdown; validate via INDEX↔disk + `FUTURE_PLAN` headings instead.
3. Narrow `canon-write`: hand off all `future_plans/**` create/refine/status work; keep living-SoT absorb.
4. Preserve status vocabulary `draft` → `refining` → `implementing` → `absorbed` and numbering `pN` / `pN`+letter with table order + short priority notes.
5. Align acceptance scenarios and bump `skills_stamp` so `upgrade-skills` delivers the skill and migrated contract shape.

## Non-goals

- Replacing living SoT authorship (`canon-write` for root sections)
- Turning `future_plans/` into a roadmap/task tracker
- Declarative generic `managed_subdir` / glob policy in the contract YAML (hardcoded `future_plans/` zone for this delivery)
- Changing status vocabulary or inventing a new template kind
- Implementing P0b / P1 / P2 / P3 initiative content
- Claude Code packaging

## Decisions

| Topic | Choice |
| --- | --- |
| Packaging | New managed skill `canon-future-plan` (not an extension mode of `canon-write`) |
| Contract model | Only `future-plans-index` stays in `sections`; remove per-initiative `future-p*` rows |
| Validate | INDEX-driven: Initiatives table ↔ `future_plans/*.md`; heading check via `FUTURE_PLAN`; those files are not orphans |
| Skill lifecycle | Create, refine, status, INDEX sync in `canon-future-plan`; absorb living SoT in `canon-write` |
| Write handoff | `canon-write` always stops on new/refine future-plan requests and asks to run `canon-future-plan` |
| Absorb split | `canon-write` merges outcomes into living sections → then `canon-future-plan` sets `absorbed` / updates INDEX |
| Numbering | `pN` + optional letter suffix; priority = table row order + short note under the table |
| Contract handoff | Not needed for new initiative files after this change |
| Pre-code gate | **Canon-first:** before application/CLI/skill implementation, update living canon via `canon-write`, then optional plan sync, then go-ahead (this design doc does not replace that step) |

## Architecture

```text
user intent
  → canon-future-plan
      → Scout: future_plans/INDEX.md + affected file + FUTURE_PLAN template
      → clarify if invent-risk
      → write initiative + INDEX row/status/note
      → doc-canon validate

canon-write (living SoT only)
  → on future_plans create/refine → stop + handoff
  → on absorb → edit living sections → handoff status to canon-future-plan

doc-canon validate
  → contract sections as today (incl. required future_plans/INDEX.md)
  → future_plans/*.md (except INDEX): not orphan; INDEX Initiatives ↔ disk; FUTURE_PLAN headings
  → root INDEX Sections ↔ contract only (no initiative files listed there)
```

### Boundaries

| Actor | Owns |
| --- | --- |
| `canon-future-plan` | Initiative create/refine, status, slug/`pN`+letter, `future_plans/INDEX.md`, validate |
| `canon-write` | Living SoT; hard handoff for `future_plans/**` (except coordinating absorb of living sections) |
| `canon-contract` | New kinds/templates only — not each initiative file |
| `doc-canon validate` | INDEX-driven zone under `future_plans/` |

## Skill workflow (`canon-future-plan`)

1. Scout a narrow working set: `future_plans/INDEX.md`, target initiative file(s), `templates/FUTURE_PLAN.md`. Show working set + verdict before deep reads (same quality-over-thrift recipe as other canon skills).
2. Clarify when invent-risk remains (one question at a time, A/B/C + recommendation, max 3) — same protocol shape as `canon-write`.
3. Propose id (`pN` or `pN`+letter), filename slug, table position, and initial status (`draft` unless refining an existing file).
4. Author from `FUTURE_PLAN` required headings; allow established metadata bullets (Status / Focus / Depends / Unblocks / Design).
5. Update `future_plans/INDEX.md` Initiatives row, status column, and short ordering note when priority changes.
6. Refuse checklists, sprint plans, and coding-agent prompts in initiative bodies; point to roadmap / tickets / `DISCREPANCIES.md`.
7. Run `doc-canon validate`; claim success only when it passes.
8. Never edit application code; never invent new contract section kinds.

Triggers: new initiative, refine prose, status change, INDEX reorder / priority note.

## Validate zone (CLI)

For markdown under `docs/canon/future_plans/` other than `INDEX.md`:

1. **Orphan exemption:** do not fail “not listed in the contract”.
2. **Parse** the Initiatives table in `future_plans/INDEX.md` (File column → relative path under `future_plans/`).
3. **Fail** if INDEX links a missing file; if a `future_plans/*.md` (non-INDEX) has no INDEX row; if a linked file is missing required headings from template `FUTURE_PLAN`.
4. Root `INDEX.md` ↔ contract agreement unchanged: initiative files must **not** appear in root Sections.

`future_plans/INDEX.md` remains a normal required contract section with template `FUTURE_PLANS_INDEX`.

## Migration

- Strip `future-p*` entries from this repo’s `CANON_CONTRACT.md` and matching root `INDEX.md` Sections rows.
- `ensure-future-plans` / default contract: keep INDEX + templates only; do not add sample initiative sections.
- Repos that already registered optional initiative sections: upgrade/migration path should leave files on disk, remove those section rows (or document a one-shot reconcile) so validate becomes INDEX-driven and still green.
- Bump `skills_stamp` when embedded skill + pointer/`SKILLS` guidance ship.

## Canon-first implementation gate

This document is a **project-local** design artifact from brainstorming. It does **not** satisfy feature-change order by itself.

Before implementing CLI/skill/asset changes:

1. Run **`canon-write`** so living canon (`SKILLS.md`, `ARCHITECTURE.md`, light `CLI.md` / glossary as needed, `future_plans/INDEX` “How to use”, and narrowed `canon-write` responsibility) describes the target behavior.
2. Optionally sync this spec / write an implementation plan from the updated canon.
3. After a **substantial** canon edit, wait for explicit user go-ahead.
4. Then implement code and embedded assets against the living canon.
5. Mark P0c `absorbed` via `canon-future-plan` once outcomes are in living sections (after the skill exists; until then use the agreed handoff once available).

## Errors

| Case | Behavior |
| --- | --- |
| Validate fails after edits | Do not claim success; fix INDEX/file/headings |
| User dumps tasks into an initiative | Refuse; redirect to execution trackers |
| `canon-write` asked to create/refine a plan | Stop; instruct to run `canon-future-plan` |
| `doc-canon` missing on PATH | Hard-fail with install hint |
| Ambiguous id/order | Clarify with recommendation; do not invent silently |

## Testing & acceptance

- Unit: orphan exemption; INDEX↔disk mismatches; heading failures for initiative files; root INDEX must not require initiative paths.
- Migration/upgrade: fixture with old per-file sections ends valid without those contract rows (files retained, INDEX authoritative).
- Acceptance: replace “`canon-write` + `canon-contract` registers initiative” with “`canon-future-plan` creates file + INDEX without contract row”; write handoff; absorb split across write + future-plan.

## Files likely to change (implementation — after canon-write)

- `embedded/skills/canon-future-plan/SKILL.md` (new) + mirror under `.cursor/skills/`
- `embedded/skills/canon-write/SKILL.md` — handoff wording
- `src/validate/validate.ts` (+ helper for future-plans INDEX parsing)
- `src/scaffold/default-contract.ts` / `ensure-future-plans.ts` as needed
- Living canon sections (via `canon-write` first): `SKILLS.md`, `ARCHITECTURE.md`, possibly `CLI.md` / `GLOSSARY.md`, `future_plans/INDEX.md`
- This repo contract + root INDEX migration strip of `future-p*`
- `docs/acceptance/skill-scenarios.md`
- Embedded-asset / validate tests; `skills_stamp` bump

## Success criteria

- New initiative can be added without editing `CANON_CONTRACT.md` section list.
- `doc-canon validate` enforces INDEX↔files and `FUTURE_PLAN` headings for initiatives.
- `canon-write` does not author new initiatives; `canon-future-plan` does.
- Acceptance and living canon agree; P0c can be marked `absorbed` after ship.

## Open follow-ups (out of this design)

- Whether absorbed initiatives are removed from disk or kept as historical `absorbed` rows (project choice; skill should ask when unclear).
- Later generalization of subdirectory zones beyond `future_plans/`.
