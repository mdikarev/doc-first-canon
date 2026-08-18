# P6a-CSharp-2 — C# code-refs member-access imported-type resolution

- **Status:** draft
- **Focus:** Second C# iteration of P6: imported-type resolution for member-access edges beyond the same-namespace pass — `using`-directive and `using`-alias imports, namespace-qualified constructors (`new NS.Type()`), and target-typed `new()` — unblocks `--refs Type.method` across C# namespaces. Requires a project model; likely out of the purely syntactic tier.
- **Depends on:** P6 (TS/JS v1, absorbed), P2a-CSharp (C# extractor, absorbed), and P6a-CSharp (same-file + same-namespace slice, absorbed)
- **Unblocks:** `--refs Type.method` for C# types imported via `using` / namespace-qualified construction

## Intent

P6a-CSharp shipped the cheap syntactic tier for C#: `var x = new Type();` + `x.method()` emits a `Type.method`-named edge for same-file types and for a unique same-namespace type (via `resolveCSharpNamespaceReferences` in `sync.ts`). Deliberately out of scope there were target-typed `new()` (no type name in the CST), `using`-alias imports, namespace-qualified `new NS.Type()`, and `using`-imported types from other namespaces — all of which need a project model (file↔namespace mapping, `using` resolution) or type info, not pure syntax. This initiative captures those deferred cases as a distinct follow-up.

## In scope

- `using`-directive and `using`-alias (`using R = App.Reader;`) resolution to files
- Namespace-qualified constructors (`new App.Widget()`) — resolve the qualified name to a file
- `using`-imported types from other namespaces (`using App.Models;` + `new Widget()`) — same-namespace pass extended to imported namespaces
- Target-typed `new()` (`var x = new();`) where the type is inferable from an explicit-typed declaration or other syntactic anchor
- A deterministic project model sufficient for file↔namespace and `using`-name resolution, or explicit criteria for when resolution is dropped
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Name resolution / type inference beyond what a project model and `using` names provide
- Call graphs; cross-symbol dataflow
- Other languages (Rust/Python P6a slices are separate drafts)

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — C# imported-type resolution / project model), `CLI.md` (`code-index search --refs Class.method` — C# imported types), `GLOSSARY.md` (`Member-access reference` term — C# imported-type pattern), extractor tests.

## Open questions

- Minimum viable project model: is a `.csproj`/`.sln` compile-item parse enough to map files to namespaces, or do `using` names need a full compilation model?
- Whether target-typed `new()` is ever resolvable without type inference (e.g., via the declaration's explicit type) — P6a-CSharp left it out as not syntactic
- `using`-alias and namespace-qualified name resolution rules (last-segment match vs. full-qualified match; ambiguity handling)
- Exact tree-sitter-csharp node shapes for `using_alias`, qualified `type` nodes, and target-typed `new()` — locked in extractor tests
