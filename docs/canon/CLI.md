# CLI

## Purpose

Own the deterministic core of `doc-canon`: scaffold, structural validation, inventory, report I/O, and managed-asset copy — with no LLM calls and no invented prose.

## Scope

**Covers:** commands `init`, `validate`, `check`, `report`, `upgrade-skills`; contract parse/schema; heading and INDEX agreement checks; ignore-aware inventory; CLI finding merge; embedding default templates/skills/rules into target repos.

**Excludes:** interview, semantic audit judgements, discrepancy dialogue, and any application-code edits (those belong to skills or coding agents).

## Current state

MVP package `doc-canon@0.1.0` (Node ≥20, ESM). Entry: `bin/doc-canon.js` → compiled `dist/`. All commands accept `--root <path>` (default: cwd).

## Responsibilities

- Materialize default canon + managed Cursor assets on `init`
- Fail closed on invalid contract YAML, incompatible `schema_version`, missing required files/headings, INDEX≠contract, too-old `skills_stamp`
- Refresh inventory and `source: cli` findings on `check` while preserving `source: skill`
- Refresh managed skills/rules/AGENTS block on `upgrade-skills` without wiping canon document content
- On existing canon, `init` preserves canon prose; skills refresh only with `--force-skills` / upgrade path

## Interfaces

| Command | Behavior |
| --- | --- |
| `init` | Scaffold `docs/canon/`, templates, default contract, skills, pointer rule, AGENTS block; `--yes`, `--force-skills`, `--root` |
| `validate` | Schema + structure; exit ≠0 on errors; need not write report |
| `check` | validate + inventory + merge CLI findings into `.doc-canon/report.json` |
| `report` | Print last report.json to stdout (read-only) |
| `upgrade-skills` | Refresh managed assets from installed package |

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
