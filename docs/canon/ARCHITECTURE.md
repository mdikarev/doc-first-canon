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
- **Agent skills** (copied into `.cursor/skills/`) — bootstrap, write, audit, contract

## Key flows

1. **Bootstrap** — `init` scaffolds, including a required `future_plans/INDEX.md`; `canon-bootstrap` interviews (empty) or extract-then-freeze (non-empty); then `validate`. After success, only `docs/canon/` is SoT.
2. **Validate** — structural fail-closed checks; need not write `report.json`.
3. **Check** — validate + inventory + CLI findings in `.doc-canon/report.json`; does not edit canon prose or `DISCREPANCIES.md`.
4. **Audit / resolve** — `canon-audit` semantic pass + user decision; apply order: successful apply → set `decision` → Open→Resolved when appropriate.
5. **Everyday sync** — human-invoked `canon-write` / `canon-audit` after meaningful changes.
6. **Upgrade managed assets** — `upgrade-skills` refreshes skills/rules/AGENTS, ensures the `future_plans/INDEX.md` skeleton (contract entry, INDEX row, templates, index file) exists for repos scaffolded before it was required, and bumps `skills_stamp`, without wiping canon content.

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
