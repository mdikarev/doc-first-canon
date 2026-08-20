# P6a-CSharp — C# code-refs member-access slice

- **Status:** absorbed
- **Focus:** C# slice of P6: member-access call-site edges for local bindings initialized from `new Type(...)` object-creation expressions, syntactically — unblocks `--refs Type.method` for C#.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-CSharp (C# extractor, absorbed)
- **Unblocks:** `--refs Type.method` for C# constructor-backed members

## Intent

C# uses `new Type(...)` like TS/JS, but the CST shape differs (`object_creation_expression` with `type` and `argument_list` children). This slice mirrors P6's constructor-binding + member-access passes in the C# extractor: `var x = new Type();` + `x.method()` emits a `Type.method`-named edge for same-file or same-namespace `Type`.

## In scope

- `new Type(...)`-initialized local bindings (`var`/explicit-typed) — `Type.method`-named edges
- Same-file types, plus same-namespace types via a deterministic post-processing pass in `sync.ts` (namespace identity = the file's `module` symbol name; a unique class/interface/struct of that name in another file of the same namespace → edge, zero or multiple → drop)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Target-typed `new()` (no type name in the CST), generics, nullable/array constructions
- `using`-directive and namespace-qualified (`new NS.Type()`) type resolution — no project model
- Name resolution / type inference; call graphs

## Absorbs into

Merged: `GLOSSARY.md` (`Member-access reference` term — C# `new Type(...)` pattern), `CLI.md` (`code-index search --refs Class.method` — C# same-file and same-namespace bindings), `ARCHITECTURE.md` (code AST index — C# member-access edges and same-namespace post-processing).

## Open questions

*Resolved by the C# slice implementation* (binding forms: `var x = new Type();` and explicit-typed `Type x =
new Type();` — both count via the `variable_declarator` → `object_creation_expression` form; target-typed
`new()` has no `type` child → no edge; same-namespace resolution via the sync post-processing pass, namespace
identity from the file's `module` symbol, zero/multiple same-named candidates → edge dropped;
namespace-qualified `new App.Widget()` has a non-`identifier` `type` node → no edge; tree-sitter-csharp CST
shapes locked in extractor tests).
