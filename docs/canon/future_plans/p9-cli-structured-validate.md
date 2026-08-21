# P9 — CLI structured validate (`--json`)

- **Status:** draft
- **Focus:** Return structured validation issues (`{message, kind, paths, severity}`) from each
  validator and expose them machine-readably on the CLI, so skills and agents stop parsing human
  English text to classify findings.
- **Depends on:** None — pure CLI-surface hardening on the shipped `validate` / `check` pipeline.
- **Unblocks:** Machine-parseable feedback loops for `canon-write`, `canon-audit`, and adopter CI
  gates.

## Intent

`src/validate/validate.ts` carries a TODO: validators return English message strings, and
`check` classifies them by regexing the text (`validationErrorKind`, `validationErrorPaths` in
`src/commands/check.ts`). Agents consuming validation output must therefore parse prose to learn the
finding kind and affected paths. This initiative makes each validator return a structured issue
(`{message, kind, paths, severity}`), keeps the human output byte-stable, and adds `--json` to
`doc-canon validate` so skills, CI gates, and DSH agents read a stable machine shape without
guesswork.

## In scope

- Structured issue model shared by `validate`, `check`, and `report` findings
  (`source: cli`), with kind and paths set by validators instead of message regexes.
- `doc-canon validate --json`: stable JSON of errors + warnings; exit codes unchanged.
- `check` consumes the structured issues directly and drops the English-message classification.
- Human-facing `validate` output stays as-is (regression-tested).

## Out of scope

- Auto-repair of issues (that is P11).
- New validator rules or changed validation semantics — the set of what is checked is unchanged.
- Semantic audit judgements (owned by `canon-audit`, not the CLI).

## Absorbs into

`CLI.md` (`validate` surface, `--json`), `SKILLS.md` (`canon-write` / `canon-audit` success
gates), `ARCHITECTURE.md` (CLI building blocks), `GLOSSARY.md` (Validation issue term).

## Open questions

- Exact `--json` schema and its `schema_version`; whether warnings ride in the same array.
- Whether the structured issue shape should be identical to report findings (`F-NNN`) or a leaner
  transient form.
