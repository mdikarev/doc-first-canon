# P6 — Code-refs member-access resolution

- **Status:** implementing
- **Focus:** Resolve `obj.method()` call-site edges in the code AST index where `obj` is a local binding initialized from `new ImportedName(...)`, syntactically, within P2a's cheap-references tier — unblocks `--refs Class.method`.
- **Depends on:** P2a (code AST index, absorbed) and the A+B refs slice (call-site edges reuse the `import` kind)
- **Unblocks:** `--refs Class.method` for constructor-backed members; fewer `code_miss` probes during code analysis

## Intent

`code-index search --refs` matches exact reference names across the syntactic kinds the index carries (`anchor`, `import`, `binding`), so member-access call sites are invisible: `handle.score(...)` where `handle` is a local binding is not linked to the `score` method declaration. Evidence from the A+B slice: `--refs Bm25Index.build` returns zero hits (the call-site edge for `Bm25Index.build(...)` is named `Bm25Index`, not `Bm25Index.build`), and `handle.score(...)` in `src/search/search.ts` is not linked to the `score` method in `src/index/bm25.ts`. This initiative closes that gap syntactically — when a local binding is initialized from `new ImportedName(...)`, member accesses on that binding emit a call-site edge carrying the member name, linked to the imported type — staying inside P2a's cheap-references tier: no name resolution, no type inference.

## In scope

- Member-access call-site edges for local bindings initialized from `new ImportedName(...)`: `const index = new Bm25Index(...); index.build(...)` links `index.build` to `Bm25Index.build`
- Query-side: `--refs Class.method` matches the resolved member name (`--refs Bm25Index.build`)
- Syntactic only: the initialized-from-new linkage is a CST-pattern match over the local binding's initializer; no cross-file name resolution
- Determinism and hash-driven rebuild semantics unchanged; no index schema or `CodePack` shape change

## Out of scope

- Name resolution / type inference / cross-symbol cross-file reference resolution (P2a's deferred, explicitly expensive tier)
- Member-access edges for bindings not initialized from a constructor (`openCanonIndex(...)`-style factory calls, aliases, destructuring, reassignment)
- Caller→callee call graphs or dataflow analysis
- Canon BM25 index / `doc-canon search`

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index building block), `CLI.md` (`code-index search --refs` behavior), `GLOSSARY.md` (member-access reference terms).

## Open questions

*Resolved by the design spec* (language scope: TS/JS v1 + per-language drafts; same-file constructors: covered; aliases: covered).
