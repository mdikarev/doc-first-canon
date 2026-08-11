# CLI

## Purpose

Own the deterministic core of `doc-canon`: scaffold, structural validation, inventory, report I/O, and managed-asset copy — with no LLM calls and no invented prose.

## Scope

**Covers:** commands `init`, `validate`, `check`, `report`, `upgrade-skills`; contract parse/schema; heading and INDEX agreement checks; ignore-aware inventory; CLI finding merge; embedding default templates/skills/rules into target repos.

**Excludes:** interview, semantic audit judgements, discrepancy dialogue, and any application-code edits (those belong to skills or coding agents).

## Current state

MVP package `doc-canon@0.1.0` (Node ≥20, ESM). Entry: `bin/doc-canon.js` → compiled `dist/`. All commands accept `--root <path>` (default: cwd).

## Responsibilities

- Materialize default canon + managed Cursor assets on `init`, including a required `future_plans/INDEX.md` and its templates
- Fail closed on invalid contract YAML, incompatible `schema_version`, missing required files/headings, INDEX≠contract, too-old `skills_stamp`
- Refresh inventory and `source: cli` findings on `check` while preserving `source: skill`
- Refresh managed skills/rules/AGENTS block on `upgrade-skills` without wiping canon document content
- On `upgrade-skills`, idempotently migrate existing repos onto the `future_plans/INDEX.md` skeleton (contract section + templates entries, INDEX table row, index file) without overwriting existing initiative prose or templates, and bump `skills_stamp`
- On existing canon, `init` preserves canon prose; skills refresh only with `--force-skills` / upgrade path
- **(Target, ships with `canon-future-plan`)** Validate `future_plans/*.md` (except `INDEX.md`) via an INDEX-driven zone instead of per-file contract rows: exempt from the orphan check; each file must have a `future_plans/INDEX.md` Initiatives row; each must carry required `FUTURE_PLAN` headings
- **(Target, ships with `canon-future-plan`)** On `upgrade-skills`, strip obsolete optional `future-p*` contract section rows for initiatives under `future_plans/`, keeping the `future_plans/INDEX.md` section and on-disk initiative files untouched

## Interfaces

| Command | Behavior |
| --- | --- |
| `init` | Scaffold `docs/canon/`, templates, default contract (including required `future_plans/INDEX.md`), skills, pointer rule, AGENTS block; `--yes`, `--force-skills`, `--root` |
| `validate` | Schema + structure; exit ≠0 on errors; need not write report |
| `check` | validate + inventory + merge CLI findings into `.doc-canon/report.json` |
| `report` | Print last report.json to stdout (read-only) |
| `upgrade-skills` | Refresh managed assets from installed package; idempotently ensure `future_plans/INDEX.md` skeleton on pre-existing canons; bump `skills_stamp` |

Artifacts: `.doc-canon/inventory.json`, `.doc-canon/report.json` (may be gitignored in target repos).

## Dependencies

- `commander` — CLI parsing
- `yaml` — machine-block parse
- `micromatch` — ignore globs (via `src/agnostic/ignore.ts`)
- Embedded files under `embedded/` published with the package

## Invariants

- Never invents canon prose
- Never edits `DISCREPANCIES.md` or other canon content during `check` / `report`
- Report merge must not wipe skill-owned findings
- `doc-canon` must be on PATH for skills that spawn it

## Open questions

- None for MVP freeze; Claude Code overlay deferred.

## Related canon

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SKILLS.md](SKILLS.md)
- [OVERVIEW.md](OVERVIEW.md)
