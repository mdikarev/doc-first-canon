# Architecture

## Summary

Two layers: a deterministic **CLI** (`doc-canon`) owns schema, scaffold, structural validation, inventory, report merge for `source: cli` findings, index build, and bounded canon search; an **agent layer** (Cursor + Claude Code overlays: dual skill trees, Cursor pointer rule / short `AGENTS.md` block, full-body `CLAUDE.md`) owns interview, authorship, semantic audit, discrepancy dialogue, and the Scout → Expand retrieval protocol. Skills must call the CLI and must not invent structure outside the local contract. Agents search for a small working set before deep reads and fall back to INDEX-first Scout when search fails closed—quality over thrift.

## System context

| Actor | Role |
| --- | --- |
| Maintainer / user | Runs CLI; confirms contract changes; decides docs_stale vs code_stale |
| Cursor agent | Runs managed skills from `.cursor/skills/`; always-on via `.cursor/rules/doc-canon.mdc` and short `AGENTS.md` block; edits only `docs/canon/**` for canon work |
| Claude Code agent | Runs the same managed skills from `.claude/skills/`; always-on via full pointer-rule body in `CLAUDE.md` (does not load `.cursor/rules`); edits only `docs/canon/**` for canon work |
| Target repository | Holds `docs/canon/` (SoT), `.cursor/**`, `.claude/skills/**`, `AGENTS.md`, `CLAUDE.md`, optional `.doc-canon/` artifacts |
| npm package `doc-canon` | Ships CLI binary plus embedded templates, skills, and rules dual-written on `init` / `upgrade-skills` |

## Building blocks

- **CLI entry & shared** (`src/cli.ts`, `src/paths.ts`, `src/version.ts`) — commander wiring, root/`.doc-canon` path helpers, package/`skills_stamp` constants
- **CLI commands** (`src/commands/*`) — `init`, `upgrade-skills`, `migrate`, `validate`, `check`, `report`, `index`, `search`
- **Contract** (`src/contract/*`) — parse and schema-check the YAML machine block in `CANON_CONTRACT.md`
- **Validate** (`src/validate/*`) — required files, headings, INDEX↔contract agreement, stamp checks
- **Agnostic ignore** (`src/agnostic/*`) — default exclude globs plus contract `policies.ignore` matching (via `micromatch`)
- **Inventory** (`src/inventory/*`) — language-agnostic tree walk; applies ignore helpers when listing the repo
- **Report** (`src/report/*`) — merge CLI findings; preserve `source: skill`
- **Scaffold / embedded** (`src/scaffold/*`, `embedded/**`) — default templates, skills, pointer rule, short `AGENTS.md` block, full-body `CLAUDE.md` upsert
- **Future plans skeleton** (`src/scaffold/ensure-future-plans.ts`) — idempotently ensures `future_plans/INDEX.md`, its templates, and the contract/INDEX rows exist; `init` creates a fresh required section, `upgrade-skills` migrates existing repos onto it without touching existing initiative prose
- **Required-gap ensure** (`src/scaffold/ensure-required-gaps.ts`) — creates missing required files/templates and INDEX rows vs the target contract only
- **Future plans validate zone** — `future_plans/*.md` other than `INDEX.md` are exempt from the "not listed in contract" orphan check; validate instead parses the Initiatives table in `future_plans/INDEX.md` (File column) and requires INDEX↔disk agreement plus required `FUTURE_PLAN` headings on each linked file. Initiatives are **not** per-file contract sections — only `future-plans-index` stays a registered, required section; root `INDEX.md` Sections never list individual initiative files.
- **Agent skills** (dual-copied into `.cursor/skills/` and `.claude/skills/`) — bootstrap, write, audit, contract, future-plan
- **Index sync** (`src/index/*`) — hash-driven logical rebuild of a local BM25 index over `docs/canon/**/*.md`: unchanged content hashes are a no-op, any create/update/delete triggers a full rebuild from all current docs (no posting-level incremental updates); poll-based watch (`doc-canon index --watch`, default 2000 ms, `--interval`) with a pid-locked single instance and `--stop`; a thin stable reader facade (`openCanonIndex` from `doc-canon/index-reader`) lets `searchCanon` consume the dual `.doc-canon/index-manifest.json` + `.doc-canon/bm25-index.json` artifacts without ad-hoc JSON parsing
- **Code AST index** (`src/code-index/*`) — the code-side probe, a separate artifact from the canon BM25 index: source-root discovery (VCS root up-search, manifest-driven roots for the six supported languages, extension fallback; explicit `.doc-canon/code-index.json` config > manifests > extension scan), a uniform tree-sitter WASM extraction pipeline (`@vscode/tree-sitter-wasm`, pinned) normalized into a shared `{ name, kind, signature, file, line, endLine, scope }` model, and syntactic references (same-file anchors, import/export edges, in-scope local bindings); deterministic byte-identical dual artifact `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json` read via an `openCodeIndex` reader-facade (same dual-artifact pattern as `openCanonIndex`); hash-driven freshness (any create/update/delete or `grammar_versions` divergence triggers a full rebuild) with poll-based watch and a separate pid-lock; freshness is reported independently (`code_index_stale` → warn, `code_index_missing` → fail closed)
- **Retrieval** (`searchCanon` from `doc-canon/search`) — opens the dual index artifacts through `openCanonIndex`, ranks indexed documents, and reads live canon files for bounded snippet windows; the thin `doc-canon search` CLI and skills consume the resulting context pack

## Key flows

1. **Bootstrap** — `init` scaffolds, including a required `future_plans/INDEX.md` and dual Cursor/Claude managed overlays; `canon-bootstrap` interviews (empty) or extract-then-freeze (non-empty); then `validate`. After success, only `docs/canon/` is SoT.
2. **Feature change** — intentional new/changed behavior: coding agents invoke `canon-write` first (they do not edit `docs/canon/**` themselves), optionally sync/write a project-local design/plan when large, wait after substantial canon edits for user go-ahead, implement application code, then close with `canon-audit` (sibling-section and docs↔code drift that spot write may miss). Distinct from post-hoc everyday sync and from `code_stale` coding tasks.
3. **Validate** — structural fail-closed checks; need not write `report.json`.
4. **Check** — validate + inventory + CLI findings in `.doc-canon/report.json`; does not edit canon prose or `DISCREPANCIES.md`.
5. **Audit / resolve** — `canon-audit` semantic pass + user decision; apply order: successful apply → set `decision` → Open→Resolved when appropriate.
6. **Everyday sync** — human-invoked post-hoc `canon-write` / `canon-audit` after meaningful changes.
7. **Upgrade managed assets** — `upgrade-skills` refreshes dual skill trees, Cursor rule, `AGENTS.md`, and `CLAUDE.md`, ensures the `future_plans/INDEX.md` skeleton (contract entry, INDEX row, templates, index file) exists for repos scaffolded before it was required, and bumps `skills_stamp`, without wiping canon content.
8. **Migrate** — precheck schema `1` → gap-fill → `upgrade-skills` (overlays + future_plans skeleton + stamp + validate).
9. **Future plans validate** — for `future_plans/*.md` (except `INDEX.md`): not orphans; must have a matching `future_plans/INDEX.md` Initiatives row; must carry required `FUTURE_PLAN` headings; root `INDEX.md` Sections stay contract-only.
10. **Retrieve canon context** — `openCanonIndex` → `searchCanon` (`doc-canon/search`) → CLI/skills. Ranking uses the P0b artifacts, while snippets come from live files. P1 owns retrieval and the pack, not index construction, artifact IO, hashes, or watch behavior.
11. **Build code AST index** — `doc-canon code-index build` discovers source roots, parses source files with tree-sitter WASM into the normalized model, and writes the deterministic dual artifact; unchanged hashes are a no-op, any change or `grammar_versions` divergence triggers a full rebuild. `code-index search` and agent rules for code-index-first analysis land with P2b/P2c.

## Boundaries & non-responsibilities

- CLI does not invent prose; skills do not invent required files/section types/templates outside the contract.
- Canon skills never edit application code; code work goes to `DISCREPANCIES.md` with `coding_agent_prompt`.
- Content outside `docs/canon/` may be import sources during bootstrap, then is not SoT.
- Single root `docs/canon/` only (no multi-canon monorepo in MVP).

## Tech & constraints

- Node.js ≥20, TypeScript ESM package `doc-canon` 0.1.1
- Dependencies: `commander`, `yaml`, `micromatch`, `@vscode/tree-sitter-wasm` (code-index extraction)
- Unknown/incompatible major `schema_version` or too-old `skills_stamp` → validate fails closed
- Extra template headings allowed; missing required headings fail validate
- `policies.max_lines` default 400 (hinting / policy as implemented)

## Related canon

- [OVERVIEW.md](OVERVIEW.md) — purpose and scope
- [CLI.md](CLI.md) — command surface
- [SKILLS.md](SKILLS.md) — agent workflows
- [DISCREPANCIES.md](DISCREPANCIES.md) — conflict queue
