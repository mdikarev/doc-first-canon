# P0c — Future plans authoring skill

- **Status:** draft
- **Focus:** A dedicated agent skill that authors directional initiatives under `future_plans/` from the `FUTURE_PLAN` template, keeps prose clear and non-checklist, and keeps `future_plans/INDEX.md` in sync.
- **Depends on:** Existing `FUTURE_PLAN` / `FUTURE_PLANS_INDEX` templates and status vocabulary (`draft` → `refining` → `implementing` → `absorbed`)
- **Unblocks:** Consistent capture of new initiatives without ad-hoc structure; safer handoff into `canon-contract` registration

## Intent

Today, adding an initiative is split across everyday prose (`canon-write`) and structural registration (`canon-contract`), so agents often improvise shape, numbering, or INDEX rows. The future shape is a skill that reliably **writes** initiatives the way this repo already drafts them: template headings preserved, directional only (no task dump), and INDEX status/order/links updated in the same pass.

## In scope

- Skill workflow to capture or refine an initiative from user intent
- Authoring from registered `FUTURE_PLAN` (required headings; established metadata bullets such as Status / Focus / Depends / Unblocks allowed)
- Maintaining `future_plans/INDEX.md`: table row, status column, and short ordering notes when priority changes
- Clear rules that initiatives stay directional — not checklists, sprint plans, or coding-agent prompts
- Handoff to `canon-contract` when a new file must be registered (`required: false`, template `FUTURE_PLAN`)

## Out of scope

- Replacing living SoT authorship (`canon-write` for root sections)
- Turning `future_plans/` into a roadmap/task tracker (`docs/roadmap/`, tickets, `DISCREPANCIES.md` stay the execution home)
- Changing status vocabulary or inventing a new template kind without `canon-contract`
- Implementation of P0b cache, P1 retrieval, P2 extractors, or P3 hardening content

## Absorbs into

Likely: `SKILLS.md` (new or extended skill responsibility), embedded skill package / upgrade stamp, possibly a short pointer in `future_plans/INDEX.md` “How to use”, and acceptance scenarios for initiative authoring.

## Open questions

- New managed skill (e.g. `canon-future-plan`) vs a focused extension of `canon-write`
- How much of contract registration the skill may drive vs always stopping for explicit `canon-contract` confirmation
- Numbering / priority conventions when inserting “earliest” initiatives among existing `p0*` / `pN` files
- Whether refine (`draft` → `refining`) and absorb flows belong in the same skill or stay with `canon-write`
