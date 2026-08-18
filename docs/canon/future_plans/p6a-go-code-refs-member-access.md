# P6a-Go — Go code-refs member-access slice

- **Status:** draft
- **Focus:** Go slice of P6: member-access call-site edges for local bindings initialized from composite-literal/pointer structs (`x := &T{}` / `x := T{}`), syntactically, in the Go extractor — unblocks `--refs Type.method` for Go.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Go (Go extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Go constructor-backed members; fewer `code_miss` probes

## Intent

P6 ships member-access resolution for the TS/JS `new <Type>(...)` pattern. Go constructors are not a `new` keyword: struct literals (`T{...}`), pointer literals (`&T{...}`), and constructor functions (`func NewT() *T`). This slice extends the cheap syntactic tier for the composite-literal pattern: `x := &T{}` + `x.method()` emits a `T.method`-named member-access edge. Constructor-function patterns need the binding's type, which is not syntactic — out of scope here.

## In scope

- Composite-literal/pointer-literal bindings: `x := &T{}` / `x := T{}` where `T` is a same-file or same-package type — `T.method`-named edges
- Same-file and same-package resolution only (no cross-package type inference)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Constructor-function bindings (`x := NewT()`) — needs type info, not syntactic
- Cross-package/imported-type resolution beyond the import edge map
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Go member-access), `CLI.md` (`code-index search --refs`), `GLOSSARY.md` (member-access reference — Go pattern).

## Open questions

- Whether `:=` short declarations, `var x T`, and `&T{}` forms all count in v1
- Package-internal `T` resolution when multiple packages share the same name
- Exact tree-sitter-go node types for composite/pointer literals — locked in extractor tests
