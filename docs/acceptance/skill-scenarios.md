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
- [ ] Confirm the pointer rule / `AGENTS` block mention starting at `INDEX.md`, building a small working set, and expanding when unsure (guidance only—not a required chat ritual for coding agents).
- [ ] Confirm the pointer rule / `AGENTS` block state canon-first feature-change order (`canon-write` before application code; optional project-local spec/plan; substantial wait; application code; closing `canon-audit`; coding agents do not edit canon themselves).

## Feature-change order is canon-first

- [ ] Request intentional new or changed application behavior in a bootstrapped repo.
- [ ] Confirm the coding agent invokes **`canon-write`** (or asks the user to) and does **not** edit `docs/canon/**` itself before feature code.
- [ ] Confirm optional project-local design/plan is used only when the change is large; small unambiguous changes may go canon → code.
- [ ] Confirm that after a **substantial** canon write the agent waits for explicit user go-ahead before implementing; spot sync may proceed.
- [ ] Confirm that after application code the cycle closes with **`canon-audit`** on the affected topic.
- [ ] Confirm exceptions (pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits) may skip canon-first (including the closing audit).

## Future plans authoring uses canon-future-plan

- [ ] Confirm `future_plans/INDEX.md` is required and scaffolded by `doc-canon init`, and migrated onto pre-existing canons by `doc-canon upgrade-skills`.
- [ ] Ask `canon-future-plan` to add a new post-MVP initiative; confirm it creates `future_plans/<slug>.md` from `FUTURE_PLAN`, adds an Initiatives INDEX row, does **not** add a per-file contract section, and writes directional prose (no checklists, sprint plans, or `coding_agent_prompt` entries).
- [ ] Ask `canon-write` to add an initiative; confirm it stops and hands off to `canon-future-plan`.
- [ ] Confirm the initiative stays out of behavioral SoT: `canon-audit` does not treat its prose as current-behavior ground truth when judging docs↔code drift.
- [ ] After implementation, confirm `canon-write` absorbs outcomes into living sections, then `canon-future-plan` marks the initiative `absorbed` (INDEX status).

## Canon-write clarifies before substantial writes

- [ ] Ask `canon-write` to make a substantial but ambiguous canon change (missing a material decision).
- [ ] Confirm it asks **one** clarifying question with **A/B/C** options and an explicit **recommended** answer before editing `docs/canon/**`.
- [ ] Answer the question; confirm it may ask at most two more (three total), still one at a time, then edits and runs `doc-canon validate` before claiming success.
- [ ] Ask `canon-write` for a substantial change that already includes the concrete facts/decision.
- [ ] Confirm it **skips** clarify (states briefly that it is unnecessary) and writes + validates without ritual questions.

## Canon-write Scout Expand Execute before deep reads

- [ ] Ask `canon-write` for a substantial canon change.
- [ ] Confirm it briefly shows a working set (paths + stubs) and an expand verdict (`sufficient` or `need more`) before deep-reading section bodies.
- [ ] If invent-risk remains, confirm clarify runs **after** that expand gate (not before Scout).
- [ ] Confirm a legitimate expand (`need more` then more paths) is treated as success, not failure.
- [ ] Confirm it runs `doc-canon validate` before claiming success.

## Canon-audit Scout Expand Execute before deep reads

- [ ] Run `canon-audit` on a repo with inventory available.
- [ ] Confirm it runs `validate` then `check` as Scout inputs.
- [ ] Confirm it briefly shows a working set + expand verdict before deep-reading evidence paths.
- [ ] Confirm it expands until claims are evidence-backed rather than under-reading silently.

## Check preserves skill findings

- [ ] Seed `.doc-canon/report.json` with both `source: skill` and `source: cli` findings.
- [ ] Run `doc-canon check`.
- [ ] Confirm CLI findings refresh without removing or changing skill-owned findings.
- [ ] Run `canon-audit` and confirm only it marks unconfirmed skill findings `status: stale`.

## Scout uses search then Expand

- [ ] With a built index, ask `canon-write` for a substantial change; confirm Scout tries `doc-canon search` before dumping all canon files.
- [ ] Confirm the working set is seeded from pack paths and snippets.
- [ ] Confirm Expand still runs when the pack is thin or doubtful.

## Search missing index falls back

- [ ] In a repo without `.doc-canon` index artifacts, start Scout; confirm INDEX-first fallback plus an explicit hint to run `doc-canon index` (skill does not hard-stop).

## Post-write runs index

- [ ] After a successful substantive `docs/canon/**` write via a managed skill, confirm the skill runs one-shot `doc-canon index` (or surfaces watch-lock failure without fighting the lock).
