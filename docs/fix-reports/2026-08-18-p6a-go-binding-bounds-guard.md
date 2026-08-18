# Fix report — P6a-Go composite-literal binding bounds guard

**Date:** 2026-08-18
**Fix commit:** 38a1072 (original fix-wave) — this report covers the follow-up critical-bug fix
**Follow-up commit:** (see git log for `fix: guard positional composite-literal binding against multi-value returns`)

## Context

Commit 38a1072 (F4) made `collectCompositeLiteralBindings` positional: each left-hand identifier in a `short_var_declaration`/`var_spec` is paired by index with its right-hand expression, skipping `_`. The prior version only ever considered the first identifier and first right-hand expression, which hid the length mismatch.

## The bug

A scoped re-review found the positional loop indexes `exprs[i]` without a bounds check. For valid, ubiquitous Go like `a, err := fmt.Println("hi")` or `v, ok := m[k]`, the parse tree's `right` field is an `expression_list` containing a single child (e.g. a `call_expression`), so `names.length` (2) > `exprs.length` (1). At `i = 1`, `compositeLiteralIn(undefined)` threw:

```
TypeError: Cannot read properties of undefined (reading 'type')
    at compositeLiteralIn (src/code-index/extractors/go.ts)
    at visit (src/code-index/extractors/go.ts:313:21)
```

The pre-38a1072 code did not crash because `left?.namedChildren.find(...)` + `compositeLiteralIn(right)` safe-handled the `expression_list` via `namedChildren[0]`.

## Root cause

The positional pairing added in 38a1072 assumed `names.length === exprs.length` (all multi-value declarations with one right expression are valid Go: function/method multi-returns, map-index assignments). No guard covered the `names.length > exprs.length` case.

## Fix

In `collectCompositeLiteralBindings` (`src/code-index/extractors/go.ts`), both the `short_var_declaration` and `var_spec` loops now break out when the positional index exceeds `exprs.length` (only bind when both the name and its positional expression exist):

```ts
for (let i = 0; i < names.length; i++) {
  const name = names[i];
  if (name.text === "_") continue;
  if (i >= exprs.length) break;
  const lit = compositeLiteralIn(exprs[i]);
  ...
}
```

Positional semantics unchanged: each left identifier still pairs with its positional right expression, `_` is still skipped, and no binding is produced for a name whose positional expression is not a composite literal.

## Covering tests (`tests/code-index-extractor-go.test.ts`)

1. `"does not crash on multi-value returns (no composite literals, no edges)"` — `a, err := fmt.Println("hi")`; asserts `extractFile` does not throw and emits no dotted member edges (no composite literals present).
2. `"binds only positional composite-literal names in a mixed multi-value declaration"` — `x, y := &A{}, someCall()`; asserts exactly one edge `A.M` (same-file) for `x.M()`, no edge/unresolved entry for `y.M()` (call-assigned name is not bound), and empty `unresolvedMembers`.

## Verification

- `npx tsx --test tests/code-index-extractor-go.test.ts tests/code-index-same-package.test.ts tests/code-search.test.ts` → 44 tests, 0 fail.
- `npm test` → 350 tests, 0 fail.
- `npm run build` → clean.

## Note

The original fix-wave task (commit 38a1072) did not create a fix-report file; this report is the first one and was created for this follow-up fix as requested. `package-lock.json` remains unstaged (pre-existing dirty file, not part of this commit).
