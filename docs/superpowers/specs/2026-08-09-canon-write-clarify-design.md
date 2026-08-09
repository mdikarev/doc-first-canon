# Canon-write clarify-before-invent — Design Spec

**Date:** 2026-08-09  
**Status:** Approved for implementation planning  
**Approach:** Expand `canon-write` skill guidance only; no CLI/contract/template changes

## Problem

`canon-write` authors and syncs living canon prose, but its skill text barely requires clarifying with the user. Interview behavior lives mainly in `canon-bootstrap` and `canon-contract`. In everyday authorship, the agent can invent facts to fill gaps, which weakens `docs/canon/` as SoT.

## Goals

1. Before **substantial** canon writes, `canon-write` runs a short clarify dialogue when the request is ambiguous.
2. Each clarify question is **one at a time**, with **multiple-choice options** and an explicit **recommended answer** plus a one-line rationale.
3. Cap at **three** questions per substantial-write gate; then proceed with writing under the existing workflow.
4. **Skip** clarify when the user request already resolves ambiguity.
5. Document the behavior in managed skill text and living canon `SKILLS.md`; add acceptance scenarios.

## Non-goals

- Everyday sync improvements (discovering affected sections / proposing patches) — separate spec
- Prose-quality rules beyond not inventing facts — separate spec
- Shared interview protocol for bootstrap/contract
- CLI changes, contract/template changes, new section kinds
- Requiring every session to persist assumptions into template `Open questions` (optional escape hatch only; see Edge cases)
- Changing the rule that skills never patch application code

## Decisions

| Topic | Choice |
| --- | --- |
| Delivery | Skill-only: `embedded/skills/canon-write/SKILL.md` (+ installed mirror / upgrade path as repo already does) |
| Canon sync | Update `docs/canon/SKILLS.md` responsibility text for `canon-write` |
| When to ask | Substantial writes only (new meaning, invariant change, non-trivial factual sync) |
| When to skip | Request already supplies the facts/decision needed to write honestly |
| Question shape | One question per turn; A/B/C (+ optional D other); state recommended option + why |
| Cap | At most 3 clarify questions before writing |
| Docs↔code stale ask | Keep; same MCQ+recommendation format; counts toward the 3 if in the same pre-write gate |
| User says “just pick” | Use the recommended option, state that briefly, write |
| Structure changes | Clarify does not replace `canon-contract` handoff |

## Clarify protocol

### Substantial vs non-substantial

**Substantial:** adding or changing meaning, scope, invariants, behavioral claims, or non-trivial factual sync across sections.

**Non-substantial (no clarify gate):** typos, link fixes, heading/order polish that does not change meaning, validate-only runs, pure structural handoff already covered by contract workflow.

### Skip rule

If the user’s request already closes the ambiguity (concrete prose, explicit decisions, unambiguous facts), state briefly that clarify is unnecessary and proceed to the normal write workflow.

### Ask loop

Otherwise, before writing:

1. Ask **one** question (single decision axis).
2. Offer **A/B/C** (optional **D** = other / freeform).
3. Mark the **recommended** option and give **one sentence** why.
4. Wait for the answer.
5. Ask another question only if writing would still require inventing a material fact.
6. Stop after **three** questions, then write.

After skip or answers: existing workflow — templates, affected sections, no app-code edits, `doc-canon validate` before claiming success.

## Edge cases

| Case | Behavior |
| --- | --- |
| User declines to choose / “write yourself” | Take the recommended option; say so; write |
| Still blocked after 3 questions | Prefer writing from recommendations; if a remaining fact would be pure invention, optionally leave it under the section’s **Open questions** (not required every session) |
| Request needs a new section kind / contract change | Run clarify as needed for content intent, then stop and invoke `canon-contract` |
| `future_plans/**` edits | Same clarify protocol; keep initiatives directional (no task lists / coding prompts) |

## Files to change (implementation)

- `embedded/skills/canon-write/SKILL.md` — add **Clarify before substantial writes** (after Safety, before Workflow); early Workflow step references it; keep existing safety/validate/discrepancy rules
- `.cursor/skills/canon-write/SKILL.md` — keep in sync with embedded (or via existing upgrade mechanism used in this repo)
- `docs/canon/SKILLS.md` — note clarify-before-invent (MCQ + recommendation) on `canon-write`
- `docs/acceptance/skill-scenarios.md` — scenarios: ambiguous request → one MCQ with recommendation → edit + validate; explicit request → skip clarify → write

Optional (not required): one sentence in `docs/guides/usage-flows.md` day-to-day flow.

## Out of scope follow-ups

- Everyday sync scout/execute for `canon-write` (related to P0 efficiency, separate design)
- Prose quality / anti-bloat authoring rules
- Unifying interview UX across bootstrap, write, and contract

## Success criteria

- An ambiguous substantial write request yields a single MCQ with a stated recommendation before canon files change
- A fully specified request does not force ritual questions
- After answers (or skip), validate still gates success claims
- No CLI, contract, or template churn in this change
