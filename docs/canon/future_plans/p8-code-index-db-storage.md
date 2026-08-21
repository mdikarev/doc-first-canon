# P8 — Code index storage on SQLite (`node:sqlite`)

- **Status:** implementing
- **Focus:** Move the code AST index off a single monolithic JSON file onto an embedded SQLite store
  via Node's built-in `node:sqlite`, so `doc-canon code-index build` and `code-index search` scale
  past the V8 maximum-string-length failure that today kills builds on large repositories — and speed up
  symbol substring search via SQLite FTS5 trigram indexing.
- **Depends on:** P2a (code AST index construction) and P2b (code search tools) — both absorbed; this
  initiative changes only the storage/query substrate under their already-shipped pipeline and surface.
- **Unblocks:** Bounded-memory indexing and querying of large codebases (millions of symbols), and a
  durable query substrate for future code-side retrieval expansion.
- **Design:** [`docs/superpowers/specs/2026-08-21-code-index-db-storage-design.md`](../../superpowers/specs/2026-08-21-code-index-db-storage-design.md) — SoT for the migration.

## Intent

Today `syncCodeIndex` accumulates every extracted symbol and reference into in-memory arrays and
serializes the whole `CodeAstIndex` with one `JSON.stringify(..., null, 2)` into a single
`.doc-canon/code-ast-index.json`. On large codebases that one string exceeds V8's maximum string length
(~512 MB) and the build crashes. This initiative replaces the monolithic JSON artifact with an embedded
SQLite database written through Node's built-in `node:sqlite` module, streaming extracted rows in bounded
transactions during build and answering `code-index search` with SQL over indexed columns instead of
loading all symbols and references into memory; search also gains indexed substring matching through
SQLite's built-in FTS5 trigram tokenizer, turning the common leading-`LIKE` substring scan into an indexed
trigram `MATCH`. The normalized symbol/reference model, the source-root /
extraction pipeline, and the `code-index search` surface stay unchanged; only the storage backend, the
reader facade's data path, and the determinism guarantee change.

## In scope

- **Storage:** `.doc-canon/code-ast-index.sqlite` replaces `.doc-canon/code-ast-index.json`; the small
  `code-index-manifest.json` remains (bumped to `schema_version: 2` and extended with a deterministic
  `content_fingerprint` over the canonical-sorted logical content). `code-index-stats.json` is unchanged.
- **Schema:** `symbols(name, kind, signature, file, line, end_line, scope)` and
  `refs(kind, from_file, to_name, name, line)` with indexes on `name`, `file`, and `(kind, name)`, plus an
  FTS5 `symbols_fts(name, signature)` virtual table (`tokenize='trigram'`) for indexed substring search —
  mirroring the existing normalized model, no new per-language formats.
- **Build:** stream per-file extraction into batched `INSERT`s in one transaction instead of serializing
  one giant JSON array; the cross-file resolver keeps reading the symbols array (retained for resolution),
  revisited only if that array itself becomes the memory ceiling.
- **Search:** `searchCodeIndex` queries SQLite directly rather than materializing
  `handle.symbols()/references()` — FTS5 trigram narrows substring candidates (indexed, case-insensitive),
  then the existing `matchClass` ranking (exact > prefix > name-substring > signature-substring) and
  `LIMIT maxHits` preserve today's order; `LIKE` stays the fallback for sub-3-character queries.
- **Reader facade:** `openCodeIndex` keeps its frozen shape — `symbols()`/`references()` materialize
  from SQLite on demand; the CLI/search no longer depend on full materialization.
- **Determinism:** redefine byte-identical → deterministic logical content, verified by `content_fingerprint`.
- **Compatibility:** `engines.node` `>=20` → `>=22.13`; `schema_version: 1 → 2`; a full rebuild migrates
  an existing JSON index (old JSON dropped), and a missing/corrupt SQLite store fails closed with the existing
  `code_index_missing` hint.
- **Tests:** SQLite round-trip, content-fingerprint determinism, and a synthetic large-corpus build that
  fails under the old `JSON.stringify` and passes under SQLite.

## Out of scope

- Server databases (PostgreSQL/MySQL/…): violates the zero-external-process, `npx`-anywhere model.
- Native SQLite bindings (`better-sqlite3`) and WASM SQLite: the built-in `node:sqlite` keeps the
  documented no-native-modules discipline; WASM remains a fallback only if the Node engine bump is rejected.
- Pushing search ranking entirely into SQL (FTS5 narrows candidates only; the `matchClass` rank stays in
  JS, since SQLite lacks the token/stem logic and the exact > prefix > substring order).
- Incremental/partial-file indexing — full rebuild on change, as today.
- Changing the normalized symbol/reference model, extractors, source-root discovery, or the
  `code-index search` CLI surface.
- The canon BM25 documentation index (`doc-canon index`/`search`) — a separate artifact, untouched.

## Absorbs into

Likely: `ARCHITECTURE.md` (code-index building block: SQLite storage, streaming build, content
fingerprint), `CLI.md` (artifacts list, Node ≥ 22.13, `code-index build`/`search` storage note),
`INDEXING.md` (dual-artifact description), `CODE_INDEX.md` (determinism note), `GLOSSARY.md`
(`code-ast-index` and `code-index-manifest` redefined), `OVERVIEW.md` (Node engine / artifact note),
`README.md`. Any docs↔code divergence flows through the normal `DISCREPANCIES.md` path.

## Open questions

- Whether cross-file resolvers can stay fully in-memory at the target scale, or must themselves query the
  SQLite store for symbols (deferred slice).
- Exact `content_fingerprint` canonical form (sort key + field set) — settled in the design spec.
- `node:sqlite` is Stability 1.1 ("active development"): accept its API churn risk, or pin a minimum Node
  minor and treat it as a stable dependency boundary.
- Whether to keep a `--json`-style export/dump for human inspection now that the AST artifact is no longer
  plain text.
- FTS5 trigram scope: index `name` only vs `name` + `signature` (index-size trade-off for the substring
  fallback), and the exact sub-3-character fallback shape.
