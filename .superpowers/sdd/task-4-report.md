# Task 4 Report: `validate` command (structure)

## Status

Implemented the structural `validateCanon` API and wired `doc-canon validate --root <path>`.

## TDD

### RED

Added `tests/validate.test.ts` and the four requested fixture trees before production code.

Command:

```text
npm test -- tests/validate.test.ts
```

Observed expected failure:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'src/validate/validate.js'
tests: 16, pass: 15, fail: 1
```

### GREEN

After the minimal validator and CLI implementation:

```text
npm test -- tests/validate.test.ts
tests: 20, pass: 20, fail: 0
```

Final full suite:

```text
npm test
tests: 20, pass: 20, fail: 0
```

TypeScript build:

```text
npm run build
exit code: 0
```

## Remaining High review fixes

- Existing section and template candidates now use `realpathSync` for both the candidate and `docs/canon`; symlinks resolving outside the real canon root are rejected before file inspection or reads.
- `skills_stamp` must match dotted-numeric format before version comparison, so malformed values such as `1.x` produce a validation error.
- Added focused regression tests for an escaping section symlink (with an unsupported-platform skip) and a malformed skills stamp.

TDD RED:

```text
npx tsx --test tests/validate.test.ts
tests: 10, pass: 8, fail: 2
```

Verification:

```text
npx tsx --test tests/validate.test.ts
tests: 10, pass: 10, fail: 0

npm test
tests: 25, pass: 25, fail: 0

npm run build
exit code: 0
```

## Implemented

- Contract existence, parse, and schema error reporting.
- Numeric dotted `skills_stamp` comparison against `MIN_SKILLS_STAMP`.
- Required section and referenced-template existence checks.
- INDEX Sections-table agreement with required contract paths.
- Required heading validation from each section's registered template.
- Orphan canon Markdown detection outside `templates/`.
- Relative in-canon Markdown link checks.
- `max_lines` warnings.
- CLI output and success/failure exit code.
- Complete happy fixture plus missing-section, missing-headings, and index-mismatch fixtures.

## Self-review

- Scope remains structural; no check, inventory, or report merge behavior was added.
- `npm run build`, focused tests, full tests, lints, and `git diff --check` are clean.
- The only environment noise is npm's pre-existing `Unknown env config "devdir"` warning.

## Important/High review fixes

- Section and template paths are resolved with `path.resolve` and rejected when their relative path escapes `docs/canon`; escaped paths are never read.
- Existing section, template, contract, and index paths must be regular files. File inspection and reads now report validation errors instead of escaping `validateCanon` as exceptions.
- `max_lines` ignores the empty segment created by a trailing newline, so exactly-at-limit files do not warn.
- Added focused tests for section path traversal, a directory used as a section path, and exact/above `max_lines` boundaries.

Verification:

```text
npm test
tests: 23, pass: 23, fail: 0

npm run build
exit code: 0
```
