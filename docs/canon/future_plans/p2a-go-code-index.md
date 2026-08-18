# P2a-Go — Go code AST index slice

- **Status:** draft
- **Focus:** The Go vertical slice of the P2a code AST index: `go.mod` source-root detection and a tree-sitter WASM Go extractor normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model, reusing the slice-1 pipeline shape (`src/code-index/*`) and its byte-deterministic dual artifact.
- **Depends on:** P2a slice 1 (TypeScript/JavaScript pipeline in `src/code-index/*`)
- **Unblocks:** Consistent cross-language symbol lookup for Go repos via the same `doc-canon code-index` surface and `openCodeIndex` reader facade

## Intent

Slice 1 built the code-side probe end-to-end for TypeScript/JavaScript. Go is the next vertical slice: it reuses the exact pipeline (discovery → config → listing → extraction → sync → reader → CLI) and only adds the Go manifest root, the `.go` file filter, and a Go extractor. This is directional — the concrete node-type mapping and test fixtures are locked when this slice moves to implementation planning.

## In scope

- `go.mod` as a source-root manifest (sibling/nested rules as in slice 1)
- `.go` files under the discovered roots, through the existing ignore/freshness discipline
- tree-sitter WASM Go grammar (`@vscode/tree-sitter-wasm` covers Go) pinned and stamped in `GRAMMAR_VERSIONS`
- Go symbols mapped into the shared model: `package` → `module`, `func` → `function`/`method` (by receiver), `type` → `struct`/`interface`/`type`, `const`/`var` → `const`
- Same hash-driven freshness, byte-deterministic artifacts, watch/`--stop`, and reader facade as slice 1
- Tests: Go extractor correctness fixtures, Go manifest discovery, determinism

## Out of scope

- Cross-symbol / cross-file reference resolution beyond slice-1 syntactic references
- Embeddings; editing source through the index; Git-diff as the primary change signal
- Language support beyond the five (TypeScript/JavaScript, Go, C#, Rust, Python); GDScript is dropped
- Reworking slice-1 TS/JS behavior

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Go in the language list), `GLOSSARY.md` (source-root manifest list gains `go.mod` already present), extractor tests. Doc↔code divergence goes through the normal `DISCREPANCIES.md` flow.

## Open questions

- Go method scope naming: receiver type name vs. receiver variable as the scope path
- Whether Go `var` declarations map to `const` kind or need a distinct kind in the shared enum
- Exact tree-sitter-go node-type names for methods with pointer receivers and interfaces — locked in extractor tests
