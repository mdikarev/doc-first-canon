# P2a-Rust — Rust code AST index slice

- **Status:** absorbed
- **Focus:** The Rust vertical slice of the P2a code AST index: `Cargo.toml` source-root detection and a tree-sitter WASM Rust extractor normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model, reusing the slice-1 pipeline shape (`src/code-index/*`) and its byte-deterministic dual artifact.
- **Depends on:** P2a slice 1 (TypeScript/JavaScript pipeline in `src/code-index/*`)
- **Unblocks:** Consistent cross-language symbol lookup for Rust repos via the same `doc-canon code-index` surface and `openCodeIndex` reader facade

## Intent

Slice 1 built the code-side probe end-to-end for TypeScript/JavaScript. Rust is the next vertical slice: it reuses the exact pipeline (discovery → config → listing → extraction → sync → reader → CLI) and only adds the `Cargo.toml` manifest root, the `.rs` file filter, and a Rust extractor. This is directional — the concrete node-type mapping and test fixtures are locked when this slice moves to implementation planning.

## In scope

- `Cargo.toml` as a source-root manifest (sibling/nested rules as in slice 1; workspace members)
- `.rs` files under the discovered roots, through the existing ignore/freshness discipline
- tree-sitter WASM Rust grammar (`@vscode/tree-sitter-wasm` covers Rust) pinned and stamped in `GRAMMAR_VERSIONS`
- Rust symbols mapped into the shared model: `mod` → `module`, `struct` → `struct`, `enum` → `enum`, `trait` → `trait`, `fn` → `function`/`method` (by `impl` receiver), `const`/`static` → `const`, `type` → `type`
- Same hash-driven freshness, byte-deterministic artifacts, watch/`--stop`, and reader facade as slice 1
- Tests: Rust extractor correctness fixtures, Cargo manifest discovery, determinism

## Out of scope

- Cross-symbol / cross-file reference resolution beyond slice-1 syntactic references
- Embeddings; editing source through the index; Git-diff as the primary change signal
- Language support beyond the five (TypeScript/JavaScript, Go, C#, Rust, Python); GDScript is dropped
- Reworking slice-1 TS/JS behavior

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Rust in the language list), `GLOSSARY.md` (source-root manifest list already has `Cargo.toml`), extractor tests. Doc↔code divergence goes through the normal `DISCREPANCIES.md` flow.

## Open questions

- Cargo workspace members: whether member crates are separate roots or one root for the workspace
- `impl` blocks: how the receiver type becomes the method `scope` (and how `trait` implementations scope)
- Exact tree-sitter-rust node-type names for `impl` blocks and associated functions — locked in extractor tests
