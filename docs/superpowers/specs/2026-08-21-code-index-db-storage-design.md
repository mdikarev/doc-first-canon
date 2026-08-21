# P8 — Code index storage on SQLite — Design Spec

SoT for the P8 initiative: replace the monolithic `.doc-canon/code-ast-index.json` with an embedded
SQLite store via Node's built-in `node:sqlite`, so `doc-canon code-index build` and `code-index search`
scale past the V8 maximum-string-length failure on large repositories.

## Problem

`syncCodeIndex` (`src/code-index/sync.ts`) accumulates all extracted symbols and references into two
in-memory arrays, then `saveCodeIndexPair` → `writeJsonAtomic` (`src/code-index/io.ts`) serializes the
whole `CodeAstIndex` with `JSON.stringify(data, null, 2)`. On a large codebase that single string — made
larger still by `null, 2` pretty-printing — exceeds V8's maximum string length (~536,870,888 UTF-16 code
units, ≈512 MB) and the build throws. The artifact is one monolithic JSON file, so the failure is structural,
not incidental: both the writer and every reader materialize the entire index.

## Goals

- Remove the structural V8 string-length ceiling: stream rows into the store and query by index instead of materializing the whole artifact. (The resolver-input symbols bucket is the one remaining O(corpus) in-memory structure — see Open questions.)
- Accelerate the common substring search via SQLite FTS5 trigram (indexed) instead of a leading-`LIKE` scan.
- Keep the public surface and behavior identical: `doc-canon code-index build` / `code-index search`,
  the normalized symbol/reference model, and the exported `code-index-reader` / `code-search` shapes.
- Preserve a deterministic, verifiable index: rebuilds produce identical logical content, checked by a hash.
- Stay zero-native-module and zero-external-process (the documented discipline): `node:sqlite` is built in.

## Non-goals

- Server databases, native bindings, or WASM SQLite (see initiative "Out of scope").
- Incremental/partial-file indexing — full rebuild on change, as today.
- Changing search semantics: same `matchClass` ordering (exact > prefix > name-tokens > signature-tokens),
  same `--kind`/`--file`/`--refs`/`--body` behavior, same snippet windows.
- Pushing tokenization/stemming into SQL.

## Decisions

- **Backend:** `node:sqlite` (`DatabaseSync`), built into Node ≥ 22.16. `engines.node` bumps `>=20` →
  `>=22.16.0`. No new dependency.
- **Artifact:** `.doc-canon/code-ast-index.sqlite` replaces `.doc-canon/code-ast-index.json`.
  `code-index-manifest.json` stays JSON and bumps `schema_version` 1 → 2.
- **Determinism:** byte-identity is replaced by a `content_fingerprint` — SHA-256 over the logical rows
  streamed via `SELECT ... ORDER BY`, stored in the manifest. The sort key is **all** model columns
  (symbols: `name, kind, signature, file, line, end_line, scope`; refs: `kind, from_file, to_file, name, line`)
  — a total order: rows differing in any column are ordered, and byte-identical duplicates are order-
  irrelevant to the hash. Internal columns (`id`, `name_lower`, `signature_lower`) and `symbols_fts` are
  excluded.
- **Search:** `searchCodeIndex` queries SQLite directly. `openCodeIndex` keeps its frozen facade shape,
  materializing on demand for external callers only.
- **Search indexing:** an FTS5 trigram virtual table (`tokenize='trigram'`) over `name_lower` + `signature_lower`
  (both JS-folded via `toLowerCase()`, so folding is full-Unicode and SQL never folds case) narrows substring
  candidates with an index. Queries are built from the **stemmed** `tokenize(q)` tokens, not the raw string, so
  the trigram candidate set is a superset of every `matchClass` match; the JS `matchClass` rank and `LIMIT` are
  unchanged, and `LIKE` covers sub-3-character tokens. Confirmed available in `node:sqlite` (Node ≥ 22.16
  bundles FTS5 + trigram).
- **Case-insensitive exact/prefix:** a JS-computed `name_lower` column (full-Unicode `toLowerCase()`) with a
  b-tree index serves class-0/1 matches; `name` is kept as-extracted for round-trip fidelity. No reliance on
  SQLite's ASCII-only `lower()` / `COLLATE NOCASE`.
- **Store identity:** `PRAGMA application_id` (fixed magic `0x434F4445` = `'CODE'`) + `PRAGMA user_version`
  (mirrors manifest `schema_version`, bumped together) mark the file as a code-index store; an unexpected
  value fails closed like a corrupt store.
- **Inspection:** no dump/export command in this initiative — the store is inspectable with any SQLite tool
  (`sqlite3 .doc-canon/code-ast-index.sqlite 'SELECT * FROM symbols'`) and `openCodeIndex` remains the
  programmatic surface. A `dump` subcommand can be added later if the JSON-inspection regression bites.
- **`node:sqlite` warning:** Node ≥ 22.16 prints a one-time `ExperimentalWarning: SQLite is an experimental
  feature` to stderr on first use. Accepted and documented (cosmetic, stderr-only, once per process); not
  suppressed, and it does not change stdout, exit codes, or flags.
- **Migration:** full rebuild into SQLite; the stale JSON artifact is deleted after a successful write.
  No JSON→SQLite data conversion.

## Architecture

Two stores share one file: the small deterministic JSON manifest (freshness/identity) and the SQLite bulk
store (symbols + refs). Build writes both; search reads both. The manifest's existing `index_fingerprint`
(input fingerprint over file content hashes) is unchanged and continues to key `code-index-stats.json`.
The new `content_fingerprint` (output fingerprint over extracted rows) is the determinism check that
byte-identity used to provide.

```
syncCodeIndex ──► extractFile (per file) ──► INSERT batches ──► code-ast-index.sqlite
                                                              └─► content_fingerprint
searchCodeIndex ──► open store ──► FTS5 trigram narrow + matchClass rank ──► bounded CodePack
openCodeIndex (facade) ──► symbols()/references() materialize from SQLite on demand
```

## Components

### On-disk artifacts

| File | Role | Format |
| --- | --- | --- |
| `code-index-manifest.json` | identity + freshness + determinism | JSON, `schema_version: 2` |
| `code-ast-index.sqlite` | symbols + references bulk store | SQLite |
| `code-index-stats.json` | stat cache (fingerprint-keyed) | JSON, unchanged |

Manifest gains one field: `content_fingerprint` (string, `sha256:…`). Existing fields
(`index_fingerprint`, `corpus`, `grammar_versions`, `roots`, `files`) are unchanged.

### SQLite schema

```sql
-- Store identity + versioning (validated on open; mismatch => fail closed like a corrupt store).
PRAGMA application_id = 0x434F4445;  -- 'CODE' — marks a code-ast-index.sqlite store
PRAGMA user_version   = 2;           -- mirrors manifest schema_version; bump together

CREATE TABLE symbols (
  id              INTEGER PRIMARY KEY,  -- internal rowid: FTS content_rowid; never surfaced
  name            TEXT NOT NULL,        -- as extracted (round-trip fidelity)
  name_lower      TEXT NOT NULL,        -- name.toLowerCase() in JS (full Unicode) — class-0/1 key + FTS
  kind            TEXT NOT NULL,
  signature       TEXT NOT NULL,        -- as extracted
  signature_lower TEXT NOT NULL,        -- signature.toLowerCase() in JS (full Unicode) — FTS class-3 key
  file            TEXT NOT NULL,
  line            INTEGER NOT NULL,
  end_line        INTEGER NOT NULL,
  scope           TEXT NOT NULL
);
CREATE INDEX symbols_name_lower      ON symbols(name_lower);   -- case-insensitive exact/prefix (class 0/1)
CREATE INDEX symbols_file            ON symbols(file);
CREATE INDEX symbols_kind_name_lower ON symbols(kind, name_lower);

CREATE TABLE refs (
  kind      TEXT NOT NULL,
  from_file TEXT NOT NULL,            -- CodeReference.from (referencing file)
  to_file   TEXT NOT NULL,            -- CodeReference.to (target file)
  name      TEXT NOT NULL,            -- symbol/member name
  line      INTEGER NOT NULL
);
CREATE INDEX refs_name ON refs(name);

-- External-content FTS5: indexes the folded search keys without duplicating their text.
-- Populated in the same build transaction via `INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')`.
CREATE VIRTUAL TABLE symbols_fts USING fts5(
  name_lower, signature_lower, content='symbols', content_rowid='id', tokenize='trigram'
);
```

`CodeSymbol` maps field-for-field onto `name, kind, signature, file, line, end_line, scope`; `id`,
`name_lower`, and `signature_lower` are internal (the FTS `content_rowid` and the pre-folded search keys) and
are excluded from `content_fingerprint`, as is the `symbols_fts` table. Column mapping to the frozen refs
model: `CodeReference.from` → `from_file`, `CodeReference.to` → `to_file` (`from` is a SQL keyword and
`references` a FOREIGN KEY keyword, so the raw names are avoided; the table is `refs` rather than `references`
for the same reason). The build writes the store into a `.tmp` file and renames it into place (single writer);
readers open short-lived connections, so journal mode stays `DELETE` (default), one transaction per build.

### Reader facade (public library contract)

`openCodeIndex(root)` keeps its exact return shape — `{ symbols, references, manifest, liveHashes }`.
`symbols()`/`references()` open a short-lived `DatabaseSync` connection, `SELECT` only the model columns,
and map refs columns back to the frozen field names (`from_file` → `from`, `to_file` → `to`); internal
columns (`id`, `name_lower`, `signature_lower`) never leak through the facade (external callers only;
`searchCodeIndex` does not call them). `liveHashes()` is unchanged. The handle gains an optional `close()`
no-op-free form for callers that prefer explicit cleanup, but the default short-lived-connection strategy
keeps the synchronous shape and avoids leaked handles.

## Data flow & CLI

### `syncCodeIndex(root)`

1. Discovery and freshness (stat-first, hash-confirmed) are unchanged — reuse `discoverSourceRoots`,
   `listSourceFiles`, `tryLoadCodeIndexManifest`, `computeFingerprint`.
2. Open the store at `code-ast-index.sqlite` via a temp file (`.tmp`), `CREATE TABLE`/indexes, `BEGIN`.
3. For each file: `extractFile` → `INSERT` symbols (computing `name_lower`/`signature_lower` via JS
   `toLowerCase()`; `id` auto-assigns) and refs through prepared statements in bounded batches (e.g. flush
   every N rows). `fileMeta` still records `hash`/`language`/`symbols` per file.
4. Cross-file resolvers (`CROSS_FILE_RESOLVERS`) run as today over the in-memory `unresolvedMembers` bucket
   plus the symbols array (still accumulated as today, solely as resolver input); resolved refs are inserted
   in the same transaction. If the symbols array itself becomes the memory ceiling, resolvers move to reading
   symbols back via `SELECT` (see Open questions).
5. Populate `symbols_fts` via `INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')` (external content,
   same transaction), then compute `content_fingerprint` by streaming `SELECT ... ORDER BY` over **all** model
   columns (a total order; see Decisions) into SHA-256 — `id`, `name_lower`, `signature_lower`, and
   `symbols_fts` are excluded.
6. `COMMIT`, rename the temp SQLite file into place, then write the manifest **last** (atomic JSON as
   today — the manifest stays the commit marker), delete any legacy `code-ast-index.json`, write
   `code-index-stats.json`.

### `searchCodeIndex(root, query, opts)`

Replaces `handle.symbols()/references()` filtering with store queries; freshness (`liveHashes` +
`isFresh`) and snippet windows are unchanged. The guiding invariant: **the SQL candidate set is a superset
of every `matchClass` match**, so the JS rank + `slice(maxHits)` always sees everything it saw pre-migration.

- **Tokenize first in JS:** run `tokenize(q)` (same stemmer as `matchClass`); SQL narrowing runs on the
  **stemmed tokens**, never the raw query string (raw-string trigram would under-cover stemmed matches, e.g.
  `Readers` → `reader`). A query that tokenizes to zero tokens matches nothing, as today.
- **Exact/prefix (class 0/1):** `name_lower = ?` (exact) or `name_lower LIKE ?` with the full prefix
  pattern bound (`prefix + '%'`) on the `name_lower` b-tree index, with `PRAGMA case_sensitive_like = ON` on
  the search connection (both sides are pre-folded in JS, so a case-sensitive prefix scan is the correct,
  index-using comparison). The bound-whole-pattern form is required: `LIKE ? || '%'` defeats SQLite's LIKE
  optimization and forces a full scan.
- **Substring (class 2/3), token ≥ 3 chars:** `symbols_fts MATCH :token` — the token passed as a quoted FTS
  phrase over the folded `name_lower` + `signature_lower` (case-insensitive trigram substring). Multi-token:
  AND the quoted trigram terms — a superset of `all-tokens-in-name` ∪ `all-tokens-in-signature` (it also
  admits cross-column hits, which `matchClass` then drops). Tokens < 3 chars fall back to
  `LIKE '%token%'` over `name_lower`/`signature_lower` (indexless; short tokens are rare and cheap),
  single- and multi-token alike. Do not use `bm25()` — it is not meaningful for trigram.
- **Candidate pull order:** `ORDER BY file, line, id` (symbols) so the narrowed candidate iteration is
  deterministic; the final order is still `matchClass` (exact > prefix > name-substring > signature-substring),
  tie-broken file/line, then `slice(maxHits)` — SQL order never becomes the user-visible order.
- **Refs mode:** `WHERE name = :q ORDER BY from_file, line, rowid LIMIT maxHits` (the existing exact-name
  filter; the `rowid` tie-break mirrors today's stable-sort semantics).
- **`--kind`/`--file`:** `--kind` is a SQL predicate (`kind = ?`, `AND`ed with `name_lower`); `--file`
  filters by matching the glob in JS (`micromatch`) against the manifest's file set and passing a
  `file IN (...)` set — SQLite `GLOB` cannot faithfully express micromatch globs, so no GLOB translation.

### CLI surface

No flag or stdout change. `doc-canon code-index build`/`search` behave identically; only the artifact
file, the Node floor, and a one-time `ExperimentalWarning` on stderr change. `code_index_missing` /
`code_index_stale` / `auto_reindexed` semantics are unchanged.

## Error handling

- Missing or unopenable SQLite file → `code_index_missing` (existing fail-closed hint to build).
- Corrupt SQLite, unexpected `application_id`, or unsupported `user_version` → same fail-closed path
  (treat as missing).
- Build failure mid-transaction → `ROLLBACK`, delete the temp file, leave the previous artifact untouched
  (atomic swap, same discipline as `writeJsonAtomic`).
- Fingerprint mismatch between manifest and store on load → fail closed, hint rebuild.

## Testing

- **io:** SQLite round-trip (write → read symbols/refs/columns exactly).
- **sync determinism:** two builds of the same fixture produce equal `content_fingerprint` and equal
  `SELECT` content (replaces the old byte-identity golden check); a fixture with duplicate/edge rows hashes
  identically regardless of insertion order (total-order key, no insertion-order dependence).
- **Large corpus:** synthesize a corpus whose symbol count forces the old `JSON.stringify` path to exceed
  V8's string limit; assert the SQLite build completes and search returns the expected top hits.
- **Search parity:** existing `code-search` fixtures produce identical packs (same hits, ordering, snippets)
  before/after the storage swap.
- **FTS5 trigram:** substring queries (≥ 3 chars) return the same top hits and `matchClass` order as the
  pre-migration `LIKE` path; sub-3-char tokens use the `LIKE` fallback (single- and multi-token); stemmed-token
  queries (`Readers` → `reader`) and non-ASCII names match identically; parity asserted against fixtures. An
  `EXPLAIN QUERY PLAN` check guards that exact/prefix use the `name_lower` index.
- **Migration:** a repo with a legacy JSON artifact rebuilds cleanly into SQLite and drops the JSON; a
  simulated crash mid-build leaves the previous artifact pair intact and the next build self-heals.
- **Node floor:** guard or document that `node:sqlite` requires ≥ 22.16.
- **Store identity:** wrong `application_id` / `user_version` fails closed as missing; `user_version` and
  manifest `schema_version` bump together.

## Performance

- Build: prepared statements, single transaction, batched inserts — memory bounded by the per-file extract
  plus resolver input, not by total corpus size.
- Search: exact/prefix use the `name_lower` b-tree index (case-sensitive LIKE over pre-folded strings);
  substring uses the FTS5 trigram index instead of a leading-`LIKE` full scan; refs mode is an exact `name`
  index lookup. No full-table materialization on the CLI path.
- `liveHashes` continues to use the stat cache and only hashes changed files.

## Implementation order (after plan)

1. Bump `engines.node` and add the store module + schema.
2. Rewrite `syncCodeIndex` to stream into SQLite (incl. the FTS5 table) and compute `content_fingerprint`.
3. Rewrite `searchCodeIndex` to query the store via FTS5 trigram + `matchClass`; keep the facade on demand.
4. Update `io.ts`/`paths.ts`/`reader.ts`, bump `schema_version`, add migration drop of legacy JSON.
5. Port tests and add the large-corpus regression.
6. Absorb into canon via `canon-write` (ARCHITECTURE, CLI, INDEXING, CODE_INDEX, GLOSSARY, OVERVIEW,
   README) and mark the initiative `absorbed`.

## Relationship to prior artifacts

P2a ([`2026-08-18-p2a-code-ast-index-design.md`](2026-08-18-p2a-code-ast-index-design.md)) established the
dual-artifact pattern and byte-identity guarantee this spec revises for scale. P2b
([`2026-08-18-p2b-code-search-tools-design.md`](2026-08-18-p2b-code-search-tools-design.md)) defined the
search surface whose observable behavior this spec preserves. The byte-identity wording lives in
`INDEXING.md`, `GLOSSARY.md` (`code-ast-index`, `code-index-manifest`), and `ARCHITECTURE.md` — all
revised at absorption.

## Open questions

- Resolver input: can cross-file resolvers keep reading all symbols into memory at target scale, or must
  they query the store (deferred slice)? This is the one remaining O(corpus) in-memory structure.
- `node:sqlite` is Stability 1 (active development) and still prints an `ExperimentalWarning`: accept its
  API-churn risk and the warning, or pin a minimum Node minor as a stable dependency boundary.

## Related

- [`../canon/future_plans/p8-code-index-db-storage.md`](../canon/future_plans/p8-code-index-db-storage.md)
