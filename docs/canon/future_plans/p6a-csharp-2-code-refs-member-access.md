# P6a-CSharp-2 — C# code-refs member-access imported-type resolution

- **Status:** implementing
- **Focus:** Second C# iteration of P6: imported-type resolution for member-access edges beyond the same-namespace pass — `using`-directive and `using`-alias imports, namespace-qualified constructors (`new NS.Type()`), and target-typed `new()`, cross-namespace types — unblocks `--refs Type.method` across C# namespaces via a deterministic syntactic project model (file↔namespace from `module` symbols + per-file `using` names), no `.csproj`/`.sln` parsing.
- **Depends on:** P6 (TS/JS v1, absorbed), P2a-CSharp (C# extractor, absorbed), and P6a-CSharp (same-file + same-namespace slice, absorbed)
- **Unblocks:** `--refs Type.method` for C# types imported via `using` / namespace-qualified construction
- **Design:** [`docs/superpowers/specs/2026-08-19-p6a-csharp-2-code-refs-member-access-design.md`](../../superpowers/specs/2026-08-19-p6a-csharp-2-code-refs-member-access-design.md) — SoT for this slice; open questions below resolved per its Decisions

## Intent

P6a-CSharp shipped the cheap syntactic tier for C#: `var x = new Type();` + `x.method()` emits a `Type.method`-named edge for same-file types and for a unique same-namespace type (via `resolveCSharpNamespaceReferences` in `sync.ts`). Deliberately out of scope there were target-typed `new()`, `using`-alias imports, namespace-qualified `new NS.Type()`, and `using`-imported types from other namespaces. This initiative resolves those deferred cases with a deterministic syntactic project model — file↔namespace from the collected `module` symbols (all namespaces declared in a file, nested included) plus per-file `using`-directive names parsed in the extractor — keeping the slice inside the cheap syntactic tier (no name resolution, no `.csproj`/`.sln` compile-item parsing).

## In scope

- `using`-directive imports (`using App.Models;`) — the namespace joins the candidate's search-set
- `using`-alias (`using R = App.Reader;`) — alias resolves to canonical `Type`; the edge carries the canonical name `Reader.member`
- Namespace-qualified constructors (`new App.Widget()`) — type = last segment, prefix = its namespace
- Target-typed `new()` only when the enclosing `variable_declaration` carries an explicit non-`var` type (`Widget w = new();`); `var w = new();` gets no edge (no syntactic type anchor)
- Nested namespaces within a file (`namespace A { namespace B { class C } }`) via all-module-symbols indexing
- Resolver `resolveCSharpNamespaceReferences` extended with own-namespace-first priority, then the using-union, exactly one distinct candidate file → edge; entries without `namespaces` fall back to the file's own namespace (v1 behavior)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged; `--refs` query semantics unchanged (exact, case-sensitive)

## Out of scope

- Name resolution / type inference beyond the syntactic project model (file↔namespace + `using` names)
- `.csproj`/`.sln` compile-item parsing — namespace identity comes from each file's own `namespace` declarations
- `using static` (imports members, not types) and `global using` (project-wide) — skipped by per-file syntactic resolution
- Call graphs; cross-symbol dataflow
- Other languages (Rust/Python P6a slices are separate drafts)
- Changes to refs-mode query semantics or the CLI surface; the canon BM25 index

## Absorbs into

`ARCHITECTURE.md` (code AST index — C# imported-type resolution / syntactic project model), `CLI.md` (`code-index search --refs Class.method` — C# imported types), `GLOSSARY.md` (`Member-access reference` term — C# imported-type pattern), `CODE_INDEX.md` (C# per-language row + cross-file resolution passes + open questions), extractor tests.

## Open questions

*Resolved by the design spec Decisions* (syntactic project model; explicit-type-only target-typed `new()`; `using static`/`global using` excluded; canonical edge names; own-first priority; nested namespaces via all-module-symbols index).

- ~~Minimum viable project model~~ — *Resolved:* a deterministic syntactic project model (file↔namespace from collected `module` symbols + per-file `using` names); no `.csproj`/`.sln` parse.
- ~~Whether target-typed `new()` is ever resolvable without type inference~~ — *Resolved:* only with an explicit non-`var` type anchor (`Widget w = new();`); `var w = new();` stays unresolved.
- ~~`using`-alias and namespace-qualified name resolution rules~~ — *Resolved:* edge name is the canonical last segment (`Widget.Score`, `Reader.Get`); `--refs R.Score` (alias form) does not match; own-first then using-union, exactly one distinct candidate file → edge.
- ~~Exact tree-sitter-csharp node shapes for `using_alias`, qualified `type` nodes, and target-typed `new()`~~ — *Resolved:* locked in extractor tests during implementation (`collectUsingDirectives`, extended `collectConstructorBindings`, `collectMemberAccessEdges` in `csharp.ts`).
