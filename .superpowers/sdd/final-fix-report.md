# Final Fix Report: Whole-branch review — Important findings

Branch: `feat/future-plans-productization`
Scope: fix the two "Important" findings from the whole-branch review. Minor findings were not addressed (per instructions, unless trivial and adjacent — none were).

## Important 1 — `String.replace` dollar-sign corruption

**Finding:** `String.prototype.replace(pattern, replacementString)` interprets `$&`, `$1`, etc. in the replacement string as special patterns. Several call sites passed YAML/markdown *content* as the literal 2nd argument, so any `$`-sequence inside that content (e.g. a glob like `**/$&cache/**` in `policies.ignore`) would get silently expanded/corrupted instead of inserted verbatim.

**Fixed call sites:**
- `src/scaffold/ensure-future-plans.ts`
  - `ensureContractYaml`: `contractMarkdown.replace(yamlText, updatedYaml)` → `contractMarkdown.replace(yamlText, () => updatedYaml)`
  - `ensureIndexTableRow`: `sectionsMatch[0].replace(body, updatedBody)` → `sectionsMatch[0].replace(body, () => updatedBody)`
- `src/commands/upgrade-skills.ts`
  - `upgradedContractMarkdown`: `markdown.replace(yaml, updatedYaml)` → `markdown.replace(yaml, () => updatedYaml)` (also switched the `skills_stamp` regex replacement to a replacer function for consistency, even though its replacement value can't itself contain `$`).

All replacements now use a replacer *function*, which passes the string through untouched — no special-pattern interpretation.

**Regression test added** (`tests/ensure-future-plans.test.ts`): `preserves literal $& in contract policies.ignore when rewriting the yaml block` — seeds `policies.ignore: ["**/$&cache/**"]` in a contract, forces a real rewrite (flips `future-plans-index` from optional back to required), and asserts the parsed output still contains the literal glob `**/$&cache/**`. Confirmed this test fails against the pre-fix code (YAML parse error from corrupted output) and passes with the fix.

## Important 2 — INDEX row detection not Sections-scoped

**Finding:** `ensureIndexTableRow`'s "already present" check used a whole-document regex (`/\|\s*future_plans\/INDEX\.md\s*\|/`) instead of scoping to the `## Sections` table the way insertion does. This meant:
- An unrelated pipe table elsewhere in `INDEX.md` that happens to mention the string `future_plans/INDEX.md` would cause the function to (incorrectly) skip appending the real Sections row.
- A Sections row referencing the path via a markdown link cell (e.g. `[future_plans/INDEX.md](future_plans/INDEX.md)`) would not match the plain-text regex and be missed by validation-consistent duplicate detection.

**Fix:** `ensureIndexTableRow` now reuses `sectionPathsFromIndex` from `src/validate/index-agreement.ts` (the same Sections-scoped, link-cell-aware parser used by `validateIndexAgreement`) to check whether `future_plans/INDEX.md` is already present, instead of a document-wide regex. This keeps insertion detection and validation semantics in agreement.

**Regression tests added** (`tests/ensure-future-plans.test.ts`):
- `appends the Sections row even when an unrelated table elsewhere mentions the future_plans path` — adds an out-of-scope pipe table mentioning the path outside `## Sections`; asserts the real Sections row is still appended.
- `does not duplicate the Sections row when it is present as a markdown link cell` — rewrites the existing Sections row's path cell as a markdown link; asserts no duplicate row is appended and the file is left untouched.

Both tests were confirmed to fail against the pre-fix code and pass with the fix.

## Verification

- Confirmed all three new tests fail against the pre-fix source (checked out old `ensure-future-plans.ts`/`upgrade-skills.ts` with the new tests in place) and pass against the fixed source.
- `npm run build` (tsc) — clean, no type errors.
- `npm test` (`required_permissions: ["all"]`, avoids sandboxed tsx IPC `EPERM`) → **73/73 tests pass, 0 fail** (70 pre-existing + 3 new regression tests).
- No linter errors on touched files.

## Commit (new, not amended, not pushed)

Both Important fixes land in the same file (`src/scaffold/ensure-future-plans.ts`) with intermixed hunks, so they are shipped as a single new commit together with `src/commands/upgrade-skills.ts` and the three regression tests:

- `<SHA>` — `fix: prevent replace() dollar-sign corruption and scope INDEX row detection`

(Exact SHA recorded below after commit.)

## Status

Both Important findings fixed with regression tests. Minor findings from the review were not in scope for this pass and were not touched.
