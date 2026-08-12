# Adopter-ready first public release — Design Spec

**Date:** 2026-08-12  
**Status:** Approved; implementation plan in `docs/superpowers/plans/2026-08-12-adopter-ready-release.md`  
**Approach:** Rewrite P3 as adopter-ready checkpoint; ship `migrate` + npm `0.1.x` + docs; no dogfood GitHub Actions CI  
**Related initiative:** `docs/canon/future_plans/p3-production-hardening.md`

## Problem

Efficiency track (P0–P1) and the Claude dual-write overlay slice are largely done. The product still behaves like an in-repo tool: install via clone/`npm link`, no public npm package, no first-class `migrate` story, vague P3 open questions (CI vs discrepancies, stamp vs semver, schema migrate timing), and a P3 initiative that still reads like a mixed hardening bag rather than a clear “can give this to an adopter” checkpoint.

## Goals

1. First **public** `doc-canon@0.1.x` on npm so adopters can `npx doc-canon` / global install without cloning.
2. **`doc-canon migrate`**: bring a target repo up to the installed CLI (fill target-contract gaps, then `upgrade-skills`; no prose rewrites).
3. Clear **upgrade / versioning** guidance with soft coupling between npm semver and `skills_stamp`.
4. **Adopter CI guidance**: recommend `doc-canon validate` as the gate; document `check` as optional; never fail CI on open `DISCREPANCIES.md` by default.
5. **Local one-command release**: `npm run release` → `scripts/release.sh` (test → build → pack-check → publish); no GitHub Actions in this repo for that.
6. **Rewrite P3** (via `canon-future-plan`) to match this checkpoint; treat Claude dual-write as a shipped slice ready to absorb separately when living-canon drift is closed.
7. Package hygiene: MIT `LICENSE`, `CHANGELOG`, pack contents suitable for publish.

## Non-goals

- Dogfood GitHub Actions CI / workflows in **this** repository (local `npm test` before push remains the practice)
- Failing adopter CI on open discrepancy entries
- Auto-rewriting canon section prose or resolving discrepancies in CLI
- Full auto-migrate across arbitrary unsupported `schema_version` jumps (unsupported → fail closed + docs)
- Claude Code marketplace / plugin packaging
- P2 pluggable extractors
- IDE/plugin UI
- Skills editing application code
- Requiring a public GitHub repository to publish (npm and GitHub are independent; leave repo visibility as-is)

## Decisions

| Topic | Choice |
| --- | --- |
| Checkpoint shape | Adopter kit + public npm `0.1.x` (approach C) |
| P3 handling | Rewrite single P3 initiative to this checkpoint (approach 1); not a split P3b/P4; not “spec only, leave P3 baggy” |
| Own CI | Out of scope |
| Adopter CI recipe | `validate` as recommended gate; `check` optional/local (or optional in their CI); no Open-discrepancies fail |
| Migrate exists | Yes — first-class CLI command in this checkpoint |
| Migrate scope | Gaps vs the **target repo's existing contract** only; no prose rewrite; no default-kit injection |
| Migrate ↔ upgrade-skills | Gap-fill **first**, then public `upgrade-skills` (overlays + future_plans ensure + stamp + validate). Do not call `upgrade-skills` before missing required files exist — its trailing validate would abort migrate |
| Migrate schema | `0.1.x` has no schema rewriter: `schema_version` must already be `1`; otherwise fail closed |
| Migrate flags | `--root` only in v1 (no `--yes` / command `--dry-run`) |
| Migrate validate | No extra validate command: public `upgrade-skills` already ends in `validate`; that exit code is migrate’s |
| Semver ↔ skills_stamp | Soft couple: asset changes bump both; CLI-only bugfix may bump npm patch only |
| License | MIT (`LICENSE` + `package.json` `"license": "MIT"`) |
| Release UX | `npm run release` + `scripts/release.sh`; dry-run mode; git tag/push is a **separate documented step**, not part of the default script |
| Publish | Manual from maintainer machine after local tests |
| Claude overlay | Already shipped as P3 slice; absorb into living canon separately; do not re-expand scope here |

## P3 rewrite (directional)

Update `p3-production-hardening.md` / INDEX blurb via **`canon-future-plan`** (not ad-hoc edits, not coding-agent inventing tasks in the initiative body):

- **Focus:** Adopter-ready first public release (distribution, upgrade/migrate, adopter CI guidance).
- **In scope:** Matches Goals above (npm, migrate, soft versioning, docs/CI recipe, package hygiene, close prior open questions).
- **Out of scope:** Matches Non-goals (especially own CI, discrepancy CI fail, marketplace, P2, prose migrate).
- **Open questions:** Remove or resolve the three prior items (cadence/stamp → soft couple; CI vs discrepancies → validate-only gate; migrate vs first publish → migrate ships in same checkpoint as documented fail-closed unsupported jumps).
- **Claude slice:** Note as shipped; absorb when living OVERVIEW/CLI/SKILLS/README already match; remaining P3 done when publish + migrate + docs land and initiative can be absorbed.

Status stays a single marker (`refining` while authoring / `implementing` while building) — never a task dump inside `future_plans/`.

## Architecture

### Commands

| Command | Role |
| --- | --- |
| `upgrade-skills` | Unchanged primary role: refresh Cursor + Claude managed overlays; idempotent `future_plans` skeleton / related ensure behavior; bump `skills_stamp`. Remains the frequent “updated the CLI package, refresh assets” command. |
| `migrate` | Orchestrator for “bring this repo to current CLI”. Requires an existing canon + parseable `CANON_CONTRACT.md` (otherwise fail closed — that path is `init`). Sequence: (1) reject unsupported `schema_version` (anything other than `1`) with a docs pointer; do not rewrite YAML; (2) fill **target-contract** gaps only (see below); (3) run public `upgrade-skills` (fail → migrate fail). Exit code is that of `upgrade-skills` / its trailing `validate`. Do not add a second validate pass. |

**Step 2 — target-contract gaps only (not the CLI default kit):**

- Create missing template files the target contract already lists, from the matching embedded template. Never overwrite. If the contract names a template with no on-disk file and no embedded original, fail closed.
- Create a missing **required** section file listed in the target contract, using that section’s named template (now present on disk or just restored). Never overwrite an existing file.
- Add missing INDEX Sections **table rows** for contract sections that have no row (same idea as `ensure-future-plans` INDEX sync). Do not rewrite other INDEX prose. If `INDEX.md` itself is a missing required file, create it from its template first, then ensure the table rows.
- Leave `future_plans` skeleton ensure to `upgrade-skills` (step 3); do not duplicate that helper in gap-fill.
- Do **not** add sections, templates, or files that the target contract does not already require. Do not inject this repo’s extra sections (e.g. `CLI.md` / `SKILLS.md`) or otherwise reshape a custom contract toward `default-contract.ts`.
- Do not rewrite section body prose, initiative files, or `DISCREPANCIES.md`.

Idempotent: a second `migrate` on a repo that already matches its contract makes **no extra writes**. Exit code still follows `validate` (pre-existing heading/prose errors are not repaired).

Flags: `--root` only in v1. Dry-run belongs to `scripts/release.sh`, not to `migrate`.

### Versioning

- Document soft coupling in README/guides and briefly in living CLI/OVERVIEW when absorbing.
- Keep existing `MIN_SKILLS_STAMP` / validate fail-closed policy; clarify operator steps after installing a newer npm version (`migrate` recommended; `upgrade-skills` alone if schema already compatible and only assets needed).

### Release script

`package.json` → `"release": "scripts/release.sh"`:

1. `npm test`
2. `npm run build`
3. `doc-canon validate` in this repository (structural gate before publish)
4. `npm pack --dry-run` and require `LICENSE`, `CHANGELOG`, and `README` in the tarball listing
5. `npm publish` (with public access if required for the unscoped name `doc-canon`)

Git tag / push is **not** in this script. Document a separate maintainer step after a successful publish so a release cannot accidentally push.

`DRY_RUN=1` or `--dry-run`: run through pack, skip publish.

Pack must include MIT `LICENSE` and `CHANGELOG` (npm already ships `README` / `LICENSE` when present; add `CHANGELOG` to `"files"` if needed).

No GitHub Actions workflow is added for CI or release in this checkpoint.

### Documentation

- README EN/RU: npm install / `npx`; when to run `upgrade-skills` vs `migrate`; link to CI note.
- Guide (extend usage-flows or add a short CI validate guide): copy-paste example workflow **for adopter repos**; emphasize validate gate; check optional; discrepancies not a CI fail.
- Living canon updates via **canon-first** (`canon-write` / absorb) when behavior ships: CLI command list, OVERVIEW scope/success, glossary if needed.
- Acceptance scenarios updated for migrate + npm install path where applicable.

## Error handling

- Any orchestrator step failure aborts `migrate` (no silent continuation).
- `schema_version` other than `1`: non-zero exit **before** scaffold writes, message pointing at docs; no YAML rewrite and no partial contract/prose mutation.
- Malformed contract / missing canon root: fail closed (same posture as `upgrade-skills`); do not run `init`.
- Release script: non-zero if tests/build/publish fail; dry-run never calls publish.

## Testing

- Fixture: target contract already lists required sections; some required files/templates absent → `migrate` creates only those gaps; overlays refreshed; validate exit 0; second run makes no extra writes.
- Fixture: target contract omits a default-kit section the CLI would create on `init` → `migrate` does **not** add it.
- Existing section/initiative prose preserved.
- Unsupported `schema_version` → fail closed, no file corruption.
- `upgrade-skills` regressions still pass when invoked alone and via migrate.
- Release script dry-run smoke (no registry, no publish).
- No network/npm registry required in unit tests for migrate.

## Implementation notes (ordering)

1. Refine P3 via `canon-future-plan` to match this spec.
2. Canon-first living updates for `migrate` + release/versioning/CI guidance as behavior is defined (spot sync may proceed; substantial contract/command surface → user go-ahead before large code if required by repo rules).
3. Implement `migrate` + tests; wire CLI help.
4. Package hygiene (MIT `LICENSE`, `CHANGELOG`, `package.json` license field) + `scripts/release.sh`.
5. README/guides + acceptance.
6. Maintainer runs local tests and `npm run release` for first public `0.1.x`.
7. Absorb Claude slice and, when checkpoint complete, absorb P3 into living canon.

Execution tracking (tasks/PRs) stays outside `future_plans/` (roadmap/issues/as-used by the project).

## Done criteria

- `doc-canon` published on npm at `0.1.x` and installable via `npx` / global.
- `doc-canon migrate` documented, tested, and fills target-contract gaps then calls `upgrade-skills`.
- Soft versioning rule documented; prior P3 open questions closed as decided here.
- Adopter CI guidance published (validate gate; check optional).
- `npm run release` works locally with dry-run; real publish used for first release.
- P3 initiative text matches this checkpoint; Claude slice marked shipped / absorb path clear.
- No dogfood `.github/workflows` CI added as part of this work.

## Related

- Living SoT: [`docs/canon/INDEX.md`](../../canon/INDEX.md)
- Initiative: [`docs/canon/future_plans/p3-production-hardening.md`](../../canon/future_plans/p3-production-hardening.md)
- Prior path map: [`2026-08-09-production-path-roadmap-design.md`](2026-08-09-production-path-roadmap-design.md)
- Claude overlay slice: [`2026-08-12-claude-code-overlay-design.md`](2026-08-12-claude-code-overlay-design.md)
