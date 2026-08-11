# Architecture

## Summary

Two layers: a deterministic **CLI** (`doc-canon`) owns schema, scaffold, structural validation, inventory, and report merge for `source: cli` findings; an **agent layer** (Cursor skills + pointer rule / AGENTS block) owns interview, authorship, semantic audit, and discrepancy dialogue. Skills must call the CLI and must not invent structure outside the local contract. Agents discover a small working set from `INDEX.md` (Scout → Expand) before deep reads—quality over thrift; no pack/search CLI in MVP.

## System context

| Actor | Role |
| --- | --- |
| Maintainer / user | Runs CLI; confirms contract changes; decides docs_stale vs code_stale |
| Cursor agent | Runs managed skills; edits only `docs/canon/**` for canon work |
| Target repository | Holds `docs/canon/` (SoT), managed skills/rules/AGENTS block, optional `.doc-canon/` artifacts |
| npm package `doc-canon` | Ships CLI binary plus embedded templates, skills, and rules copied on `init` / `upgrade-skills` |

## Building blocks

- **CLI entry & shared** (`src/cli.ts`, `src/paths.ts`, `src/version.ts`) — commander wiring, root/`.doc-canon` path helpers, package/`skills_stamp` constants
- **CLI commands** (`src/commands/*`) — `init`, `upgrade-skills`, `validate`, `check`, `report`
- **Contract** (`src/contract/*`) — parse and schema-check the YAML machine block in `CANON_CONTRACT.md`
- **Validate** (`src/validate/*`) — required files, headings, INDEX↔contract agreement, stamp checks
- **Agnostic ignore** (`src/agnostic/*`) — default exclude globs plus contract `policies.ignore` matching (via `micromatch`)
- **Inventory** (`src/inventory/*`) — language-agnostic tree walk; applies ignore helpers when listing the repo
- **Report** (`src/report/*`) — merge CLI findings; preserve `source: skill`
- **Scaffold / embedded** (`src/scaffold/*`, `embedded/**`) — default templates, skills, pointer rule, AGENTS block
- **Future plans skeleton** (`src/scaffold/ensure-future-plans.ts`) — idempotently ensures `future_plans/INDEX.md`, its templates, and the contract/INDEX rows exist; `init` creates a fresh required section, `upgrade-skills` migrates existing repos onto it without touching existing initiative prose
- **Future plans validate zone** (target, ships with `canon-future-plan` — see `CLI.md`) — `future_plans/*.md` other than `INDEX.md` are exempt from the "not listed in contract" orphan check; validate instead parses the Initiatives table in `future_plans/INDEX.md` (File column) and requires INDEX↔disk agreement plus required `FUTURE_PLAN` headings on each linked file. Initiatives are **not** per-file contract sections — only `future-plans-index` stays a registered, required section; root `INDEX.md` Sections never list individual initiative files.
- **Agent skills** (copied into `.cursor/skills/`) — bootstrap, write, audit, contract; `canon-future-plan` (target, not yet shipped)

## Key flows

1. **Bootstrap** — `init` scaffolds, including a required `future_plans/INDEX.md`; `canon-bootstrap` interviews (empty) or extract-then-freeze (non-empty); then `validate`. After success, only `docs/canon/` is SoT.
2. **Feature change** — intentional new/changed behavior: coding agents invoke `canon-write` first (they do not edit `docs/canon/**` themselves), optionally sync/write a project-local design/plan when large, wait after substantial canon edits for user go-ahead, then implement application code. Distinct from post-hoc everyday sync and from `code_stale` coding tasks.
3. **Validate** — structural fail-closed checks; need not write `report.json`.
4. **Check** — validate + inventory + CLI findings in `.doc-canon/report.json`; does not edit canon prose or `DISCREPANCIES.md`.
5. **Audit / resolve** — `canon-audit` semantic pass + user decision; apply order: successful apply → set `decision` → Open→Resolved when appropriate.
6. **Everyday sync** — human-invoked post-hoc `canon-write` / `canon-audit` after meaningful changes.
7. **Upgrade managed assets** — `upgrade-skills` refreshes skills/rules/AGENTS, ensures the `future_plans/INDEX.md` skeleton (contract entry, INDEX row, templates, index file) exists for repos scaffolded before it was required, and bumps `skills_stamp`, without wiping canon content.
8. **Future plans validate (target)** — for `future_plans/*.md` (except `INDEX.md`): not orphans; must have a matching `future_plans/INDEX.md` Initiatives row; must carry required `FUTURE_PLAN` headings; root `INDEX.md` Sections stay contract-only. Ships with `canon-future-plan`; until then this repo's contract still registers each initiative as an optional `future-p*` section (migration tracked in `future_plans/p0c-future-plans-authoring-skill.md`).

## Boundaries & non-responsibilities

- CLI does not invent prose; skills do not invent required files/section types/templates outside the contract.
- Canon skills never edit application code; code work goes to `DISCREPANCIES.md` with `coding_agent_prompt`.
- Content outside `docs/canon/` may be import sources during bootstrap, then is not SoT.
- Single root `docs/canon/` only (no multi-canon monorepo in MVP).

## Tech & constraints

- Node.js ≥20, TypeScript ESM package `doc-canon` 0.1.0
- Dependencies: `commander`, `yaml`, `micromatch`
- Unknown/incompatible major `schema_version` or too-old `skills_stamp` → validate fails closed
- Extra template headings allowed; missing required headings fail validate
- `policies.max_lines` default 400 (hinting / policy as implemented)

## Related canon

- [OVERVIEW.md](OVERVIEW.md) — purpose and scope
- [CLI.md](CLI.md) — command surface
- [SKILLS.md](SKILLS.md) — agent workflows
- [DISCREPANCIES.md](DISCREPANCIES.md) — conflict queue
