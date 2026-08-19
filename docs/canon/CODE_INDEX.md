# Code Index

## Purpose

Detailed reference for how the code AST index (`doc-canon code-index build` / `code-index search`) works per language. ARCHITECTURE carries the building-block overview; this file holds the per-language extraction and resolution specifics so agents can predict what the index emits for a given language without reading extractor sources.

## Scope

Covers the five supported languages (TypeScript/JavaScript, Go, C#, Rust, Python): symbol extraction, import-edge resolution conventions, member-access edges, and cross-file resolution passes. Excludes the canon BM25 index (that is `doc-canon index` over `docs/canon/**`), search/CLI behavior details (CLI.md), and per-language initiatives still in `future_plans/`.

## Current state

The pipeline lives in `src/code-index/*`: source-root discovery (manifest-driven for all five languages), a uniform tree-sitter WASM extraction pipeline normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model, syntactic references (anchors, import edges, in-scope bindings), member-access edges, and cross-file post-processing passes keyed by language in `src/code-index/resolvers/` (`CROSS_FILE_RESOLVERS`). `sync.ts` stays language-agnostic: it buckets `unresolvedMembers` by grammar language and dispatches each language's resolver from the registry.

## Responsibilities

- Per-language symbol extraction in `src/code-index/extractors/<lang>.ts`, dispatched by extension from `extractors/index.ts`.
- Per-language import-edge resolution, where the language's import syntax is file-resolvable syntactically.
- Member-access edges (`<Type>.<member>`) for constructor-backed local bindings, per language.
- Cross-file member-access resolution passes (`src/code-index/resolvers/`), keyed by grammar language.
- Deterministic byte-identical dual artifact (`.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`).

## Interfaces

`doc-canon code-index build` extracts and writes the pair; `doc-canon code-index search --refs "Type.method"` matches member-access edges by exact name (see CLI.md). The shared models are `CodeSymbol`, `CodeReference` (`anchor | import | binding`), and `UnresolvedMember` in `src/code-index/types.ts`.

## Per-language behavior

| Language | Import-edge resolution | Member-access (P6/P6a) | Cross-file resolution |
| --- | --- | --- | --- |
| TypeScript/JavaScript | Relative ESM imports only (`./`, `../`); `.js`/`.jsx`/`.mjs`/`.cjs` specifiers substitute to TS/TSX sources (`index.*` fallback, extensionless unchanged); bare-package imports skipped | `new <Type>(...)` bindings → `<Type>.<member>` edges (same-file, imported, aliased — canonical name) | Import edge map at extract time; no `sync.ts` pass |
| Go | Relative imports (`./`, `../`) resolved to `.go`/`index.go`; non-relative imports skipped | Composite/pointer-literal bindings (`x := &T{}` / `x := T{}` / `var x = T{}`) → `<Type>.<member>` edges (same-file, qualified-import via import edge map) | Same-package pass `resolveGoSamePackageReferences` (directory + package clause; single candidate → edge) |
| C# | No import edges (`using` resolves syntactically via the project model, not as file import edges) | `new <Type>(...)` (`object_creation_expression`) → `<Type>.<member>` edges (same-file, same-namespace, `using`-imported, `using`-alias — canonical name, namespace-qualified `new Ns.Type()`, explicit-typed target-typed `new()`); `using static`/`global using`/`var w = new();` excluded | Syntactic project model pass `resolveCSharpNamespaceReferences` (file↔namespace from `module` symbols + per-file `using` names; own-first then using-union; exactly one distinct candidate file → edge) |
| Rust | Relative `use self::...` / `use super::...` resolved to `.rs`/`mod.rs`; bare crate-path `use foo::bar` skipped | Associated-function-constructor bindings (`let`/`const` initialized from `Type::new()` / `Type::default()` — a `scoped_identifier` callee in a `call_expression`) → `<Type>.<member>` edges (same-file, imported-name via the import edge map); crate-relative/external-crate imports, generics, non-`new`/`default` associated fns excluded | None |
| Python | Relative `from .module import name` resolved to `.py`/`__init__.py`; bare `import x` skipped | Bare-call constructor bindings (`x = Type(...)` — an `assignment` with a `call` right-hand side whose identifier callee is a same-file `class` symbol or a PascalCase imported name from a relative import edge, `as`-aliases canonicalized) → `<Type>.<member>` edges; absolute/external imports, attribute callees (`util.Reader()`), factory functions excluded | None |

### Cross-file resolution passes

Member-access edges that cannot be resolved to a same-file type surface as `UnresolvedMember` entries from the extractor; `sync.ts` buckets them by grammar language and runs the registered resolver for that language (from `CROSS_FILE_RESOLVERS`). Currently registered: `go` → `resolveGoSamePackageReferences`, `c-sharp` → `resolveCSharpNamespaceReferences`. A resolver emits an edge only when exactly one candidate file matches; zero or multiple candidates drop the edge (deterministic ambiguity rule). For C#, `resolveCSharpNamespaceReferences` derives each unresolved candidate's search-set from a deterministic syntactic project model — the candidate file's namespaces (all `module` symbols, nested included) plus its per-file `using`-directive names, or a single qualified namespace for `new Ns.Type()` — resolves own-namespace-first, then the using-union, and applies the exactly-one-distinct-file rule; `using`-aliases resolve to their canonical type name, and target-typed `new()` requires an explicit non-`var` type anchor.

## Dependencies

`@vscode/tree-sitter-wasm` (pinned in `src/code-index/grammar-versions.ts`) provides the grammars for all five languages; `tsconfig`/build tooling compiles the extractors. No external process or per-language toolchain is invoked.

## Invariants

- Index schema (`schema_version` 1, `ReferenceKind = anchor | import | binding`) and `CodePack` shape unchanged by language slices.
- Deterministic: identical corpus → identical index bytes; resolver dispatch order derives from the stable file ordering.
- Member-access resolution is syntactic: no name resolution or type inference; a binding's type is taken only from the constructor/literal CST node.
- Each extractor fills only its own `unresolvedMembers`; the registry key is the grammar language reported by `grammarForFile`.
- Freshness: hash-driven rebuild on any create/update/delete or `grammar_versions` divergence; `code_index_stale` warns, `code_index_missing` fails closed.

## Open questions

- C# imported-type resolution (`using`, `using`-alias, namespace-qualified `new NS.Type()`, target-typed `new()`, cross-namespace types) — *resolved by the P6a-CSharp-2 design*: a deterministic syntactic project model (file↔namespace from `module` symbols + per-file `using` names) with own-first/using-union resolution; initiative status `implementing`.

## Related canon

- [ARCHITECTURE.md](ARCHITECTURE.md) — building-block overview of the code AST index
- [CLI.md](CLI.md) — `code-index build` / `code-index search` surface and refs mode
- [GLOSSARY.md](GLOSSARY.md) — `code-ast-index`, `Syntactic reference`, `Member-access reference`, `Source root`
- [future_plans/INDEX.md](future_plans/INDEX.md) — P6a-{rust,csharp,python} and P6a-csharp-2 initiatives
