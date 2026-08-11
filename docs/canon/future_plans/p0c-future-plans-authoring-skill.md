# P0c — Future plans authoring skill

- **Status:** refining
- **Focus:** A dedicated agent skill (`canon-future-plan`) that authors directional initiatives under `future_plans/` from the `FUTURE_PLAN` template, keeps prose clear and non-checklist, and keeps `future_plans/INDEX.md` in sync.
- **Depends on:** Existing `FUTURE_PLAN` / `FUTURE_PLANS_INDEX` templates and status vocabulary (`draft` → `refining` → `implementing` → `absorbed`)
- **Unblocks:** Consistent capture of new initiatives without ad-hoc structure; an INDEX-driven validate zone that drops per-initiative contract registration
- **Design:** [2026-08-11-future-plans-authoring-skill-design.md](../../superpowers/specs/2026-08-11-future-plans-authoring-skill-design.md) — approved decisions this initiative now follows; living canon (`SKILLS.md`, `ARCHITECTURE.md`, `CLI.md`, this INDEX) was updated to describe the target shape ahead of CLI/skill code (canon-first)

## Intent

Today, adding an initiative is split across everyday prose (`canon-write`) and structural registration (`canon-contract`), so agents often improvise shape, numbering, or INDEX rows. The future shape is a dedicated managed skill, `canon-future-plan`, that reliably **writes** initiatives the way this repo already drafts them: template headings preserved, directional only (no task dump), and INDEX status/order/links updated in the same pass — with no per-file contract registration step.

## In scope

- New managed skill `canon-future-plan`: capture or refine an initiative from user intent
- Authoring from registered `FUTURE_PLAN` (required headings; established metadata bullets such as Status / Focus / Depends / Unblocks / Design allowed)
- Maintaining `future_plans/INDEX.md`: table row, status column, and short ordering notes when priority changes
- Clear rules that initiatives stay directional — not checklists, sprint plans, or coding-agent prompts
- `canon-write` write handoff: stop and hand off any `future_plans/**` create/refine/status request to `canon-future-plan`; `canon-write` keeps only absorbing shipped outcomes into living sections, then hands the `absorbed` status / INDEX update back to `canon-future-plan`
- `doc-canon validate` INDEX-driven zone for `future_plans/*.md` (except `INDEX.md`): orphan-exempt; INDEX↔disk agreement; required `FUTURE_PLAN` headings — replaces per-initiative contract rows

## Out of scope

- Replacing living SoT authorship (`canon-write` for root sections)
- Turning `future_plans/` into a roadmap/task tracker (`docs/roadmap/`, tickets, `DISCREPANCIES.md` stay the execution home)
- Changing status vocabulary or inventing a new template kind without `canon-contract`
- Implementation of P0b cache, P1 retrieval, P2 extractors, or P3 hardening content
- Declarative generic `managed_subdir` / glob policy in the contract YAML (hardcoded `future_plans/` zone for this delivery)

## Absorbs into

`SKILLS.md` (new `canon-future-plan` responsibility, narrowed `canon-write` handoff), `ARCHITECTURE.md` (INDEX-driven `future_plans/` validate zone), `CLI.md` (validate + `upgrade-skills` behavior for the zone), the embedded skill package / `skills_stamp` bump, `future_plans/INDEX.md` "How to use", and `docs/acceptance/skill-scenarios.md`.

## Open questions

Resolved (see design spec linked above):

- Packaging: new managed skill `canon-future-plan`, not an extension of `canon-write`.
- Contract registration: no per-initiative `future-p*` rows; only `future-plans-index` stays required. Validate becomes INDEX-driven (Initiatives table ↔ disk, `FUTURE_PLAN` headings).
- Write handoff: `canon-write` always stops and hands off `future_plans/**` create/refine/status requests to `canon-future-plan`; absorb splits across both skills.
- Numbering: `pN` + optional letter suffix; priority is table row order plus a short note under the table.

Still open (tracked in the design spec's "Open follow-ups"):

- Whether `absorbed` initiatives are removed from disk or kept as historical rows.
- Later generalization of INDEX-driven validate zones beyond `future_plans/`.
