# P3 — Production hardening

- **Status:** implementing
- **Focus:** Ship and operate `doc-canon` as a reliable product (distribution, CI, versioning, multi-agent packaging).
- **Depends on:** Stable MVP behavior; may run **in parallel** with P0 once direction is clear
- **Unblocks:** External adopters, gated repos, non-Cursor agents
- **Design (Claude overlay slice):** [`docs/superpowers/specs/2026-08-12-claude-code-overlay-design.md`](../../superpowers/specs/2026-08-12-claude-code-overlay-design.md)

## Intent

Move from “works in this repo” to production-ready distribution and operational guarantees, without conflating that work with context-efficiency features.

## In scope

- npm publish, semver, and upgrade guidance for `schema_version` / `skills_stamp`
- CI usage of `doc-canon validate` / `check` as a gate (everyday sync can remain human/skill-invoked)
- Schema migrate story when major contract versions change
- Claude Code packaging via **universal dual-write** on `init` / `upgrade-skills`: identical skills under `.cursor/skills/` and `.claude/skills/`; short managed block in `AGENTS.md`; full pointer-rule body (no Cursor YAML frontmatter) in `CLAUDE.md`; Cursor `.mdc` unchanged — **not** a separate `--agent` / `--claude` flag or marketplace plugin
- Stronger acceptance automation where it pays off

## Out of scope

- Replacing the efficiency track (P0–P2)
- IDE/plugin UI as a required MVP deliverable
- Claude Code marketplace / plugin packaging (separate from dual-write overlay)
- Auto-editing application code from canon skills

## Absorbs into

Likely: `OVERVIEW.md` (scope/success), `CLI.md`, `SKILLS.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `README.md`, release docs. Claude dual-write overlay slice absorbs into those living sections when the overlay ships; remaining P3 items stay open until their own absorb.

## Open questions

- Publish cadence vs skills_stamp coupling
- Whether CI only validates structure or also fails on open discrepancies
- Schema migrate timing relative to first public publish
