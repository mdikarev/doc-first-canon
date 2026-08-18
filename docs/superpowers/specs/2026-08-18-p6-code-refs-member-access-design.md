# Code-refs member-access resolution (P6) — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Scope:** Resolve `obj.method()` call-site edges in the code AST index where `obj` is a local binding initialized from `new ImportedName(...)` (or a same-file class), syntactically, within P2a's cheap-references tier — unblocks `--refs Class.method`.
**Approach:** In the TypeScript/JavaScript extractor, build a per-file map of `const`-binding → constructor type name from `new <Identifier>(...)` initializers; for each `member_expression` whose object identifier is such a binding, emit an `import`-kind reference named `<Type>.<member>` targeting the class's file (imported or same-file). Alias imports (`import { X as Y }`) map `Y` to `X`'s file and the edge keeps the canonical name `X.member`. No index schema or `CodePack` shape change, no name resolution, hash-driven determinism untouched.

This spec is the SoT for the P6 slice. It builds on the P2a/P2b/A+B specs and the shipped `src/code-index/*` + `src/code-search/*` implementation. Where this spec disagrees with prior docs, this spec wins.

## Problem

`code-index search --refs` matches exact reference names across the syntactic kinds the index carries (`anchor`, `import`, `binding`), so member-access call sites are invisible: `handle.score(...)` where `handle` is a local binding is not linked to the `score` method declaration. Evidence from the A+B slice: `--refs Bm25Index.build` returns zero hits (the call-site edge for `Bm25Index.build(...)` is named `Bm25Index`, not `Bm25Index.build`), and `handle.score(...)` in `src/search/search.ts` is not linked to the `score` method in `src/index/bm25.ts`.

The A+B slice's call-site edges only fire when the used identifier itself is an imported name (`openCanonIndex(...)`). A locally-bound instance (`const index = new Bm25Index(...)`) never produces a member-level edge, so `--refs Class.method` cannot work.

## Goals

1. Emit member-access call-site edges for local bindings initialized from `new <Identifier>(...)`: `const index = new Bm25Index(...); index.build("q")` links `index.build` to `Bm25Index.build`.
2. Also cover same-file constructors: `const r = new LocalClass(); r.score()` links to the same file's `LocalClass.score`.
3. Resolve alias imports (`import { Bm25Index as BM }`) so `new BM()` / `BM.build()` produce an edge named `Bm25Index.build`.
4. Query-side: `--refs Class.method` matches the resolved member name (`--refs Bm25Index.build`), via existing exact refs matching — no `searchCodeIndex` change.
5. Preserve: index schema (`schema_version` 1, `ReferenceKind = anchor | import | binding`), `CodePack` shape, determinism, hash-driven rebuild, no new dependencies.

## Non-goals

- Name resolution / type inference / cross-symbol cross-file reference resolution (P2a's deferred, explicitly expensive tier).
- Member-access edges for bindings not initialized from a constructor: factory calls (`openCanonIndex(...)`), destructuring, reassignment, function parameters.
- Namespace-member constructors (`new NS.Class(...)` where `NS` is a namespace import) — direct identifier constructors only in v1.
- Chained/property-object member access (`h.get().build()` where the object is not a bare identifier).
- Caller→callee call graphs or dataflow analysis.
- Other languages: Go/Rust/C#/Python constructor syntax differs; they are captured as new draft initiatives (P6a language slices), not implemented here.
- Canon BM25 index / `doc-canon search`.
- Changes to refs-mode query semantics (stays exact, case-sensitive) or the CLI surface.

## Decisions

| Topic | Choice |
| --- | --- |
| Scope language | TypeScript/JavaScript only in v1 (the `new <Identifier>(...)` CST pattern is TS/JS-specific); other languages get per-language draft initiatives (P6a-go, P6a-rust, P6a-csharp, P6a-python) mirroring the P2a language-slice precedent |
| Constructor map | New per-file pass `collectConstructorBindings`: for each `lexical_declaration` (const only) → `variable_declarator` whose value is a `new_expression` with a direct `identifier` constructor, map binding name → constructor identifier text |
| Member-access edges | New pass `collectMemberAccessEdges`: for each `member_expression` whose object is an `identifier` present in the constructor map, emit `{ kind: "import", from: <file>, to: <class file>, name: "<Type>.<member>", line }` |
| Coverage | Both call sites (`obj.method()`) and property reads (`obj.field`) emit an edge — the CST pattern is identical and it makes `--refs Class.field` work too |
| Type file resolution | Constructor name → file: imported name (canonical, incl. alias) → the import edge's `to`; otherwise a same-file class declaration → `to = from`; otherwise no edge |
| Aliases | `import { X as Y }` maps both `X` and `Y` to the definition file; edges always carry the canonical imported name `X`, so `--refs X.method` (not `Y.method`) matches |
| Reference kind | Reuse `"import"` for member-access edges — same reasoning as the A+B slice (syntactic file→file dependency edges carrying a name); `ReferenceKind` unchanged |
| Schema / pack | No change: `CodeAstIndex` shape, `CodePack` shape, refs matching (`r.name === effective`) all untouched |
| Freshness / determinism | Unchanged — pure functions over the CST, hash-driven rebuild, stable ordering |
| Per-language initiatives | Add `p6a-<lang>-code-refs-member-access.md` drafts for Go, Rust, C#, Python (constructors differ: Go `&T{}`/composite literals, Rust `::new`, C# `new T()`, Python no typed `new`) |

## Architecture

```text
code-index build (extractor, TS/JS only in this slice)
    │
    ├─ resolveImportPath                unchanged (A+B ESM substitution)
    ├─ collectImportEdges               unchanged
    ├─ collectCallSiteEdges             unchanged (imported-name usages)
    ├─ NEW collectConstructorBindings   const x = new <Identifier>(...) → map {x: Type}
    └─ NEW collectMemberAccessEdges     obj.member where obj ∈ map
            → { kind: "import", name: "<Type>.<member>", to: <class file> }
        │
        ▼
code-ast-index.json  (same schema, same ReferenceKind set)
        │
        ▼
code-index search --refs Class.method   (src/code-search/search.ts)
    └─ existing exact r.name === "Class.method" match (no change)
```

**Invariants**

- Index schema and `CodePack` shape unchanged; existing readers unchanged.
- Deterministic: identical index + identical live corpus + identical query/flags → identical bytes.
- No name resolution; member-access edges are syntactic (constructor-initializer pattern), as P2a's cheap syntactic tier promises.
- Freshness and pack-size caps unchanged.
- The constructor map is scoped to the file being extracted — no cross-file state.

## Components

| Module | Change |
| --- | --- |
| `src/code-index/extractors/typescript.ts` | `importedNames` becomes `Map<nameOrAlias, { to; canonical }>` (both `X` and `Y` map to `X`'s `to`); new `collectConstructorBindings` + `collectMemberAccessEdges` passes wired into `extractFile` after `collectCallSiteEdges` |
| `src/code-index/types.ts` | No change |
| `src/code-search/search.ts` | No change (refs exact match already picks up the dotted names) |
| `src/code-search/types.ts` | No change |
| `src/code-index/extractors/go.ts`, `rust.ts`, `csharp.ts`, `python.ts` | No change in this slice |
| `docs/canon/future_plans/p6-code-refs-member-access.md` | Status → `implementing` |
| `docs/canon/future_plans/p6a-{go,rust,csharp,python}-code-refs-member-access.md` | New drafts |

### Member-access edge shape

```ts
// const handle = new Bm25Index(...); handle.score("q");
{ kind: "import", from: "src/search/search.ts", to: "src/index/bm25.ts", name: "Bm25Index.score", line: 63 }
```

`--refs Bm25Index.score` then returns the call-site line with a live-file snippet.

### Alias example

```ts
import { Bm25Index as BM } from "./bm25.js";
const h = new BM();
h.build("q");
```

- `importedNames`: `Bm25Index → { to: src/index/bm25.ts, canonical: Bm25Index }` and `BM → { to: src/index/bm25.ts, canonical: Bm25Index }`.
- Constructor map: `h → BM`.
- Member access `h.build` → constructor name `BM` → resolve to canonical `Bm25Index` → edge `{ name: "Bm25Index.build", to: "src/index/bm25.ts" }`.
- `--refs Bm25Index.build` matches; `--refs BM.build` does not (documented).

## Data flow & CLI

### Extractor flow

1. `collectImportEdges` unchanged; build `importedNames` as `Map<nameOrAlias, { to: string; canonical: string }>` (alias `Y` and canonical `X` both map to `{ to, canonical: X }`).
2. `collectConstructorBindings(root, ctx)`: walk `lexical_declaration` → `variable_declarator` → `new_expression` → direct `identifier` constructor; record `binding → constructorName`.
3. `collectMemberAccessEdges(root, ctx, constructorMap, importedNames, symbols)`: walk `member_expression`; if object is `identifier` in constructorMap, resolve constructorName → file and canonical name (imported alias/canonical, or same-file symbol) and emit the edge named `<canonical>.<member>`.
4. Sort unchanged (file, line, name, kind, to) — dotted names sort fine under `localeCompare`.

### CLI surface

No new flags. `code-index search --refs Class.method` behaves identically; only results change.

## Error handling

| Situation | Behavior |
| --- | --- |
| Constructor name is neither an imported name nor a same-file class symbol | No member-access edge (falls through to existing binding/anchor behavior) |
| `new NS.Class()` / chained object (`h.get().build()`) | No edge (v1 documented limitation) |
| Alias query form (`--refs BM.build`) | No match — edges carry the canonical name; documented |
| Binding reassigned after construction (`let h = new X(); h = other; h.build()`) | Still emits an edge — v1 ignores reassignment (cheap tier) |
| Missing/stale index | Unchanged (`code_index_stale` warn, `code_index_missing` fail closed) |
| Non-TS/JS files | Unchanged (their extractors untouched) |

## Testing

**Unit (`tests/code-index-references.test.ts`):** imported-constructor member-access edge (`const h = new Bm25Index(); h.build("q")` → `{ name: "Bm25Index.build", to: "src/index/bm25.ts" }`); same-file class (`new LocalClass(); x.run()` → `{ name: "LocalClass.run", to: <same file> }`); alias (`import { X as Y }` → `{ name: "X.m", to }`); property-read edge (`h.field` → `X.field`); no edge for factory-called bindings, `new NS.Class()`, chained objects; both `X` and `Y` usable as constructor names after alias import.

**Integration (`tests/code-search.test.ts`):** fixture with `const h = new Reader(); h.open()` → `--refs Reader.open` returns the call-site line; pack shape unchanged (`--refs` exact match asserted).

**Regression:** all existing `tests/code-index*.test.ts`, `tests/code-search*.test.ts`, `tests/code-analysis-*.test.ts` pass unchanged (determinism asserts hold; new edges only add names that prior queries never match).

**Out of scope:** other-language extractors, index format, canon search, CLI changes.

## Performance

One extra CST walk per file at build time (constructor map + member accesses) — linear, negligible vs. the existing passes. No search-time cost change (refs match is an exact `===` over existing references). Index size grows by the number of constructor-backed member-access sites — small.

## Implementation order (after plan)

1. Canon-first: `canon-write` — GLOSSARY (member-access reference term, alias handling note), CLI.md (`--refs Class.method` now matches), ARCHITECTURE.md (code-index building block: constructor-binding + member-access edges, aliases); via `canon-future-plan`: P6 → `implementing`, add P6a-{go,rust,csharp,python} drafts. Wait for explicit go-ahead after these canon changes.
2. Implement: alias-inclusive `importedNames` → `collectConstructorBindings` → `collectMemberAccessEdges` in `typescript.ts` — TDD.
3. Rebuild this repo's index; verify determinism and that the temp-fixture integration test (`--refs Reader.score` on `const r = new Reader(); r.score(...)`) returns the call site. (This repo has no cross-file `new ImportedName(...)` instance pattern — its `new Command()` is a bare-package import and `Bm25Index` is only constructed in its own file — so dogfood proves rebuild determinism, while the integration fixture proves the edges.)
4. Absorb P6 into living canon; `canon-audit` to close.

## Relationship to prior artifacts

| Artifact | Role |
| --- | --- |
| `docs/canon/future_plans/p6-code-refs-member-access.md` | Implemented by this slice; open questions resolved per Decisions (TS/JS-only v1, same-file constructors covered, aliases covered) |
| `2026-08-18-code-index-quality-refs-search-design.md` | Prior slice (A+B): ESM resolution + call-site edges + search quality; P6 is its documented Block B next step |
| `2026-08-18-p2a-code-ast-index-design.md` | Index shape, extractor model, `ReferenceKind` — consumed unchanged |
| `2026-08-18-p2b-code-search-tools-design.md` | Search surface, refs semantics — reused unchanged |
| `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` | Living absorption targets (updated at canon-first) |

## Open questions

None blocking.

## Related

- [`docs/canon/future_plans/p6-code-refs-member-access.md`](../../canon/future_plans/p6-code-refs-member-access.md)
- [`docs/canon/future_plans/p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)
- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- Living absorption targets: `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`
- `src/code-index/extractors/typescript.ts`, `src/code-search/search.ts`
