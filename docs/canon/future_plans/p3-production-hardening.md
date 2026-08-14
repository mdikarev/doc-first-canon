# P3 — Production hardening

- **Status:** implementing
- **Focus:** Adopter-ready first public release (distribution, upgrade/migrate, adopter CI guidance).
- **Depends on:** Stable MVP behavior; P0–P1 absorbed; Claude dual-write overlay already shipped
- **Unblocks:** External adopters, gated repos, non-Cursor agents
- **Design:** [`docs/superpowers/specs/2026-08-12-adopter-ready-release-design.md`](../../superpowers/specs/2026-08-12-adopter-ready-release-design.md)

## Intent

Ship the first public, adopter-ready `doc-canon` checkpoint: install from npm, bring an existing canon current with `migrate`, and run a documented adopter CI recipe — without conflating that work with the efficiency track or with dogfood CI in this product repo.

The Claude Code **universal dual-write** overlay is already shipped. Absorb that slice into living OVERVIEW/CLI/SKILLS/README when those sections already match. Remaining P3 is done when public publish, `migrate`, and docs land; then absorb this initiative.

## In scope

- Public npm `0.1.x` so adopters can `npx doc-canon` / global-install without cloning
- `doc-canon migrate`: fill gaps against the target repo’s existing contract, then `upgrade-skills`; unsupported `schema_version` fails closed (no YAML rewriter)
- Soft coupling of npm semver ↔ `skills_stamp` (asset changes bump both; CLI-only bugfix may bump npm patch only)
- Adopter CI recipe: `validate` as the recommended gate; `check` optional; do not fail CI on open `DISCREPANCIES.md` entries
- Package hygiene: MIT `LICENSE`, `CHANGELOG`, pack contents suitable for publish
- Local `npm run release` (`scripts/release.sh`); no dogfood GitHub Actions in this repo

## Out of scope

- Dogfood GitHub Actions CI / workflows in this repository
- Failing CI on open discrepancies
- Prose rewrite in CLI (section bodies, initiatives, or `DISCREPANCIES.md`)
- Schema-version rewriter / auto-migrate across unsupported `schema_version` jumps
- Claude Code marketplace / plugin packaging
- P2 pluggable extractors
- IDE / plugin UI
- Skills editing application code

## Absorbs into

Likely: `OVERVIEW.md` (scope/success), `CLI.md` (`migrate` and upgrade guidance), `ARCHITECTURE.md`, `GLOSSARY.md`, `SKILLS.md`, `README.md`, release and adopter-CI docs.

Claude dual-write absorbs into living OVERVIEW/CLI/SKILLS/README when those already match. Remaining checkpoint outcomes absorb when public npm `0.1.x`, `migrate`, and adopter docs land.

## Open questions

None remaining. Prior items decided:

- Publish cadence vs `skills_stamp`: soft couple (asset changes bump both; CLI-only bugfix may bump npm patch only).
- CI vs discrepancies: `validate` is the recommended gate; `check` optional; do not fail CI on open discrepancies.
- Schema migrate timing vs first public publish: `migrate` ships in this checkpoint; unsupported `schema_version` fails closed (no rewriter).
