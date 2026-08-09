# P3 — Production hardening

- **Status:** draft
- **Focus:** Ship and operate `doc-canon` as a reliable product (distribution, CI, versioning, multi-agent packaging).
- **Depends on:** Stable MVP behavior; may run **in parallel** with P0 once direction is clear
- **Unblocks:** External adopters, gated repos, non-Cursor agents

## Intent

Move from “works in this repo” to production-ready distribution and operational guarantees, without conflating that work with context-efficiency features.

## In scope

- npm publish, semver, and upgrade guidance for `schema_version` / `skills_stamp`
- CI usage of `doc-canon validate` / `check` as a gate (everyday sync can remain human/skill-invoked)
- Schema migrate story when major contract versions change
- Claude Code (or other IDE) distribution pack when ready
- Stronger acceptance automation where it pays off

## Out of scope

- Replacing the efficiency track (P0–P2)
- IDE/plugin UI as a required MVP deliverable
- Auto-editing application code from canon skills

## Absorbs into

Likely: `OVERVIEW.md` (scope/success), `CLI.md`, `SKILLS.md`, `README.md`, release docs.

## Open questions

- Publish cadence vs skills_stamp coupling
- Whether CI only validates structure or also fails on open discrepancies
- Order: publish first vs Claude pack first
