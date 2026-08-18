# P2a — Code AST index construction

- **Status:** implementing
- **Focus:** Code-root discovery, then a deterministic AST index over the discovered source roots in six languages (TypeScript/JavaScript, Go, C#, Rust, GDScript, Python) as part of the `doc-canon` CLI: a uniform tree-sitter extraction pipeline normalized into a shared symbol/type/signature model, a deterministic hash-driven index artifact, and the same freshness discipline as the canon index — a separate artifact from the canon documentation index.
- **Depends on:** P0/P0b/P1 canon retrieval patterns (Scout → Expand → Execute discipline; ignore, hash-rebuild, dual-artifact reader-facade patterns)
- **Unblocks:** P2b (code search tools), P2c (code analysis rules)
- **Design:** [`docs/superpowers/specs/2026-08-18-p2a-code-ast-index-design.md`](../../superpowers/specs/2026-08-18-p2a-code-ast-index-design.md) — SoT for slice 1 (TypeScript/JavaScript end-to-end); subsequent language slices reuse the slice-1 pipeline shape

## Intent

Coding agents currently analyze a project by reading source files directly, and when a change touches many files they can pull whole trees into context — a direct token cost that grows with the language count. The canon's own retrieval discipline (Scout a small working set, expand only when unsure) stops at documentation; there is no equivalent for source code. This initiative builds the code-side probe: first determining where the project's code lives (code is not always under a fixed `src/` — roots must be found, not assumed), then a deterministic AST index over those source roots, covering the languages the project actually uses. Extractors normalize each language's syntax into a shared symbol/type/signature model — no per-language output formats exposed to consumers. The index artifact is deterministic and hash-driven, so a stale index warns and a missing index fails closed with a hint to build it. The index is the probe; the source files remain the evidence when a probe is thin or a claim needs grounding — quality over thrift, mirroring the canon's Expand gate. This index is distinct from the canon documentation index: `doc-canon index` builds over `docs/canon/**`, the code AST index builds over the discovered source roots.

## In scope

- **Command surface:** `doc-canon code-index build [--watch] [--stop]` on the existing CLI, mirroring `doc-canon index` (poll-based watch with pid-lock, `--stop`, `--root`). `code-index search` lands with P2b. The code index is a part of `doc-canon` — no separate install.
- **Code-root discovery:** VCS root (up-search `.git`) as the project boundary; manifest-driven detection (`package.json`, `go.mod`, `*.csproj`/`*.sln`, `Cargo.toml`, `project.godot`, `pyproject.toml`/`setup.py`/`setup.cfg`); the manifest's directory is a source root; sibling manifests are separate roots (monorepo); nested manifests — nearest wins; extension-based fallback scan under the VCS root when no manifest exists. Deterministic precedence: **explicit config > manifests > extension scan**. Default ignore set (`node_modules`, `vendor`, `.venv`, `bin`, `obj`, `target`, `dist`, `build`, `coverage`, `.git`, …) with additive overrides via `.doc-canon/code-index.json` (explicit `roots`, `ignore`, per-root language hints). The CLI works on repos without a canon.
- **Extraction layer:** tree-sitter WASM grammars for TypeScript/JavaScript, Go, C#, Rust, GDScript, and Python — one uniform CST pipeline, no external processes, no per-language output formats. Shared normalized model: `{ name, kind, signature, file, line, endLine, scope }` with a small kind enum (`class`/`interface`/`trait`/`enum`/`struct`/`function`/`method`/`property`/`module`/`const`/…).
- **References (v1):** cheap syntactic references only — same-file anchors, import/export/use edges, and in-scope local bindings the CST resolves without name resolution. No cross-symbol, cross-file resolution in v1; that is a deferred, explicitly expensive tier (per-language compiler frontends / language servers; breaks hash-driven determinism), revisited only if P2b shows real demand.
- **Deterministic index artifact:** `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`, read via an `openCodeIndex` reader-facade (the same dual-artifact pattern as `openCanonIndex` in `src/index/`).
- **Hash-driven freshness:** unchanged content hashes are a no-op; any create/update/delete triggers a full rebuild from all current files (no posting-level incremental updates). Poll-based watch with pid-lock and `--stop`. Freshness is reported **independently** of the canon index: `code_index_stale` → warn at search time; `code_index_missing` → fail closed with a hint to run `doc-canon code-index build`.
- **Tests:** extractor correctness per language; code-root discovery on fixture repos (monorepos, code outside `src/`, generated/vendored trees); determinism — identical input produces a byte-identical index; golden snapshots.

## Out of scope

- CLI search interface over the index (P2b)
- Agent / skill rules for code-index-first analysis (P2c)
- Embeddings / vector retrieval over source
- Semantic code understanding beyond the parser's cheap surface: no type inference, no cross-language call-graph inference, no cross-symbol / cross-file reference resolution in v1
- Editing source through the index; the index is read-only analysis substrate
- The canon BM25 index / `doc-canon index` / `doc-canon search`: those index `docs/canon/**` documentation, not code; the code AST index is a separate artifact over the project's discovered source roots
- Git-diff analysis as the primary change signal
- Language support beyond the six listed; per-project analyzer configuration beyond `.doc-canon/code-index.json` overrides comes later if the shared model proves inadequate
- Incremental per-language index updates (full rebuild only, like the canon index)

## Absorbs into

Likely: `ARCHITECTURE.md` (code-index building block, dual-artifact pattern reuse, explicit distinction from the canon index), `CLI.md` (`code-index` commands), `GLOSSARY.md` (code-index terms: symbol, extractor, anchor, source root), `OVERVIEW.md` (audience/scope note). Any doc↔code divergence introduced by the new artifact would be tracked via the normal `DISCREPANCIES.md` flow.

## Open questions

- Cross-symbol / cross-file reference resolution stays a deferred, explicitly expensive tier; revisit only if P2b shows real demand
- Whether `.doc-canon/code-index.json` should also honor an existing canon contract's `policies.ignore` when a canon is present, or stay fully independent of the contract
- tree-sitter WASM grammar packaging: confirm the six grammars' bundle growth in the published `doc-canon` package is acceptable
