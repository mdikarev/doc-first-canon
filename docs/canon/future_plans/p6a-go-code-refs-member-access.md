# P6a-Go — Go code-refs member-access slice

- **Status:** implementing
- **Focus:** Go slice of P6: member-access call-site edges for local bindings initialized from composite-literal/pointer structs (`x := &T{}` / `x := T{}` / `var x = T{}`), syntactically, in the Go extractor — unblocks `--refs Type.method` for Go.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Go (Go extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Go constructor-backed members; fewer `code_miss` probes

## Intent

P6 ships member-access resolution for the TS/JS `new <Type>(...)` pattern. Go constructors are not a `new` keyword: struct literals (`T{...}`), pointer literals (`&T{...}`), and constructor functions (`func NewT() *T`). This slice extends the cheap syntactic tier for the composite-literal pattern: `x := &T{}` + `x.method()` emits a `T.method`-named member-access edge. Constructor-function patterns need the binding's type, which is not syntactic — out of scope here.

## In scope

- Composite-literal/pointer-literal bindings: `x := &T{}` / `x := T{}` / `var x = T{}` where `T` is a same-file, imported (qualified `reader.Handle{}` via the import edge map), or same-package type — `T.method`-named edges with the unqualified type name
- Same-package resolution via a deterministic post-processing pass in `sync.ts` (package identity = directory + package-clause name; single candidate → edge, zero or multiple → drop)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Constructor-function bindings (`x := NewT()`) — needs type info, not syntactic
- Cross-package/imported-type resolution beyond the import edge map
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Go member-access), `CLI.md` (`code-index search --refs`), `GLOSSARY.md` (member-access reference — Go pattern).

## Open questions

*Resolved by the design spec* (binding forms: `x := &T{}` / `x := T{}` / `var x = T{}` with a composite-literal initializer; `var x T` without an initializer excluded; `&T{}` counts via the `unary_expression` → `composite_literal` form; same-file, qualified-import (`reader.Handle{}` via the import edge map, edge carries the unqualified type), and same-package resolution via the sync post-processing pass; same-package ambiguity — zero or multiple same-named candidates → edge dropped; tree-sitter-go CST shapes locked in extractor tests).
