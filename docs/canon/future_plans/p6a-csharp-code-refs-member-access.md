# P6a-CSharp — C# code-refs member-access slice

- **Status:** draft
- **Focus:** C# slice of P6: member-access call-site edges for local bindings initialized from `new Type(...)` object-creation expressions, syntactically — unblocks `--refs Type.method` for C#.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-CSharp (C# extractor, absorbed)
- **Unblocks:** `--refs Type.method` for C# constructor-backed members

## Intent

C# uses `new Type(...)` like TS/JS, but the CST shape differs (`object_creation_expression` with `type` and `argument_list` children). This slice mirrors P6's constructor-binding + member-access passes in the C# extractor: `var x = new Type();` + `x.method()` emits a `Type.method`-named edge for same-file or imported `Type`.

## In scope

- `new Type(...)`-initialized local bindings (`var`/explicit-typed) — `Type.method`-named edges
- Same-file types and imported names (via the C# extractor's `using` import handling)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- `target-typed new` (`new()` without an explicit type), generics, nullable/array constructions
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — C# pattern).

## Open questions

- Whether target-typed `new()` (no type name in the CST) is ever resolvable syntactically — likely not in v1
- `using`-alias and namespace-qualified type resolution
- Exact tree-sitter-csharp node types — locked in extractor tests
