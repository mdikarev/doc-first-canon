# P11 — CLI fix: mechanical structural repairs

- **Status:** draft
- **Focus:** A deterministic `doc-canon fix` (with `--dry-run`) for machine-repairable structural
  errors, so skills stop hand-editing INDEX tables and contract-mandated skeletons.
- **Depends on:** P9 (structured issues give `fix` a machine-readable input).
- **Unblocks:** Shorter repair loops in `canon-write`, `canon-contract`, and `upgrade-skills`.

## Intent

Some structural failures are fully mechanical: missing Sections rows in `INDEX.md` vs the contract,
missing required headings that a template defines, a missing `future_plans/INDEX.md` skeleton, or a
contract-required section file absent on disk. Today agents hand-edit these in canon skills and rely
on `validate` only to confirm afterwards. This initiative adds an explicit, separate `fix` step —
never part of `validate` (which stays fail-closed) — that applies only machine-determinable repairs
and previews them with `--dry-run`.

## In scope

- `doc-canon fix --dry-run` (default) and `--apply`: machine-determinable repairs only.
- Repairs: INDEX Sections rows ↔ contract sync; template-driven required-heading insertions;
  `future_plans/INDEX.md` skeleton; contract-required section stubs from their registered templates.
- Deterministic, idempotent output; a per-run change list; exit code reflects applied changes.
- Fix never invents prose or semantic content; placeholder sections are template stubs only.

## Out of scope

- Semantic rewrites, orphan deletion, or any judgement call (those stay in skills / `canon-audit`).
- Changing what `validate` flags (validate semantics are P9's concern; fix only repairs).
- Editing application code or `DISCREPANCIES.md`.

## Absorbs into

`CLI.md` (`fix` command), `SKILLS.md` (canon-write / canon-contract repair steps),
`ARCHITECTURE.md`, `GLOSSARY.md`.

## Open questions

- Which checks deserve a fix vs a hard error (repairability matrix in the design pass).
- Whether `fix` may write `CANON_CONTRACT.md` YAML defaults or only section/INDEX files.
