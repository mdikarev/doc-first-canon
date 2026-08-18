# P2a-Python — Python code AST index slice

- **Status:** absorbed
- **Focus:** The Python vertical slice of the P2a code AST index: `pyproject.toml`/`setup.py`/`setup.cfg` source-root detection and a tree-sitter WASM Python extractor normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model, reusing the slice-1 pipeline shape (`src/code-index/*`) and its byte-deterministic dual artifact.
- **Depends on:** P2a slice 1 (TypeScript/JavaScript pipeline in `src/code-index/*`)
- **Unblocks:** Consistent cross-language symbol lookup for Python repos via the same `doc-canon code-index` surface and `openCodeIndex` reader facade

## Intent

Slice 1 built the code-side probe end-to-end for TypeScript/JavaScript. Python is the next vertical slice: it reuses the exact pipeline (discovery → config → listing → extraction → sync → reader → CLI) and only adds the Python manifest root(s), the `.py` file filter, and a Python extractor. This is directional — the concrete node-type mapping and test fixtures are locked when this slice moves to implementation planning.

## In scope

- `pyproject.toml` / `setup.py` / `setup.cfg` as source-root manifests (sibling/nested rules as in slice 1)
- `.py` files under the discovered roots, through the existing ignore/freshness discipline
- tree-sitter WASM Python grammar (`@vscode/tree-sitter-wasm` covers Python) pinned and stamped in `GRAMMAR_VERSIONS`
- Python symbols mapped into the shared model: `module` → `module`, `class` → `class`, `def` → `function`/`method` (by class receiver), module-level `const` assignments → `const`
- Same hash-driven freshness, byte-deterministic artifacts, watch/`--stop`, and reader facade as slice 1
- Tests: Python extractor correctness fixtures, Python manifest discovery, determinism

## Out of scope

- Cross-symbol / cross-file reference resolution beyond slice-1 syntactic references
- Embeddings; editing source through the index; Git-diff as the primary change signal
- Language support beyond the five (TypeScript/JavaScript, Go, C#, Rust, Python); GDScript is dropped
- Reworking slice-1 TS/JS behavior

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Python in the language list), `GLOSSARY.md` (source-root manifest list already has `pyproject.toml`/`setup.py`/`setup.cfg`), extractor tests. Doc↔code divergence goes through the normal `DISCREPANCIES.md` flow.

## Open questions

- Python has no compile-time `const`: whether module-level uppercase-name assignments map to `const`, and which naming rule to use
- Whether the `def` scope inside a `class` uses the class name directly (as in slice-1 method scoping)
- Exact tree-sitter-python node-type names for decorators, async defs, and lambda-bound names — locked in extractor tests
