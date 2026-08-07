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
