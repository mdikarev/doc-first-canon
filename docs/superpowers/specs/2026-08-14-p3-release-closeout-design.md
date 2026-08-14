# P3 release close-out — Design Spec

**Date:** 2026-08-14  
**Status:** Approved  
**Approach:** Publish `doc-canon@0.1.0`, verify registry install, tag `v0.1.0` on origin, then absorb P3  
**Related initiative:** `docs/canon/future_plans/p3-production-hardening.md`  
**Parent spec:** [`2026-08-12-adopter-ready-release-design.md`](2026-08-12-adopter-ready-release-design.md)

## Problem

The adopter-ready checkpoint is implemented in-repo: `migrate`, MIT/`CHANGELOG`, local `npm run release`, README/guides, and living canon already match. P3 is still `implementing` because `doc-canon` is not on the public npm registry (`npm view doc-canon` is 404). Until that publish is real, the OVERVIEW success signal (“an adopter can install from npm”) is false.

## Goals

1. First public `doc-canon@0.1.0` via existing `npm run release` (maintainer machine, already logged in).
2. Confirm the published package is installable: `npm view doc-canon version` and `npx --yes doc-canon --help` lists `migrate`.
3. Place git tag `v0.1.0` on origin at the commit that was published.
4. Absorb P3 (`canon-future-plan`): status `absorbed`, INDEX row and blurb updated. Do not rewrite living canon unless post-publish drift appears.

## Non-goals

- Expanding P3 (schema rewriter, dogfood GitHub Actions, marketplace, P2, extra hardening)
- Agent-run `npm publish` or handling of npm credentials
- Force-pushing tags
- Renaming the unscoped package `doc-canon` if the name is taken
- Making the full throwaway-repo acceptance checklist (`Install from npm and migrate`) a blocker for absorb
- Changing `scripts/release.sh` to include git tag/push

## Decisions

| Topic | Choice |
| --- | --- |
| Remaining scope | Close the existing checkpoint; do not enlarge P3 |
| Order | Publish → verify registry/`npx` → tag+push `v0.1.0` → absorb |
| Who publishes | Maintainer only (`npm run release`); agents never call `npm publish` |
| Git tag | Yes: `git tag v0.1.0` and `git push origin v0.1.0` after green verify |
| Absorb gate | Forbidden until `npx --yes doc-canon --help` shows `migrate` |
| Tag vs absorb | Initiative absorb is gated on green `npx` only. If tag/push fails after that, chase the tag separately; the close-out is not fully done until origin has `v0.1.0` |
| Living canon | Task-2 absorb already landed; `canon-write` only on post-publish drift |
| Release script | Unchanged: test → build → validate this repo → pack-check → publish; no git |

## Sequence

1. Maintainer runs `npm run release` (needs `npm login`). Script: `npm test` → `npm run build` → `node bin/doc-canon.js validate --root <repo>` → `npm pack --dry-run` requiring `LICENSE`, `CHANGELOG.md`, `README.md` → `npm publish`.
2. Verify: `npm view doc-canon version` is `0.1.0` (or the `package.json` `0.1.x` that was published). `npx --yes doc-canon --help` lists `migrate`. On 404 or missing `migrate`, stop: no tag, no absorb.
3. `git tag v0.1.0` then `git push origin v0.1.0`. No `--force`. If `v0.1.0` already exists on a different SHA, stop and resolve by hand.
4. Invoke `canon-future-plan` (not ad-hoc edits under `docs/canon/**`): P3 status `absorbed`; `future_plans/INDEX.md` row and the “P3 is implementing” blurb updated. Run `doc-canon validate` before claiming absorb success.

## Error handling

- Release fails on test/build/validate/pack: fix, do not publish.
- Package name taken or publish forbidden: stop; do not change the package name in this close-out.
- Publish succeeded, tag/push did not: npm is the ship; absorb may run after green `npx`; retry the tag before calling this close-out complete.
- Absorb before green `npx`: not allowed.

## Testing / verification

Done when all of the following are true:

1. `npm view doc-canon version` → `0.1.0` (or published `0.1.x`).
2. `npx --yes doc-canon --help` shows `migrate`.
3. Origin has tag `v0.1.0` on the published commit (chase if step 3 failed after a green verify).
4. `p3-production-hardening.md` and `future_plans/INDEX.md` say `absorbed`; INDEX no longer says P3 is `implementing`.
5. This repository still has no `.github/workflows` added by this work.

Optional after absorb (not a status blocker): throwaway-repo smoke from `docs/acceptance/skill-scenarios.md` section “Install from npm and migrate”.

## Related

- Initiative: [`docs/canon/future_plans/p3-production-hardening.md`](../../canon/future_plans/p3-production-hardening.md)
- Parent plan: [`docs/superpowers/plans/2026-08-12-adopter-ready-release.md`](../plans/2026-08-12-adopter-ready-release.md) (Task 10)
- Living SoT: [`docs/canon/OVERVIEW.md`](../../canon/OVERVIEW.md), [`docs/canon/CLI.md`](../../canon/CLI.md)
