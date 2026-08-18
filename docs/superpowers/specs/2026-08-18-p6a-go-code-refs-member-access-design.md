# Go code-refs member-access slice (P6a-Go) — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Scope:** Pilot language slice of P6 (code-refs member-access resolution) for Go: emit member-access call-site edges for local bindings initialized from composite-literal / pointer-literal structs (`x := &T{}` / `x := T{}` / `var x = T{}`), syntactically, in the Go extractor — unblocks `--refs Type.method` for Go.
**Approach:** In the Go extractor, build a per-file map of binding → struct type name from composite-literal initializers; for each `selector_expression` whose object identifier is such a binding, emit an `import`-kind reference named `<Type>.<member>` targeting the type's file (same-file, imported via the import edge map, or same-package via a post-processing pass in `sync.ts`). No index schema or `CodePack` shape change, no name resolution beyond the package-identity check, hash-driven determinism untouched.

This spec is the SoT for the P6a-Go slice. It builds on the P6 (TS/JS) spec, the shipped `src/code-index/*` implementation, and the Go extractor. Where this spec disagrees with prior docs, this spec wins.

## Problem

`code-index search --refs` matches exact reference names across the syntactic kinds the index carries (`anchor`, `import`, `binding`). Go constructor call sites are invisible: `x := &Handle{}; x.Score("q")` produces no `Handle.Score`-named reference, so `--refs Handle.Score` returns zero hits. P6 shipped this resolution for the TS/JS `new <Type>(...)` pattern; Go's constructors are struct literals (`T{...}`), pointer literals (`&T{...}`), and constructor functions (`func NewT() *T`), none of which the P6 TS/JS pass covers.

## Goals

1. Emit member-access call-site edges for bindings initialized from composite/pointer literals: `x := &T{}; x.Score("q")` links `x.Score` to `T.Score`.
2. Cover three forms: `x := &T{}`, `x := T{}`, `var x = T{}` (composite-literal initializer only).
3. Resolve the target type syntactically:
   - same-file: `T` is a struct/interface/type symbol declared in the current file → `to = <current file>`;
   - imported: `reader.Handle{}` where `reader` is a relative import → `to = <resolved import target>` via the existing import edge map, edge name carries the unqualified type `Handle`;
   - same-package: unqualified `T{}` where `T` is declared in another file of the same package → post-processing pass in `sync.ts` resolves against collected symbols.
4. Query-side: `--refs Type.method` matches the resolved member name, via existing exact refs matching — no `searchCodeIndex` change.
5. Preserve: index schema (`schema_version` 1, `ReferenceKind = anchor | import | binding`), `CodePack` shape, determinism, hash-driven rebuild, no new dependencies.

## Non-goals

- Name resolution / type inference / cross-symbol cross-file reference resolution.
- Constructor-function bindings (`x := NewT()`) — needs type info, not syntactic.
- Member-access edges for bindings not initialized from a composite literal: function params, reassignment, destructuring, slice/map/array composite literals (`x := []T{...}`, `x := map[K]V{...}`) whose type is not a `type_identifier`/`qualified_type`.
- Chained/property-object member access (`h.get().Score()` where the object is not a bare identifier).
- Caller→callee call graphs or dataflow analysis.
- Same-package resolution driven by type info; ambiguity among multiple same-named types in one package drops the edge (deterministic).
- Other languages: Rust/C#/Python are separate P6a draft initiatives, not implemented here.
- Canon BM25 index / `doc-canon search`.
- Changes to refs-mode query semantics (stays exact, case-sensitive) or the CLI surface.

## Decisions

| Topic | Choice |
| --- | --- |
| Pilot language | Go only in this slice; Rust/C#/Python drafts remain open for later slices |
| Binding forms | `x := &T{}` (unary_expression → composite_literal), `x := T{}` (composite_literal), `var x = T{}` (var_spec with composite_literal value). `var x T` (no initializer) excluded — not a constructor pattern |
| Constructor map | New per-file pass `collectCompositeLiteralBindings`: binding name → `{ typeText, qualified }` where the literal type is a `type_identifier` (`T`) or `qualified_type` (`reader.Handle`) |
| Member-access edges | New pass `collectMemberAccessEdges`: for each `selector_expression` whose object is an `identifier` present in the binding map and whose field is a `field_identifier`, emit an edge |
| Edge name | `<Type>.<member>` where `<Type>` is the unqualified type name: `T.method` for same-file/same-package, `Handle.method` for `reader.Handle{}` (imported edge carries the unqualified type, matching P6's canonical-name rule) |
| Type file resolution | Same-file symbol → `to = ctx.file`; qualified type → `to` = the relative import's resolved target from the existing import edge map; same-package → post-processing pass |
| Same-package post-processing | `resolveGoSamePackageReferences(unresolved, symbols, files)` in `sync.ts` after collecting all files: package identity = directory + `module`-symbol name (package clause); exactly one candidate symbol of kind struct/interface/type in same dir + same package → emit edge; 0 or >1 → drop |
| Extractor contract | `extractFile` return gains optional `unresolvedMembers?: Array<{ file, typeName, memberName, line }>`; only the Go extractor fills it; other languages' returns unchanged |
| Reference kind | Reuse `"import"` — same reasoning as P6/A+B (syntactic file→file dependency edge carrying a name); `ReferenceKind` unchanged |
| Schema / pack | No change: `CodeAstIndex` shape, `CodePack` shape, refs matching (`r.name === effective`) all untouched |
| Freshness / determinism | Unchanged — pure functions over the CST plus a deterministic post-processing pass, hash-driven rebuild, stable ordering |
| Canon | Per canon-first: update `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md`, and flip P6a-Go status to `implementing` via canon skills before implementation; wait for go-ahead |

## Architecture

```text
code-index build (sync.ts)
    │
    ├─ per file: extractFile(rel, text, knownFiles)     (go.ts)
    │     ├─ walkSymbols                                unchanged
    │     ├─ collectImportEdges                         unchanged (import edge map)
    │     ├─ collectAnchorAndBindingRefs                unchanged
    │     ├─ NEW collectCompositeLiteralBindings        binding → {typeText, qualified}
    │     └─ NEW collectMemberAccessEdges               obj.member where obj ∈ map
    │             → { kind: "import", name: "<Type>.<member>", to: <resolved file> }
    │                 OR push to unresolvedMembers (same-package candidates)
    │
    ├─ NEW resolveGoSamePackageReferences(unresolved, symbols, files)   post-processing
    │     └─ same-package candidates → edges (or dropped)
    │
    ▼
code-ast-index.json  (same schema, same ReferenceKind set)
    │
    ▼
code-index search --refs Type.method   (src/code-search/search.ts)
    └─ existing exact r.name === "Type.method" match (no change)
```

**Invariants**

- Index schema and `CodePack` shape unchanged; existing readers unchanged.
- Deterministic: identical corpus → identical index bytes; post-processing order derives from the already-deterministic file ordering.
- No name resolution beyond the package-identity check for same-package candidates; member-access edges are syntactic.
- The binding map is scoped to the file being extracted; the post-processing pass is a pure function over `(unresolved, symbols, files)`.
- Freshness and pack-size caps unchanged.

## Components

| Module | Change |
| --- | --- |
| `src/code-index/extractors/go.ts` | New `collectCompositeLiteralBindings` + `collectMemberAccessEdges` passes; `extractFile` wires them after `collectAnchorAndBindingRefs`, returns optional `unresolvedMembers` |
| `src/code-index/sync.ts` | After the per-file loop, call `resolveGoSamePackageReferences` to resolve or drop same-package candidates before building the `CodeAstIndex` |
| `src/code-index/types.ts` | New `UnresolvedMember` type; the shared `extractFile` return type in `src/code-index/extractors/index.ts` becomes `{ symbols; references; unresolvedMembers?: UnresolvedMember[] }` (Go fills it; others leave it undefined) |
| `src/code-index/extractors/rust.ts`, `csharp.ts`, `python.ts` | No change in this slice |
| `src/code-search/search.ts` | No change (refs exact match already picks up dotted names) |
| `docs/canon/future_plans/p6a-go-code-refs-member-access.md` | Status → `implementing` (via canon-future-plan); open questions resolved per Decisions |
| `docs/canon/ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` | Living canon absorption of the Go pattern (via canon-write, canon-first) |

### Member-access edge shape

```go
// x := &Handle{}; x.Score("q")            (Handle declared in the same file)
{ kind: "import", from: "main.go", to: "main.go", name: "Handle.Score", line: 12 }

// import "./reader"; h := &reader.Handle{}; h.Score("q")
{ kind: "import", from: "main.go", to: "reader.go", name: "Handle.Score", line: 12 }

// package app; Handle declared in handle.go, used as x := &Handle{} in main.go
{ kind: "import", from: "main.go", to: "handle.go", name: "Handle.Score", line: 12 }
```

`--refs Handle.Score` returns the call-site line with a live-file snippet.

### Same-package post-processing shape

Package identity = directory of the file + the name of the file's `module`-kind symbol (the `package` clause). For each unresolved candidate `(file F, type T, member M, line)`:

1. `dir = dirname(F)`, `pkg = packageName(F)` (from `F`'s module symbol).
2. Candidates = symbols `s` with `s.name === T`, `s.kind ∈ {struct, interface, type}`, `s.file !== F`, `dirname(s.file) === dir`, `packageName(s.file) === pkg`.
3. Exactly one candidate → emit `{ kind: "import", from: F, to: s.file, name: "T.M", line }`.
4. Zero or multiple candidates → drop the edge.

## Data flow & CLI

### Extractor flow

1. `collectCompositeLiteralBindings(root)`: walk `short_var_declaration` (left `expression_list` → `identifier`; right `expression_list` → `unary_expression` → `composite_literal`, or directly `composite_literal`) and `var_spec` with a `value` `expression_list` → `composite_literal`. Record `binding → { typeText, qualified }` only when the literal's type child is `type_identifier` or `qualified_type`.
2. `collectMemberAccessEdges(root, ctx, bindings, importedNames, symbols)`: walk `selector_expression`; if `object` is an `identifier` in the binding map and `field` is a `field_identifier`, resolve the type:
   - `type_identifier` + same-file symbol (kind struct/interface/type) → edge `T.member` → `to = ctx.file`;
   - `qualified_type` (`reader.Handle`) → resolve `reader` through the import edge map → edge `Handle.member` → `to = resolved`;
   - otherwise → push `{ file, typeName: T, memberName, line }` to `unresolvedMembers`.
3. Sort references unchanged (file, line, name, kind, to); dotted names sort fine under `localeCompare`.

### Sync flow

1. Per-file extraction as today; collect `unresolvedMembers` across Go files.
2. `resolveGoSamePackageReferences(unresolved, symbols, files)`: resolve or drop candidates; append resolved edges to `references`.
3. Build manifest + AST unchanged; determinism from stable file ordering.

### CLI surface

No new flags. `code-index search --refs Type.method` behaves identically; only results change.

## Error handling

| Situation | Behavior |
| --- | --- |
| Binding type is neither a same-file symbol nor a qualified import, and no same-package candidate exists | No member-access edge (deterministic drop) |
| Multiple same-named types in the same package | No edge (deterministic drop — documented ambiguity limit) |
| Chained member access (`h.get().Score()`) / object not a bare identifier | No edge (v1 documented limitation) |
| Slice/map/array composite literals (`[]T{}`, `map[K]V{}`) | No edge — type child is not `type_identifier`/`qualified_type` |
| Binding reassigned after construction | Still emits an edge — v1 ignores reassignment (cheap tier) |
| Missing/stale index | Unchanged (`code_index_stale` warn, `code_index_missing` fail closed) |
| Non-Go files | Unchanged (their extractors untouched) |

## Testing

**Unit (`tests/code-index-extractor-go.test.ts`):** same-file composite/pointer literal edge (`x := &T{}; x.M()` → `{ name: "T.M", to: <file> }`); `var x = T{}` form; property-read edge (`x.F` → `T.F`); qualified-import edge (`reader.Handle{}` → `{ name: "Handle.M", to: <resolved> }`); no edge for `x := NewT()` factory calls, slice/map literals, `var x T` without initializer; unresolved candidates surface in `unresolvedMembers`.

**Unit (`resolveGoSamePackageReferences`):** same-package type in another file of same dir + package → edge to that file; no candidate → dropped; two files in the same dir with the same type name but different package clause (module symbol) → not resolved; two same-named candidates in one package → dropped.

**Integration (`tests/code-search.test.ts`):** Go fixture `package main` + `type Handle struct` + `x := &Handle{}; x.Score("q")` → `--refs Handle.Score` returns the call-site line; same-package fixture (two `.go` files, same package) → `--refs Type.method` resolves to the declaring file; pack shape unchanged (`--refs` exact match asserted).

**Regression:** all existing `tests/code-index*.test.ts`, `tests/code-search*.test.ts`, `tests/code-analysis-*.test.ts` pass unchanged (determinism asserts hold; new edges only add names prior queries never match).

**Out of scope:** other-language extractors, index format, canon search, CLI changes.

## Performance

Two extra CST walks per Go file at build time (binding map + member accesses) — linear, negligible vs. existing passes. The same-package post-processing pass is a single pass over the collected symbols with a per-package name index. No search-time cost change (refs match is exact `===` over existing references). Index size grows by the number of composite-literal-backed member-access sites — small.

## Implementation order (after plan)

1. Canon-first: `canon-write` — GLOSSARY (member-access reference — Go pattern), CLI.md (`--refs Type.method` matches Go), ARCHITECTURE.md (code-index building block: Go composite-literal binding + member-access edges, same-package pass); via `canon-future-plan`: P6a-Go → `implementing`. Wait for explicit go-ahead after these canon changes.
2. Implement: `collectCompositeLiteralBindings` → `collectMemberAccessEdges` in `go.ts`; `unresolvedMembers` return; `resolveGoSamePackageReferences` in `sync.ts`; wire into sync — TDD.
3. Rebuild this repo's index; verify determinism (this repo has no Go sources — a temp fixture proves the edges; determinism asserts stay green).
4. Absorb P6a-Go into living canon; `canon-audit` to close.

## Relationship to prior artifacts

| Artifact | Role |
| --- | --- |
| `docs/canon/future_plans/p6a-go-code-refs-member-access.md` | Implemented by this slice; open questions resolved per Decisions (`:=`/`var x = T{}` with initializer count, `&T{}` counts, same-package via post-processing, qualified imports via import edge map) |
| `docs/superpowers/specs/2026-08-18-p6-code-refs-member-access-design.md` | P6 TS/JS spec — the pattern this slice extends to Go; decisions about edge shape, `import` kind reuse, canonical naming carried over |
| `docs/canon/future_plans/p6-code-refs-member-access.md` | Absorbed; parent initiative |
| `2026-08-18-p2a-code-ast-index-design.md` | Index shape, extractor model, `ReferenceKind` — consumed unchanged |
| `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` | Living absorption targets (updated at canon-first) |

## Open questions

None blocking.

## Related

- [`docs/canon/future_plans/p6a-go-code-refs-member-access.md`](../../canon/future_plans/p6a-go-code-refs-member-access.md)
- [`docs/canon/future_plans/p6a-{rust,csharp,python}-code-refs-member-access.md`](../../canon/future_plans/p6a-rust-code-refs-member-access.md) (later slices)
- [`docs/superpowers/specs/2026-08-18-p6-code-refs-member-access-design.md`](2026-08-18-p6-code-refs-member-access-design.md)
- Living absorption targets: `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`
- `src/code-index/extractors/go.ts`, `src/code-index/sync.ts`, `src/code-search/search.ts`
