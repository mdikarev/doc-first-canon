# P12 — Report JSON and filter flags

- **Status:** draft
- **Focus:** Explicit `--json` and status/kind/source filter flags on `doc-canon report`, so
  skills fetch exactly the findings they need (e.g. open-only) without reading the whole report.
- **Depends on:** P9 (structured issue shape shared with `check` findings).
- **Unblocks:** The `canon-audit` "open findings for LLM context" rule becomes a one-liner instead
  of a filtering ritual over full report JSON.

## Intent

`doc-canon report` already prints `.doc-canon/report.json` to stdout, but there is no explicit
`--json` flag and no way to request a subset. `canon-audit` currently filters the full report to
open findings by hand (the skill even warns against pasting stale bodies into context). This
initiative adds `--json` (explicit machine form) and filters — status (`open` / `stale`), kind
(`structure` / `consistency` / `conflict` / `drift` / `discipline`), and source
(`cli` / `skill`) — so skills pull a bounded open-only view in one call.

## In scope

- `doc-canon report --json` as an explicit machine-mode flag (human default unchanged).
- Filter flags: `--status`, `--kind`, `--source`; combinable, stable JSON output.
- Read-side filters live in `report`; `check` write parity is kept where cheap.

## Out of scope

- Report schema changes or finding lifecycle (stale marking stays `canon-audit`'s job).
- Editing report content — read-side filtering only.

## Absorbs into

`CLI.md` (`report` surface), `SKILLS.md` (canon-audit open-findings rule), `GLOSSARY.md`.

## Open questions

- Flag naming (single `--status` with repeats vs comma list) and whether `--json` should imply a
  different default when piped.
