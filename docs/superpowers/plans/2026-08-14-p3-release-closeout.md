# P3 release close-out Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put `doc-canon@0.1.0` on the public npm registry, confirm `npx` install works, tag `v0.1.0` on origin, and absorb P3.

**Architecture:** No application-code change. Maintainer runs existing `npm run release` (`scripts/release.sh`). This plan only verifies the registry, creates a git tag, and updates `future_plans/` via `canon-future-plan`. Living canon already describes `migrate`, adopter CI, and dual-write.

**Tech Stack:** npm registry, git tags, `doc-canon` CLI (`validate`), `canon-future-plan` skill.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-14-p3-release-closeout-design.md`.
- Do **not** run `npm publish` or `npm run release` from an unattended agent. Task 2 is a hard user gate.
- Do **not** edit `docs/canon/**` from a coding agent; absorb uses **`canon-future-plan`** only.
- Do **not** change `scripts/release.sh` to add git tag/push.
- Do **not** force-push tags (`git push --force` / `git push --force origin v0.1.0`).
- Do **not** rename the unscoped package `doc-canon` if the name is taken.
- Do **not** add `.github/workflows`.
- Do **not** absorb P3 until `npx --yes doc-canon --help` lists `migrate`.
- Package version to publish is `0.1.0` (`package.json`).
- Tag name is exactly `v0.1.0`.
- Initiative absorb is gated on green `npx` only; the close-out is not fully done until origin also has `v0.1.0`.

---

## File Structure

```text
# External (not a repo file)
npm registry package doc-canon@0.1.0
git tag v0.1.0 (local + origin)

# Future plans (via canon-future-plan — Task 5 only)
docs/canon/future_plans/p3-production-hardening.md   # Status → absorbed; past-tense remaining-work sentences
docs/canon/future_plans/INDEX.md                     # row Status + trailing blurb

# Do not touch
src/**                                               # no code in this close-out
scripts/release.sh                                   # already correct
package.json                                         # stay at 0.1.0
.github/workflows                                    # must remain absent
docs/canon/OVERVIEW.md, CLI.md, …                    # living SoT already matches; canon-write only on post-publish drift
```

---

### Task 1: Preflight (no publish)

**Files:** none modified

**Interfaces:**
- Consumes: current `package.json` `"version": "0.1.0"`; `scripts/release.sh` already in repo
- Produces: confirmation that this tree is the intended `0.1.0` publish candidate and that npm auth exists on the maintainer machine

- [x] **Step 1: Confirm package version and release script**

Run:

```bash
node -p "require('./package.json').version"
test -f scripts/release.sh && grep -n "npm publish" scripts/release.sh
test ! -d .github/workflows && echo "no-workflows-ok"
```

Expected:
- first line: `0.1.0`
- `scripts/release.sh` contains a line `npm publish` (not `git tag`, not `git push`)
- `no-workflows-ok`

If version is not `0.1.0`, stop. Do not bump or publish a different version in this plan.

- [x] **Step 2: Confirm npm login on the maintainer machine**

Ask the user to run (or run only if this session is already their interactive maintainer shell):

```bash
npm whoami
```

Expected: a username printed, exit 0.

If `ENEEDAUTH` / not logged in: stop. Tell the user to `npm login` and resume Task 2. Do not attempt publish.

- [x] **Step 3: Working tree check**

Run:

```bash
git status --porcelain
git log -1 --oneline
```

Expected: no staged/unstaged source or canon diffs. Untracked `.DS_Store` files may exist and must **not** be committed. HEAD should be the commit intended for `v0.1.0` (includes migrate, LICENSE, CHANGELOG, release script, close-out spec).

If there are unrelated code/canon diffs: stop and ask the user. Do not publish a dirty tree.

- [x] **Step 4: Commit**

Skip. Nothing to commit.

---

### Task 2: Maintainer publish (hard user gate)

**Files:** none in git (registry side effect only)

**Interfaces:**
- Consumes: Task 1 green; `npm run release` → `scripts/release.sh`
- Produces: `doc-canon@0.1.0` on the public npm registry **or** a hard stop (do not continue)

- [x] **Step 1: Ask the user** to run from the repo root on a machine with `npm login`:

```bash
npm run release
```

The script must: `npm test` → `npm run build` → `node bin/doc-canon.js validate --root <repo>` → `npm pack --dry-run` requiring `LICENSE`, `CHANGELOG.md`, `README.md` in the listing → `npm publish`.

- [x] **Step 2: Do not proceed** until the user reports that the command exited 0 and printed npm publish success (or paste the tail of the log).

If the user reports failure:

- test/build/validate/pack failed → fix in a **new** plan/session; do **not** publish
- name taken / 403 / no permission → stop; do **not** rename `doc-canon` in this close-out
- user has not run it yet → wait

Agents: do **not** run `npm run release` or `npm publish` unless the user explicitly typed that they want this session to publish **and** `npm whoami` already succeeded in Task 1.

- [x] **Step 3: Commit**

Skip. Publish does not change git.

---

### Task 3: Verify registry install

**Files:** none modified

**Interfaces:**
- Consumes: Task 2 publish success
- Produces: evidence `doc-canon@0.1.0` is fetchable and `migrate` is in `--help`. This is the absorb gate.

- [x] **Step 1: View the published version**

Run:

```bash
npm view doc-canon version
```

Expected: `0.1.0`

If 404: stop. Publish did not land (or has not propagated). Wait/retry `npm view` once or twice; do not tag; do not absorb.

- [x] **Step 2: One-shot CLI from the registry**

Run:

```bash
npx --yes doc-canon --help
```

Expected: exit 0; help text includes a `migrate` command (the word `migrate` as a listed command, not only in prose).

If `migrate` is missing: stop. Do not tag. Do not absorb.

- [x] **Step 3: Commit**

Skip. Verification does not change git.

---

### Task 4: Git tag `v0.1.0` and push to origin

**Files:** none (tag only)

**Interfaces:**
- Consumes: Task 3 green (`npm view` = `0.1.0` and `npx --help` lists `migrate`)
- Produces: tag `v0.1.0` pointing at the published commit, present on `origin`

- [x] **Step 1: Refuse if the tag already points at a different commit**

Run:

```bash
git rev-parse HEAD
git rev-parse v0.1.0 2>/dev/null || echo "tag-absent"
```

- If `tag-absent`: continue to Step 2.
- If `v0.1.0` exists and SHA equals `HEAD`: skip Step 2 (tag already local); go to Step 3.
- If `v0.1.0` exists and SHA differs from `HEAD`: **stop**. Do not `git tag -f`. Ask the user.

- [x] **Step 2: Create the local tag**

Run:

```bash
git tag v0.1.0
```

Expected: exit 0. No `-f`. Lightweight tag is correct (`git tag v0.1.0`, not `git tag -a` unless the user later asks).

- [x] **Step 3: Push the tag**

Run:

```bash
git push origin v0.1.0
```

Expected: origin accepts `v0.1.0`. No `--force`.

If push fails (auth, network, rejected): do **not** force-push. Record the failure. Task 5 (absorb) **may** still run because Task 3 was green. Task 6 must **not** claim the close-out complete until this push succeeds. Retry this step later.

- [x] **Step 4: Confirm origin has the tag**

Run:

```bash
git ls-remote --tags origin 'refs/tags/v0.1.0'
```

Expected: a line with `refs/tags/v0.1.0` (and not `refs/tags/v0.1.0^{}` pointing at a different commit than local `HEAD` if that peel line is present).

- [x] **Step 5: Commit**

Skip. Tags are not commits.

---

### Task 5: Absorb P3 via `canon-future-plan`

**Files:**
- Modify (via skill only): `docs/canon/future_plans/p3-production-hardening.md`
- Modify (via skill only): `docs/canon/future_plans/INDEX.md`
- Do not edit living root SoT in this task unless the skill’s absorb handoff reports drift and the user then runs `canon-write`

**Interfaces:**
- Consumes: Task 3 green (required). Task 4 may still be outstanding.
- Produces: P3 status `absorbed`; INDEX row `absorbed`; INDEX blurb no longer says P3 is `implementing`

- [x] **Step 1: Confirm living canon already matches (absorb precondition)**

The skill must not rewrite OVERVIEW/CLI/SKILLS/README. Confirm these already contain the checkpoint (read-only):

- `docs/canon/OVERVIEW.md` In scope lists `migrate`; Success mentions npm / `npx` / `migrate`
- `docs/canon/CLI.md` has a `migrate` row
- `docs/canon/SKILLS.md` describes Cursor + Claude dual-write
- `README.md` has Install via npm/`npx` and an Adopter CI `validate` example

If any of those are missing: **stop** and tell the user to run `canon-write` first. Do not mark absorbed.

- [x] **Step 2: Invoke `canon-future-plan`**

Ask the user to run `/canon-future-plan` (or invoke the skill) with absorb-only intent. Do not edit `docs/canon/**` from a coding agent.

Content the skill must land:

**`docs/canon/future_plans/p3-production-hardening.md`**

1. Metadata `- **Status:** absorbed` (replace `implementing`).
2. Keep Focus / Depends / Unblocks.
3. Design line may add the close-out spec next to the existing checkpoint spec:

```markdown
- **Design:** [`docs/superpowers/specs/2026-08-12-adopter-ready-release-design.md`](../../superpowers/specs/2026-08-12-adopter-ready-release-design.md); close-out: [`docs/superpowers/specs/2026-08-14-p3-release-closeout-design.md`](../../superpowers/specs/2026-08-14-p3-release-closeout-design.md)
```

4. Replace the Intent paragraph that still says remaining work is unpublished with past tense. Keep the first Intent paragraph. Second and third become:

```markdown
The Claude Code **universal dual-write** overlay is absorbed into living OVERVIEW/CLI/SKILLS/README. Public npm `0.1.0`, `migrate`, and adopter CI docs have landed; this initiative is absorbed.
```

5. **Absorbs into** — replace the “likely / when … land” wording with:

```markdown
## Absorbs into

`OVERVIEW.md` (scope/success), `CLI.md` (`migrate` and upgrade guidance), `ARCHITECTURE.md`, `GLOSSARY.md`, `SKILLS.md`, `README.md`, `docs/guides/usage-flows.md`, `docs/acceptance/skill-scenarios.md`.
```

6. Do **not** add checklists, sprint tasks, or `coding_agent_prompt` blocks. Keep **Open questions** as the already-decided list.
7. Keep required `FUTURE_PLAN` headings: Intent, In scope, Out of scope, Absorbs into, Open questions.

**`docs/canon/future_plans/INDEX.md`**

1. Initiatives row 3:

```markdown
| 3 | Production hardening | absorbed | [p3-production-hardening.md](p3-production-hardening.md) |
```

2. Replace the trailing blurb after the table. It must **not** say P3 is `implementing`. Use:

```markdown
P0, P0c, P0b, P1, and P3 are absorbed. P2 (pluggable extractors) remains draft.
```

- [x] **Step 3: Validate**

Run:

```bash
doc-canon validate --root .
```

If `doc-canon` is not on PATH:

```bash
npx --yes doc-canon validate --root .
```

Expected: exit 0.

Do not claim absorb success if validate fails.

- [x] **Step 4: Commit** (only files the skill changed under `docs/canon/future_plans/`)

```bash
git add docs/canon/future_plans/p3-production-hardening.md docs/canon/future_plans/INDEX.md
git commit -m "$(cat <<'EOF'
docs: absorb P3 after public npm 0.1.0

EOF
)"
```

---

### Task 6: Close-out done criteria

**Files:** none new

**Interfaces:**
- Consumes: Tasks 3–5
- Produces: a pass/fail against the spec “Testing / verification” list. Optional throwaway migrate smoke is **not** a blocker.

- [x] **Step 1: Re-check registry and CLI**

Run:

```bash
npm view doc-canon version
npx --yes doc-canon --help
```

Expected: `0.1.0`; help lists `migrate`.

- [x] **Step 2: Re-check origin tag**

Run:

```bash
git ls-remote --tags origin 'refs/tags/v0.1.0'
```

Expected: tag present. If missing: close-out is **not** complete; retry Task 4. Absorb (Task 5) may already be done — that is allowed.

- [x] **Step 3: Re-check initiative status**

Run:

```bash
grep -n "Status" docs/canon/future_plans/p3-production-hardening.md | head -1
grep -n "Production hardening" docs/canon/future_plans/INDEX.md
```

Expected:
- P3 file: `absorbed`
- INDEX row: `absorbed`
- INDEX blurb does not contain `P3 is \`implementing\``

- [x] **Step 4: Confirm no workflows were added**

Run:

```bash
test ! -d .github/workflows && echo "no-workflows-ok"
```

Expected: `no-workflows-ok`

- [x] **Step 5: Optional smoke (not a blocker)**

If the user wants it, follow `docs/acceptance/skill-scenarios.md` section “Install from npm and migrate” on a throwaway repo. Failure there is a new bug, not a reason to revert absorb, unless `npx doc-canon --help` itself regressed (then reopen Task 3).

- [x] **Step 6: Commit**

Skip unless Step 5 forced a code/docs fix (out of scope for this plan — open a new fix, do not expand P3).

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Maintainer-only `npm run release`; agents never `npm publish` | 2 |
| `npm view doc-canon version` → `0.1.0` | 3, 6 |
| `npx --yes doc-canon --help` lists `migrate` | 3, 6 |
| Absorb forbidden until green `npx` | 3 gate → 5 |
| `git tag v0.1.0` + `git push origin v0.1.0`; no force | 4 |
| Tag exists on other SHA → stop | 4 Step 1 |
| Tag push failed: absorb may proceed; close-out incomplete until tag exists | 4 Step 3, 6 Step 2 |
| Absorb via `canon-future-plan`; no ad-hoc `docs/canon/**` | 5 |
| Living canon already matches; `canon-write` only on drift | 5 Step 1 |
| `doc-canon validate` after absorb | 5 Step 3 |
| No `.github/workflows` | 1, 6 |
| Do not rename package if name taken | 2 |
| Do not change `scripts/release.sh` | File Structure + Task 1 |
| Throwaway migrate checklist not a status blocker | 6 Step 5 |

## Execution notes

- Task 2 is a hard stop. Subagent-driven execution still requires the human to run `npm run release` before Task 3.
- Task 5 requires the `canon-future-plan` skill (or the user running it). Coding agents must not patch `docs/canon/**` themselves.
- Do not implement migrate, release.sh, LICENSE, or README in this plan — they already shipped under `docs/superpowers/plans/2026-08-12-adopter-ready-release.md`.
