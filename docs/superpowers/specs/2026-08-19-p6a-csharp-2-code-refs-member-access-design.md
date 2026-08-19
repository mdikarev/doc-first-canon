# C# code-refs member-access imported-type resolution (P6a-CSharp-2) — Design Spec

**Date:** 2026-08-19  
**Status:** Draft for review  
**Scope:** Second C# iteration of P6: imported-type resolution for member-access edges beyond the same-namespace pass — `using`-directive and `using`-alias imports, namespace-qualified constructors (`new NS.Type()`), target-typed `new()` with an explicit-type anchor, and cross-namespace types — unblocks `--refs Type.method` across C# namespaces.
**Approach:** Build a deterministic syntactic project model from the collected symbols plus per-file `using` directives parsed in the C# extractor. The extractor computes each unresolved candidate's search-set (`namespaces`) and the resolver matches type symbols against it. Own-namespace resolution wins (C# semantics), then the `using`-union; a candidate emits an edge only when exactly one distinct file matches. No index schema or `CodePack` shape change, no `.csproj`/`.sln` parsing, no name resolution, hash-driven determinism untouched.

This spec is the SoT for the P6a-CSharp-2 slice. It builds on the P6a-CSharp spec, the shipped `src/code-index/*` implementation, and the C# extractor. Where this spec disagrees with prior docs, this spec wins.

## Problem

`code-index search --refs Class.method` matches exact reference names across the syntactic kinds the index carries. P6a-CSharp shipped the cheap tier: `new Widget()` + `x.Score` emits a `Widget.Score`-named edge for same-file types and unique same-namespace types (via `resolveCSharpNamespaceReferences` in `sync.ts`). Deliberately out of scope there: `using`-directive imports, `using`-alias (`using R = App.Reader;`), namespace-qualified constructors (`new App.Widget()`), target-typed `new()`, and cross-namespace types — all of which need a project model (file↔namespace mapping, `using` resolution) beyond pure syntax. As a result `--refs Widget.Score` returns zero hits when `Widget` lives in another namespace imported via `using`.

## Goals

1. Resolve `using`-imported types from other namespaces: `using App.Models;` + `new Widget()` + `w.Score` links `w.Score` to the file declaring `App.Models.Widget`.
2. Resolve `using`-alias imports: `using R = App.Reader;` + `new R()` emits an edge carrying the canonical type name `Reader.member`.
3. Resolve namespace-qualified constructors: `new App.Widget()` links to the file declaring `App.Widget`.
4. Resolve target-typed `new()` when the type is syntactically anchored: `Widget w = new();` → `Widget.member`; `var w = new();` stays unresolved (no type info).
5. Handle nested namespaces within a file (`namespace A { namespace B { class C } }`) by indexing all module symbols per file.
6. Query-side: `--refs Type.method` matches the resolved canonical name via existing exact refs matching — no `searchCodeIndex` change.
7. Preserve: index schema (`schema_version` 1, `ReferenceKind = anchor | import | binding`), `CodePack` shape, determinism, hash-driven rebuild, no new dependencies, no `.csproj`/`.sln` parsing.

## Non-goals

- Name resolution / type inference / cross-symbol cross-file reference resolution beyond the syntactic project model.
- `.csproj`/`.sln` compile-item parsing — namespace identity comes from each file's own `namespace` declarations (module symbols); the project model is file↔namespace + `using`-name resolution, both syntactic.
- `using static` (imports members, not types) and `global using` (C# 10 file-scope, acts project-wide) — out of scope for per-file syntactic resolution.
- Call graphs; cross-symbol dataflow.
- Other languages: Rust/Python P6a slices are separate drafts, already shipped or tracked separately.
- Changes to refs-mode query semantics (stays exact, case-sensitive) or the CLI surface.
- Canon BM25 index / `doc-canon search`.

## Decisions

| Topic | Choice |
| --- | --- |
| Project model | Syntactic: file↔namespace from collected `module` symbols (all namespaces declared in a file); `using`-directives parsed per file in the extractor. No `.csproj`/`.sln` parse |
| UnresolvedMember | Gains optional `namespaces?: string[]` — the search-set computed by the extractor (own namespace(s) + `using` namespaces, or a single qualified namespace) |
| Using forms | `using Ns;` → namespace import (added to the search-set); `using Alias = Ns.Type;` → alias map `Alias → Ns.Type`, resolved to canonical `Type` + namespace(s); `using static` and `global using` skipped |
| Constructor forms | `new Type()` (identifier); `new Ns.Type()` (qualified name — type = last segment, namespaces = all-but-last as one namespace); `using`-aliased constructor (alias resolved to canonical); target-typed `new()` only when the enclosing `variable_declaration` carries an explicit non-`var` type |
| Target-typed `new()` | `Widget w = new();` → binding `w → Widget` (explicit-type anchor); `var w = new();` → no edge (no type info, needs type inference) |
| Edge name | Canonical type name (last segment, no namespace prefix): `Widget.Score`, `Reader.Score` (alias resolves to canonical `Reader`), matching P6/P6a-CSharp canonical-name rule. `--refs R.Score` (alias form) does not match — documented |
| Resolver | `resolveCSharpNamespaceReferences(unresolved, symbols)` — signature and registration unchanged; `nsByFile` becomes `Map<file, string[]>` (all module symbols). Own-namespace-first, then `using`-union; exactly one distinct candidate file → edge; zero/multiple → drop |
| Own-first priority | If a unique candidate exists in the file's own namespace(s), it wins (C# resolution semantics); otherwise the full search-set (own + using) is considered with exactly-one rule |
| Fallback | `namespaces ?? [own namespace of file]` keeps existing resolver unit tests green (entries without `namespaces` behave as v1) |
| Nested namespaces | All module symbols of a file are indexed; a candidate file matches when any of its namespaces is in the target set |
| Schema / pack / sync | No change: `CodeAstIndex` shape, `CodePack` shape, refs matching (`r.name === effective`), `sync.ts`, `CROSS_FILE_RESOLVERS` all untouched |
| Freshness / determinism | Unchanged — pure functions over the CST plus the deterministic post-processing pass, hash-driven rebuild, stable ordering |
| Canon | Per canon-first: update `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md`, `CODE_INDEX.md`, and flip P6a-CSharp-2 status to `implementing` via canon skills before implementation; wait for go-ahead |

## Architecture

```text
code-index build (sync.ts)                                  — без изменений
    │
    ├─ per file: extractFile(rel, text, knownFiles)          (csharp.ts)
    │     ├─ walkSymbols                                     unchanged (module symbols incl. nested)
    │     ├─ collectAnchorAndBindingRefs                     unchanged
    │     ├─ NEW collectUsingDirectives                      → { usings: string[], aliases: Record<string,string> }
    │     ├─ NEW collectConstructorBindings                  binding → { typeName, namespaces[] } (identifier /
    │     │                                                  qualified / alias-resolved / explicit-typed new())
    │     └─ NEW collectMemberAccessEdges                    same-file → edge; else → unresolvedMembers with namespaces
    │
    ├─ NEW resolveCSharpNamespaceReferences(unresolved, symbols)   — расширен, подпись/регистрация та же
    │     └─ nsByFile: Map<file, string[]>; own-first → using-union; 1 distinct file → edge
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
- No name resolution beyond the syntactic project model (file↔namespace + `using` names); member-access edges remain in the cheap syntactic tier.
- The `using`/alias/binding maps are scoped to the file being extracted; the post-processing pass is a pure function over `(unresolved, symbols)`.
- Freshness and pack-size caps unchanged.

## Components

| Module | Change |
| --- | --- |
| `src/code-index/types.ts` | `UnresolvedMember` gains optional `namespaces?: string[]` |
| `src/code-index/extractors/csharp.ts` | New `collectUsingDirectives`; `collectConstructorBindings` extended to qualified/alias/explicit-typed-target-typed forms; `collectMemberAccessEdges` pushes `namespaces` on unresolved candidates |
| `src/code-index/resolvers/csharp.ts` | `nsByFile` becomes `Map<file, string[]>`; own-first → using-union resolution; fallback for entries without `namespaces` |
| `src/code-index/sync.ts` | No change |
| `src/code-search/search.ts` | No change (refs exact match already picks up dotted names) |
| `docs/canon/future_plans/p6a-csharp-2-code-refs-member-access.md` | Status → `implementing` (via canon-future-plan); open questions resolved per Decisions |
| `docs/canon/ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md`, `CODE_INDEX.md` | Living canon absorption of the C# imported-type pattern (via canon-write, canon-first) |

### Member-access edge shape

```csharp
// File A: namespace App.Models { public class Widget { public int Score { get; set; } } }
// File B: using App.Models;
//         var w = new Widget();
//         int n = w.Score;
{ kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 12 }

// File B: var q = new App.Models.Widget();
//         q.Score = 5;
{ kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 12 }

// File B: using R = App.Reader;
//         R r = new R();
//         r.Get("q");
{ kind: "import", from: "src/App/Program.cs", to: "src/App/Reader.cs", name: "Reader.Get", line: 12 }

// File B: Widget w = new();
//         w.Score = 5;
{ kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 12 }
```

`--refs Widget.Score` / `--refs Reader.Get` return the call-site line with a live-file snippet.

### Resolver search-set shape

For each unresolved candidate `(file F, typeName T, memberName M, line, namespaces?)`:

1. `target = namespaces ?? [nsByFile(F)[0]]` — the search-set (fallback keeps v1 behavior).
2. Priority 1 (own-first): candidates in `nsByFile(F)` ∩ type-name `T`; exactly one distinct file → edge.
3. Priority 2 (using-union): candidates across all `target` namespaces; exactly one distinct file → edge.
4. Otherwise drop.

Candidate symbol: `s.name === T`, `s.kind ∈ {class, interface, struct}`, `s.file !== F`, and `nsByFile(s.file)` intersects the target set.

## Data flow & CLI

### Extractor flow

1. `collectUsingDirectives(root)` → `{ usings: string[], aliases: Record<string,string> }`:
   - `using_directive` whose first named child is a `qualified_name` and no `=` → push `qualified_name.text` to `usings`.
   - `using_directive` with `identifier` + `=` + `qualified_name` → `aliases[identifier.text] = qualified_name.text`.
   - `using static` / `global using` → skipped (their CST shape differs or matches are not type imports).
2. `collectConstructorBindings(root, ctx, usings, aliases)` → `Map<binding, { typeName: string; namespaces: string[] }>`:
   - `object_creation_expression` with `identifier` type → `{ typeName: id, namespaces: ownNs + usings }`.
   - `object_creation_expression` with `qualified_name` type (`new App.Widget()`) → `{ typeName: last segment, namespaces: [all-but-last joined] }`.
   - `object_creation_expression` whose type is an alias name → resolve `aliases[name]` → `{ typeName: last segment, namespaces: [all-but-last joined] }`.
   - `implicit_object_creation_expression` (`new()`) where the enclosing `variable_declaration` has an explicit non-`implicit_type` type (`Widget w = new()`) → `{ typeName: explicit type, namespaces: ownNs + usings }`.
   - `var w = new()` → skipped (no type anchor).
3. `collectMemberAccessEdges(root, ctx, bindings, unresolved)`: for each `member_access_expression` whose object identifier is a binding:
   - same-file symbol (kind class/interface/struct) → edge `Type.member` → `to = ctx.file` (unchanged).
   - otherwise → `unresolved.push({ file, typeName, memberName, line, namespaces })`.
4. Sort references unchanged (file, line, name, kind, to); dotted names sort fine under `localeCompare`.

### Sync flow

Unchanged: per-file extraction, bucket by grammar language, dispatch `resolveCSharpNamespaceReferences` from `CROSS_FILE_RESOLVERS`. Only the resolver's internals change.

### CLI surface

No new flags. `code-index search --refs Type.method` behaves identically; only results change.

## Error handling

| Situation | Behavior |
| --- | --- |
| `var w = new();` (target-typed, no explicit type) | No edge (no syntactic type anchor) |
| `new Missing.Type()` — no candidate in any namespace | No edge (deterministic drop) |
| Type present in both own namespace and `using` namespace | Own-first: edge targets the own-namespace candidate |
| >1 distinct candidate file in the search-set | No edge (deterministic ambiguity rule) |
| `using static` / `global using` | Skipped — outside this slice |
| Alias query form (`--refs R.Score`) | No match — edges carry the canonical name `Reader.Score`; documented |
| Nested namespaces (`namespace A { namespace B { class C } }`) | All module symbols indexed; `new C()` (own `A.B`) and `new A.B.C()` both resolve |
| `using` target namespace not present in the corpus | No edge — candidate file not found |
| Binding reassigned after construction | Still emits an edge — v1 ignores reassignment (cheap tier) |
| Missing/stale index | Unchanged (`code_index_stale` warn, `code_index_missing` fail closed) |
| Non-C# files | Unchanged (their extractors untouched) |

## Testing

**Unit (`tests/code-index-extractor-csharp.test.ts`):** `using App.Models;` + `new Widget()` + `w.Score` → unresolved with `namespaces: ["App", "App.Models"]` (own + using); `new App.Models.Widget()` → unresolved `{ typeName: "Widget", namespaces: ["App.Models"] }`; alias `using R = App.Reader;` + `new R()` → unresolved `{ typeName: "Reader", namespaces: ["App"] }`; explicit-typed target-typed `Widget w = new();` → binding → edge candidate; `var w = new();` → no edge; `using static`/`global using` → no using entry; same-file `new Widget()` → edge (regression).

**Unit (`tests/code-index-csharp-namespace.test.ts`):** using-import resolves across namespaces; qualified `new App.Widget()` resolves; alias resolves to canonical; own-first priority (type in own + using → own wins); ambiguity drop (>1 distinct file); nested namespace (`namespace A { namespace B { class C } }`) resolves via all-module-symbols index; fallback without `namespaces` keeps existing v1 behavior green.

**Integration (`tests/code-index-sync.test.ts` / `tests/code-search.test.ts`):** C# fixture with `using App.Models;` + `new Widget(); w.Score` → `--refs Widget.Score` returns the call-site line; byte-deterministic rebuild assert holds.

**Regression:** all existing `tests/code-index*.test.ts`, `tests/code-search*.test.ts`, `tests/code-analysis-*.test.ts` pass unchanged (determinism asserts hold; new edges only add names prior queries never match).

**Out of scope:** other-language extractors, index format, canon search, CLI changes, `.csproj`/`.sln` parsing.

## Performance

Two extra CST walks per C# file at build time (using directives + extended constructor/member-access passes) — linear, negligible vs. existing passes. The resolver change is a single pass over collected symbols with a per-namespace name index; `nsByFile` grows to hold all module symbols per file (still small). No search-time cost change (refs match is exact `===` over existing references). Index size grows by the number of newly resolved cross-namespace member-access sites — small.

## Implementation order (after plan)

1. Canon-first: `canon-write` — GLOSSARY (`Member-access reference` term — C# imported-type pattern), CLI.md (`--refs Class.method` — C# using/qualified/alias/target-typed bindings), ARCHITECTURE.md (code AST index — C# imported-type resolution / syntactic project model), CODE_INDEX.md (C# per-language row + cross-file resolution passes + open questions); via `canon-future-plan`: P6a-CSharp-2 → `implementing`. Wait for explicit go-ahead after these canon changes.
2. Implement: `collectUsingDirectives` → extended `collectConstructorBindings` → `collectMemberAccessEdges` in `csharp.ts`; `namespaces` field in `UnresolvedMember`; resolver own-first/using-union in `resolvers/csharp.ts` — TDD.
3. Rebuild this repo's index; verify determinism.
4. Absorb P6a-CSharp-2 into living canon; `canon-audit` to close.

## Relationship to prior artifacts

| Artifact | Role |
| --- | --- |
| `docs/canon/future_plans/p6a-csharp-2-code-refs-member-access.md` | Implemented by this slice; open questions resolved per Decisions (syntactic project model, explicit-type-only target-typed `new()`, `using static`/`global using` excluded, canonical edge names, own-first priority, nested namespaces via all-module-symbols index) |
| `docs/canon/future_plans/p6a-csharp-code-refs-member-access.md` | P6a-CSharp v1 — same-file + same-namespace tier this slice extends; `resolveCSharpNamespaceReferences` is the resolver being extended |
| `docs/superpowers/specs/2026-08-18-p6a-go-code-refs-member-access-design.md` | Precedent for the same-shape slice: `UnresolvedMember` optional fields, resolver post-processing, edge-name canonical rule |
| `docs/superpowers/specs/2026-08-18-p6-code-refs-member-access-design.md` | Parent P6 pattern (TS/JS): edge shape, `import` kind reuse, canonical naming |
| `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`, `CODE_INDEX.md` | Living absorption targets (updated at canon-first) |

## Open questions

None blocking.

## Related

- [`docs/canon/future_plans/p6a-csharp-2-code-refs-member-access.md`](../../canon/future_plans/p6a-csharp-2-code-refs-member-access.md)
- [`docs/canon/future_plans/p6a-csharp-code-refs-member-access.md`](../../canon/future_plans/p6a-csharp-code-refs-member-access.md)
- [`docs/superpowers/specs/2026-08-18-p6-code-refs-member-access-design.md`](2026-08-18-p6-code-refs-member-access-design.md)
- [`docs/superpowers/specs/2026-08-18-p6a-go-code-refs-member-access-design.md`](2026-08-18-p6a-go-code-refs-member-access-design.md)
- Living absorption targets: `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`, `CODE_INDEX.md`
- `src/code-index/extractors/csharp.ts`, `src/code-index/resolvers/csharp.ts`, `src/code-index/types.ts`, `src/code-index/sync.ts`, `src/code-search/search.ts`
