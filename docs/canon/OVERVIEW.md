# Overview

## Purpose

`doc-canon` is a deterministic CLI plus managed agent skills (Cursor and Claude Code overlays) that scaffold, validate, and maintain a structured documentation **canon** under `docs/canon/`, so agents share one source of truth for project context.

## Problem & context

Ad-hoc agent docs drift from code, contradict each other, and diverge in shape when different LLMs edit them. Teams need durable rules for what documentation exists, how it is shaped, how it stays current, and how docs↔code conflicts are resolved with a human in the loop.

## Primary users / agents

- Maintainers bootstrapping or refreshing canon in a repository
- Coding agents (Cursor and Claude Code) that must read and update canon via managed skills
- Humans resolving docs↔code discrepancies when skills surface conflicts

## Scope

### In scope

- CLI: `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, `code-index build`, `code-index search`
- Per-repo canon tree, templates, and `CANON_CONTRACT.md`
- `future_plans/INDEX.md`: required, scaffolded canon subtree for directional post-MVP initiatives (not behavioral SoT, not a task tracker); `upgrade-skills` migrates existing repos onto it
- Managed skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`) dual-written to `.cursor/skills/` and `.claude/skills/`; Cursor pointer rule; short `AGENTS.md` managed block; full pointer-rule body in `CLAUDE.md`
- Language-agnostic inventory and machine-readable reports under `.doc-canon/`
- Local BM25 index over `docs/canon/**/*.md` via `doc-canon index` (manifest + bm25 artifacts under `.doc-canon/`; optional poll `--watch`)
- Deterministic AST index over discovered source roots via `doc-canon code-index build` (separate `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`; optional poll `--watch`) — the code-side probe, distinct from the canon documentation index
- Bounded context packs via public `searchCanon` (`doc-canon/search`) and the human/JSON `doc-canon search` CLI, with ranked paths, scores, and live-file snippets
- Bounded code packs via public `searchCodeIndex` (`doc-canon/code-search`) and the human/JSON `code-index search` CLI, with substring symbol hits (`--kind`/`--file` filters), syntactic `--refs` mode, and live-file snippet windows
- Human-in-the-loop discrepancy workflow (skills never patch application code)

### Out of scope

- IDE/plugin UI; Claude Code marketplace / plugin packaging (dual-write overlay is in scope)
- Deep multi-language AST as the primary audit engine
- Automatic application-code patches
- Multiple canons per monorepo; git hooks / CI as the everyday sync trigger (MVP is human-invoked)
- Dogfood CI in this product repo as everyday sync; adopter CI is documented `validate`, not a required MVP hook

## Success signals

- After bootstrap, a repo has a valid canon, local contract, installed skills, and pointer guidance to `docs/canon/`
- Different LLMs keep the same required document shapes via in-repo templates
- `validate` / `check` fail closed on structural breakage; semantic conflicts stay open until the user decides
- Skills invoke `doc-canon` on PATH and never edit application code
- An adopter can install from npm (`npx` / global) and bring an existing canon current with `migrate`

## Future plans (product feature)

`future_plans/INDEX.md` is a required, scaffolded canon section (`init` creates it; `upgrade-skills` migrates existing repos onto it) that holds **directional** post-MVP initiatives — not behavioral SoT and not a development task tracker. This repository's own post-MVP direction (efficiency first, then hardening) is captured there as initiatives; see [future_plans/INDEX.md](future_plans/INDEX.md). After implementation, outcomes are absorbed into the living canon sections above and the initiative is marked `absorbed` or removed. Rationale: `docs/superpowers/specs/2026-08-09-production-path-roadmap-design.md`.

## Related canon

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers and flows
- [CLI.md](CLI.md) — deterministic core commands
- [SKILLS.md](SKILLS.md) — agent layer
- [GLOSSARY.md](GLOSSARY.md) — terms
- [future_plans/INDEX.md](future_plans/INDEX.md) — directional initiatives (not SoT, not a task tracker)
- Import provenance (not SoT): `README.md`, `docs/guides/usage-flows.md`, `docs/superpowers/specs/2026-08-07-doc-first-canon-design.md`
