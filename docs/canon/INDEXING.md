# Indexing

## Purpose

Indexing and retrieval give agents a Scout-first path into both the canon and the code: a local BM25 index over `docs/canon/**/*.md` and a deterministic AST index over discovered source roots, consumed through bounded context packs / code packs instead of whole-corpus dumps. `doc-canon scout` composes the available packs into a bounded working-set manifest; direct search remains available for targeted retrieval.

## Scope

Covers the two index artifacts, their freshness model, and retrieval: `doc-canon index` (BM25 sync/build/watch), `doc-canon code-index build` (AST extraction), `searchCanon` / `searchCodeIndex` ranking and snippet packing, stale-index self-healing, probe logging, and the `discipline` gate.

Excludes per-language extraction details (see [CODE_INDEX.md](CODE_INDEX.md)), the CLI command surface (see [CLI.md](CLI.md)), and the Scout → Expand agent protocol (see [SKILLS.md](SKILLS.md)).

## Current state

Both indexes ship in `doc-canon` 0.7.0. Each writes a deterministic manifest + bulk store under
`.doc-canon/` (BM25: `index-manifest.json` + `bm25-index.json`; code: `code-index-manifest.json` +
`code-ast-index.sqlite`), uses stat-first freshness (size/mtime snapshot, content-hash-confirmed) so
unchanged files are neither read nor hashed, and self-heals a stale index at the CLI layer when no
watch owns it. Every successful search appends one probe-log line; `discipline` reports probe
currency and exits ≠0 on un-probed or corrupt state.

## Responsibilities

- **Index sync** (`src/index/*`) — stat-first, hash-confirmed logical rebuild of a local BM25 index over `docs/canon/**/*.md`:
  - per-doc `size`/`mtime_ms` stat snapshots in the manifest prove unchanged docs (content neither read nor hashed); stat changes are content-hash-confirmed; unchanged content hashes are a no-op
  - any create/update/delete triggers a full rebuild from all current docs (no posting-level incremental updates)
  - on the fresh path the `bm25-index.json` pair is trusted by mtime ordering (parsed only when rewritten after the manifest commit marker, so external corruption is still repaired)
  - tokenization applies a light EN/RU stemmer inside `tokenize` (index and query tokenize identically) and a `tokenizer_version` in the manifest forces a full rebuild when it diverges (a content hash alone cannot detect a tokenizer change)
  - `bm25-index.json` is `schema_version: 2` with an optional per-doc `heading_terms` field
  - poll-based watch (`doc-canon index --watch`, default 2000 ms, `--interval`) with a pid-locked single instance and `--stop`
  - a thin stable reader facade (`openCanonIndex` from `doc-canon/index-reader`) lets `searchCanon` consume the dual `.doc-canon/index-manifest.json` + `.doc-canon/bm25-index.json` artifacts without ad-hoc JSON parsing
- **Code AST index** (`src/code-index/*`) — the code-side probe, a separate artifact from the canon BM25 index:
  - **Source-root discovery** — VCS root up-search; manifest-driven roots for the five supported languages (TypeScript/JavaScript, Go, C#, Rust, Python — all shipped); extension fallback; explicit `.doc-canon/code-index.json` config > manifests > extension scan
  - **Extraction pipeline** — a uniform tree-sitter WASM extraction pipeline (`@vscode/tree-sitter-wasm`, pinned) normalized into a shared `{ name, kind, signature, file, line, endLine, scope }` model
  - **Syntactic references** — same-file anchors, import edges, in-scope local bindings:
    - import edges resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` specifiers to their TS/TSX sources via a substitution pass in `resolveImportPath` (`.js`→`.ts`, `.jsx`→`.tsx`, `.mjs`→`.mts`, `.cjs`→`.cts`, plus `index.*` fallback; extensionless specifiers unchanged) and include call-site edges — identifier usages of imported names emit an `import`-kind edge to the definition file
    - member-access edges extend this — a local binding initialized from `new <Type>(...)` (imported, aliased, or same-file) emits `<Type>.<member>` edges for its `obj.method()`/`obj.field` usages, canonical name, syntactic only
  - **Member-access edges per language**:
    - **Go** — composite/pointer-literal bindings (`x := &T{}` / `x := T{}` / `var x = T{}`): same-file types resolve to the current file, qualified types (`reader.Handle{}`) resolve through the import edge map carrying the unqualified type name, same-package types resolve via a post-processing pass (`resolveGoSamePackageReferences`)
    - **C#** — the TS/JS `new Type(...)` pattern uses the `object_creation_expression` CST:
      same-file types resolve to the current file; imported types resolve via a post-processing pass
      (`resolveCSharpNamespaceReferences`) over a deterministic syntactic project model
      (file↔namespace from the file's `module` symbols — all namespaces declared in the file, nested
      included — plus per-file `using`-directive names), matching an unresolved `<Type>.<member>`
      against a unique class/interface/struct with own-namespace-first priority, then the
      `using`-union (exactly one distinct candidate file → edge): `using`-imported
      (`using App.Models;`), `using`-alias (`using R = App.Reader;` — edge carries canonical
      `Reader`), namespace-qualified (`new App.Widget()`), and explicit-typed target-typed `new()`
      (`Widget w = new();`); `using static`, `global using`, and `var w = new();` get no edge
    - **Rust** — associated-function constructors: a binding initialized from `Type::new()` /
      `Type::default()` (`let`/`const` with a `call_expression` initializer whose `scoped_identifier`
      callee path is the type) resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge;
      same-file types resolve to the current file, imported names resolve through the import edge
      map; relative `use self::…` / `use super::…` declarations resolve module paths to `.rs` or
      `mod.rs` targets (bare crate-path `use foo::bar` emits no edge); crate-relative, bare
      crate-path, and external-crate imports, generics, and non-`new`/`default` associated functions
      emit no edge — no Rust cross-file pass
    - **Python** — bare constructor calls: a binding initialized from `Type(...)` (an `assignment`
      whose right-hand side is a `call` with an identifier callee) resolves `x.method()` / `x.field`
      to a `<Type>.<member>`-named edge; same-file to the current file when the callee is a same-file
      `class` symbol, imported names through the import edge map when the callee is PascalCase;
      relative `from .module import name` statements resolve to `.py` or `__init__.py` targets
      (`as`-aliases canonicalized — no Python cross-file pass); bare `import x` emits no edge
  - **Cross-file resolvers** — post-processing passes keyed by language in
    `src/code-index/resolvers/` (`CROSS_FILE_RESOLVERS`, keyed by grammar language — `go` →
    same-package, `c-sharp` → namespace/imported-type) so `sync.ts` stays language-agnostic;
    per-language extraction differences (import conventions, member-access constructor patterns,
    resolution boundaries) are detailed in [CODE_INDEX.md](CODE_INDEX.md)
  - **Default ignore** — excludes add `.worktrees` (the shared default ignore prunes worktree clones from code-source-root discovery and the language-agnostic repo inventory; the canon `docs/canon/**` corpus — built over `<root>/docs/canon` without ignore filtering — is unaffected)
  - **Dual artifact** — deterministic `.doc-canon/code-index-manifest.json` (identity + freshness + a `content_fingerprint` over canonical-ordered rows) + `.doc-canon/code-ast-index.sqlite` (embedded SQLite store of symbols + refs via `node:sqlite`, built into Node ≥ 22.16) read via an `openCodeIndex` reader-facade (the same manifest-first dual-artifact pattern as `openCanonIndex`)
  - **Freshness** — stat-first via an internal fingerprint-keyed stat cache
    (`.doc-canon/code-index-stats.json`, outside the deterministic pair so `content_fingerprint` stability is preserved)
    that skips re-reading/re-hashing unchanged files; any create/update/delete or
    `grammar_versions` divergence triggers a full rebuild with poll-based watch and a separate
    pid-lock; freshness is reported independently (`code_index_stale` → warn,
    `code_index_missing` → fail closed)
- **Retrieval** (`searchCanon` from `doc-canon/search`) — opens the dual index artifacts through `openCanonIndex`, ranks indexed documents, and reads live canon files for bounded snippet windows:
  - scoring multiplies a term's contribution by 1.5 (`HEADING_WEIGHT`) when it is in the doc's heading set, and scales final scores by 0.5 (`FUTURE_PLANS_WEIGHT`) for any doc whose path contains a `future_plans` segment at any depth (canon-relative or root-relative key)
  - the query is expanded from a live-read glossary only for query terms equal to a heading token unique across all term headings (adding that entry's full token set; additive, fail-open when `GLOSSARY.md` is absent — common/ambiguous tokens get no expansion)
  - the thin `doc-canon search` CLI and skills consume the resulting context pack; the CLI `search` command self-heals a stale index (rebuild then re-run, `auto_reindexed` warning) when no watch owns it, and both search commands append one probe-log line per successful call
  - `check` merges `discipline` findings, and `doc-canon discipline` reports probe currency and exits ≠0 on un-probed state

## Interfaces

- `openCanonIndex` (`doc-canon/index-reader`) — stable reader facade over the canon dual artifact
- `searchCanon` (`doc-canon/search`) — ranked canon search returning a bounded context pack
- `openCodeIndex` (`doc-canon/code-index-reader`) — stable reader facade over the code manifest + SQLite store
- `searchCodeIndex` (`doc-canon/code-search`) — code symbol/refs search returning a bounded code pack
- CLI: `index`, `search`, `code-index build`, `code-index search`, `discipline` (see [CLI.md](CLI.md))

## Key flows

1. **Retrieve canon context** — `openCanonIndex` → `searchCanon` (`doc-canon/search`) →
   CLI/skills. Ranking uses the P0b artifacts, while snippets come from live files; P4/P5 scoring
   (stemming in the tokenizer path, heading weights, `future_plans/**` downweight, live-glossary
   expansion) applies at search time. P1 owns retrieval and the pack, not index construction,
   artifact IO, hashes, or watch behavior. Since P7, a stale index is self-healed at the CLI layer
   when no watch owns it, and every successful search is recorded in the probe log.
2. **Build code AST index** — `doc-canon code-index build` discovers source roots, parses source
   files with tree-sitter WASM into the normalized model, and writes the deterministic manifest +
   SQLite store; unchanged hashes are a no-op, any change or `grammar_versions` divergence triggers a
   full rebuild. `code-index search` queries that artifact at search time; agent rules for
   code-index-first analysis land with P2c.

## Dependencies

- `@vscode/tree-sitter-wasm` (pinned) — code AST extraction
- `micromatch` — ignore matching for source-root discovery and inventory
- `yaml` — contract parse

## Invariants

- Deterministic artifacts: identical corpus → identical logical content, verified by the manifest `content_fingerprint`; freshness caches live outside the deterministic pair.
- Stat-first freshness: unchanged files are neither read nor hashed; stat changes are content-hash-confirmed before a rebuild is triggered.
- Tokenizer/grammar changes force a full rebuild (`tokenizer_version` / `grammar_versions`) — a content hash alone cannot detect them.
- Stale indexes self-heal at the CLI layer when no watch owns them; `index_stale` / `code_index_stale` warn, missing index fails closed.
- Every successful search appends one probe-log line; `discipline` exits ≠0 on un-probed or corrupt state.

## Open questions

- Code-index specifics (per-language resolution boundaries) are tracked in [CODE_INDEX.md](CODE_INDEX.md) Open questions; this section has none open.

## Related canon

- [ARCHITECTURE.md](ARCHITECTURE.md) — layers and flows overview
- [CODE_INDEX.md](CODE_INDEX.md) — per-language extraction and resolution details
- [CLI.md](CLI.md) — command surface and `--json` pack shapes
- [GLOSSARY.md](GLOSSARY.md) — `index-manifest`, `doc_hash`, `code-ast-index`, `Syntactic reference`, `Member-access reference`
