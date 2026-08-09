# Skill acceptance scenarios

These human-run checklists cover the MVP agent flows. Automated skill execution is out of scope.

## Bootstrap an empty project

- [ ] Run `canon-bootstrap` in an empty repository without a canon.
- [ ] Confirm it calls `doc-canon init`, interviews for purpose and scope, and uses registered templates.
- [ ] Confirm mandatory documents and `INDEX.md` are populated.
- [ ] Confirm `doc-canon validate` passes before success is reported.

## Bootstrap a non-empty project

- [ ] Run `canon-bootstrap` where code and legacy documentation already exist.
- [ ] Confirm the extract-then-freeze flow inventories the repository and treats legacy docs as import sources.
- [ ] Confirm proposed extra sections require interview and contract confirmation.
- [ ] Confirm only `docs/canon/` is treated as SoT after validation; legacy files and application code remain unchanged.

## Resolve docs stale

- [ ] Produce a grounded docs↔code conflict and choose docs as stale.
- [ ] Confirm the canon edit succeeds and validates before `decision: docs_stale` is written.
- [ ] Confirm the entry then moves from Open to Resolved in the same session.

## Resolve code stale

- [ ] Produce a grounded docs↔code conflict and choose code as stale.
- [ ] Confirm no application code is edited.
- [ ] Confirm a detailed Open coding task is written before `decision: code_stale`.
- [ ] Confirm the entry stays Open in that session.

## Resolved on a later audit

- [ ] Begin with an Open `code_stale` discrepancy, then align the application code outside the canon skills.
- [ ] Run `doc-canon check` alone and confirm it does not edit `DISCREPANCIES.md`.
- [ ] Run a later `canon-audit`; confirm it reproduces no drift and only then moves the entry to Resolved.

## Add a new template kind

- [ ] Request a project-specific section kind through `canon-contract`.
- [ ] Confirm the intended contract/template diff is shown and explicit user confirmation is required.
- [ ] Confirm the template is saved and registered before any document uses it.
- [ ] Confirm validation passes and other repositories' defaults are unchanged.

## Pointer rule and AGENTS block after init

- [ ] Initialize a target repository.
- [ ] Confirm the installed Cursor rule is always-on and points agents to `docs/canon/INDEX.md`.
- [ ] Confirm `AGENTS.md` contains exactly one block bounded by `<!-- doc-canon:start -->` and `<!-- doc-canon:end -->`.
- [ ] Confirm existing content outside those markers is preserved.

## Future plans are directional; contract adds optional initiative

- [ ] Confirm `future_plans/INDEX.md` is required and scaffolded by `doc-canon init`, and migrated onto pre-existing canons by `doc-canon upgrade-skills`.
- [ ] Ask `canon-write` to add a new post-MVP initiative; confirm it registers `future_plans/<slug>.md` as `required: false` via `canon-contract`, adds an INDEX row, and writes directional prose (no checklists, sprint plans, or `coding_agent_prompt` entries).
- [ ] Confirm the initiative stays out of behavioral SoT: `canon-audit` does not treat its prose as current-behavior ground truth when judging docs↔code drift.
- [ ] Mark the initiative `absorbed` after implementation and confirm outcomes move into the relevant living canon sections.

## Check preserves skill findings

- [ ] Seed `.doc-canon/report.json` with both `source: skill` and `source: cli` findings.
- [ ] Run `doc-canon check`.
- [ ] Confirm CLI findings refresh without removing or changing skill-owned findings.
- [ ] Run `canon-audit` and confirm only it marks unconfirmed skill findings `status: stale`.
