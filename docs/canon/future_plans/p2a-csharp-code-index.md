# P2a-C# — C# code AST index slice

- **Status:** absorbed
- **Focus:** The C# vertical slice of the P2a code AST index: `*.csproj`/`*.sln` source-root detection and a tree-sitter WASM C# extractor normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model, reusing the slice-1 pipeline shape (`src/code-index/*`) and its byte-deterministic dual artifact.
- **Depends on:** P2a slice 1 (TypeScript/JavaScript pipeline in `src/code-index/*`)
- **Unblocks:** Consistent cross-language symbol lookup for C# repos via the same `doc-canon code-index` surface and `openCodeIndex` reader facade

## Intent

Slice 1 built the code-side probe end-to-end for TypeScript/JavaScript. C# is the next vertical slice: it reuses the exact pipeline (discovery → config → listing → extraction → sync → reader → CLI) and only adds the C# manifest root(s), the `.cs` file filter, and a C# extractor. This is directional — the concrete node-type mapping and test fixtures are locked when this slice moves to implementation planning.

## In scope

- `*.csproj` / `*.sln` as source-root manifests (sibling/nested rules as in slice 1)
- `.cs` files under the discovered roots, through the existing ignore/freshness discipline
- tree-sitter WASM C# grammar (`@vscode/tree-sitter-wasm` covers C#) pinned and stamped in `GRAMMAR_VERSIONS`
- C# symbols mapped into the shared model: `namespace` → `module`, `class` → `class`, `interface` → `interface`, `enum` → `enum`, `struct` → `struct`, methods/properties/fields → `method`/`property`/`const`
- Same hash-driven freshness, byte-deterministic artifacts, watch/`--stop`, and reader facade as slice 1
- Tests: C# extractor correctness fixtures, C# manifest discovery, determinism

## Out of scope

- Cross-symbol / cross-file reference resolution beyond slice-1 syntactic references
- Embeddings; editing source through the index; Git-diff as the primary change signal
- Language support beyond the five (TypeScript/JavaScript, Go, C#, Rust, Python); GDScript is dropped
- Reworking slice-1 TS/JS behavior

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — C# in the language list), `GLOSSARY.md` (source-root manifest list already has `*.csproj`/`*.sln`), extractor tests. Doc↔code divergence goes through the normal `DISCREPANCIES.md` flow.

## Open questions

- `*.sln` vs `*.csproj`: whether both are roots or the `.sln` directory wins (project vs. solution boundary)
- C# partial classes and partial members: how to deduplicate same-name symbols across files in a full rebuild
- Exact tree-sitter-c-sharp node-type names for properties with accessors — locked in extractor tests
