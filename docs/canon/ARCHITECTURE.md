# Architecture

## Summary

Two layers: a deterministic **CLI** (`doc-canon`) and an **agent layer**.

- The **CLI** owns schema, scaffold, structural validation, inventory, report merge for `source: cli` findings, index build, and bounded canon search.
- The **agent layer** (harness overlays for Cursor, Claude Code, and DSH: identical skill trees under
  `.cursor/skills/`, `.claude/skills/`, and `.dsh/skills/`; Cursor pointer rule / short `AGENTS.md`
  block; full-body `CLAUDE.md`; DSH reuses the `AGENTS.md`/`CLAUDE.md` always-on guidance and
  discovers skills under `.dsh/skills/`) owns interview, authorship, semantic audit, discrepancy
  dialogue, and the Scout → Expand retrieval protocol.

Skills must call the CLI and must not invent structure outside the local contract. Agents run
`doc-canon scout` when the index is available to obtain a small working-set manifest before deep reads;
if scout fails closed, they build the index and retry, then use INDEX-first only when building fails —
quality over thrift. `doc-canon search` / `code-index search` self-heal a stale index at the CLI layer
(rebuild then serve) and record every successful search in `.doc-canon/probe-log.jsonl`; `doc-canon
discipline` reports probe currency and gates on un-probed state. `doc-canon scout` composes both packs
into a working-set manifest (contract-role annotations + verdict hint) for the Scout step.

## System context

| Actor | Role |
| --- | --- |
| Maintainer / user | Runs CLI; confirms contract changes; decides docs_stale vs code_stale |
| Cursor agent | Runs managed skills from `.cursor/skills/`; always-on via `.cursor/rules/doc-canon.mdc` and short `AGENTS.md` block; edits only `docs/canon/**` for canon work |
| Claude Code agent | Runs the same managed skills from `.claude/skills/`; always-on via full pointer-rule body in `CLAUDE.md` (does not load `.cursor/rules`); edits only `docs/canon/**` for canon work |
| DSH agent | Runs the same managed skills from `.dsh/skills/`; always-on via the `AGENTS.md` and `CLAUDE.md` blocks (no dedicated rule file); edits only `docs/canon/**` for canon work |
| Target repository | Holds `docs/canon/` (SoT), `.cursor/**`, `.claude/skills/**`, `.dsh/skills/**`, `AGENTS.md`, `CLAUDE.md`, optional `.doc-canon/` artifacts |
| npm package `doc-canon` | Ships CLI binary plus embedded templates, skills, and rules written to the selected harnesses (Cursor / Claude Code / DSH) on `init` / `upgrade-skills` |

## Building blocks

- **CLI entry & shared** (`src/cli.ts`, `src/paths.ts`, `src/version.ts`) — commander wiring, root/`.doc-canon` path helpers, package/`skills_stamp` constants
- **CLI commands** (`src/commands/*`) — `init`, `upgrade-skills`, `migrate`, `validate`, `check`, `report`, `index`, `search`, `scout`
- **Contract** (`src/contract/*`) — parse and schema-check the YAML machine block in `CANON_CONTRACT.md`
- **Validate** (`src/validate/*`) — required files, headings, INDEX↔contract agreement, stamp checks; validators return structured issues (`kind`/`paths`/`severity`) and the CLI exposes `--json`
- **Agnostic ignore** (`src/agnostic/*`) — default exclude globs plus contract `policies.ignore` matching (via `micromatch`)
- **Inventory** (`src/inventory/*`) — language-agnostic tree walk; applies ignore helpers when listing the repo
- **Report** (`src/report/*`) — merge CLI findings; preserve `source: skill`
- **Scaffold / embedded** (`src/scaffold/*`, `embedded/**`) — default templates, skills, pointer rule, short `AGENTS.md` block, full-body `CLAUDE.md` upsert, harness-selected skill-tree copy (`.cursor` / `.claude` / `.dsh`)
- **Future plans skeleton** (`src/scaffold/ensure-future-plans.ts`) — idempotently ensures `future_plans/INDEX.md`, its templates, and the contract/INDEX rows exist:
  - `init` creates a fresh required section
  - `upgrade-skills` migrates existing repos onto it without touching existing initiative prose
- **Required-gap ensure** (`src/scaffold/ensure-required-gaps.ts`) — creates missing required files/templates and INDEX rows vs the target contract only
- **Future plans validate zone** — `future_plans/*.md` other than `INDEX.md` are exempt from the "not listed in contract" orphan check:
  - validate instead parses the Initiatives table in `future_plans/INDEX.md` (File column) and requires INDEX↔disk agreement plus required `FUTURE_PLAN` headings on each linked file
  - initiatives are **not** per-file contract sections — only `future-plans-index` stays a registered, required section; root `INDEX.md` Sections never list individual initiative files
- **Agent skills** (copied into the selected harnesses' skill trees: `.cursor/skills/`, `.claude/skills/`, `.dsh/skills/`) — bootstrap, write, audit, contract, future-plan
- **Indexing & retrieval** (`src/index/*`, `src/code-index/*`, `src/search/*`, `src/code-search/*`) — BM25 canon index, code AST index, and bounded retrieval; details in [INDEXING.md](INDEXING.md)

## Key flows

1. **Bootstrap** — `init` scaffolds, including a required `future_plans/INDEX.md` and harness-selected managed overlays (Cursor / Claude Code / DSH); `canon-bootstrap` interviews (empty) or extract-then-freeze (non-empty); then `validate`. After success, only `docs/canon/` is SoT.
2. **Feature change** — intentional new/changed behavior: coding agents invoke `canon-write` first
   (they do not edit `docs/canon/**` themselves), optionally sync/write a project-local
   design/plan when large, wait after substantial canon edits for user go-ahead, implement
   application code, then close with `canon-audit` (sibling-section and docs↔code drift that spot
   write may miss). Distinct from post-hoc everyday sync and from `code_stale` coding tasks.
3. **Validate** — structural fail-closed checks; need not write `report.json`.
4. **Check** — validate + inventory + CLI findings in `.doc-canon/report.json`; does not edit canon prose or `DISCREPANCIES.md`.
5. **Audit / resolve** — `canon-audit` semantic pass + user decision; apply order: successful apply → set `decision` → Open→Resolved when appropriate.
6. **Everyday sync** — human-invoked post-hoc `canon-write` / `canon-audit` after meaningful changes.
7. **Upgrade managed assets** — `upgrade-skills` refreshes the skill trees of the harnesses present
   in the repo (presence-detected via `.cursor/skills/`, `.claude/skills/`, `.dsh/skills/`;
   overridable with `--harnesses`), the Cursor rule, `AGENTS.md`, and `CLAUDE.md`, ensures the
   `future_plans/INDEX.md` skeleton (contract entry, INDEX row, templates, index file) exists for
   repos scaffolded before it was required, and bumps `skills_stamp`, without wiping canon content.
8. **Migrate** — precheck schema `1` → gap-fill → `upgrade-skills` (overlays + future_plans skeleton + stamp + validate).
9. **Future plans validate** — for `future_plans/*.md` (except `INDEX.md`): not orphans; must have a matching `future_plans/INDEX.md` Initiatives row; must carry required `FUTURE_PLAN` headings; root `INDEX.md` Sections stay contract-only.

## Boundaries & non-responsibilities

- CLI does not invent prose; skills do not invent required files/section types/templates outside the contract.
- Canon skills never edit application code; code work goes to `DISCREPANCIES.md` with `coding_agent_prompt`.
- Content outside `docs/canon/` may be import sources during bootstrap, then is not SoT.
- Single root `docs/canon/` only (no multi-canon monorepo in MVP).

## Tech & constraints

- Node.js ≥22.16 (the `node:sqlite` floor), TypeScript ESM package `doc-canon` 0.10.1
- Dependencies: `commander`, `yaml`, `micromatch`, `@vscode/tree-sitter-wasm` (code-index extraction), `node:sqlite` (built-in code-index store)
- Unknown/incompatible major `schema_version` or too-old `skills_stamp` → validate fails closed
- Extra template headings allowed; missing required headings fail validate
- `policies.max_lines` default 400 and `policies.max_line_length` default 500 (hinting / policy as implemented)

## Related canon

- [OVERVIEW.md](OVERVIEW.md) — purpose and scope
- [CLI.md](CLI.md) — command surface
- [INDEXING.md](INDEXING.md) — index artifacts, freshness, and retrieval
- [SKILLS.md](SKILLS.md) — agent workflows
- [DISCREPANCIES.md](DISCREPANCIES.md) — conflict queue
