# P2b — Code search tools — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Initiative:** [`p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)  
**Approach:** `code-index search` CLI over the P2a code AST index — deterministic substring symbol search with kind/file filters and a syntactic `--refs` mode, bounded results (path/line/kind/snippet windows), freshness at search time, mirroring the `doc-canon search` surface and pack-size policies.

This spec is the detailed SoT for **P2b**: the CLI search interface over the code AST index built by P2a. It uses only what the index already carries — symbols (`name`, `kind`, `signature`, `file`, `line`, `endLine`, `scope`) and syntactic references (`anchor`/`import`/`binding`) — no name resolution, no new extraction. Where this spec and the initiative disagree on P2b *details*, this spec wins.

## Problem

The P2a code AST index is inert without a way to probe it. Coding agents currently analyze a project by reading source files directly; when a change touches many files they pull whole trees into context — a direct token cost that grows with the language count. P2b adds the probe: query the code index by symbol name, kind, file, or syntactic references, and get bounded results (path/line/kind/short snippet windows) instead of whole files. At search time the code index's freshness is enforced: a stale code index warns, a missing code index fails closed with a hint to build it. This is the code-side analogue of `doc-canon search`, but over the code AST index — `doc-canon search` stays documentation-only.

## Goals

1. Ship `doc-canon code-index search <query>` on the existing CLI, mirroring `doc-canon search`'s human-first / `--json` output split.
2. Query the index by symbol name (case-insensitive substring), by kind, by file, and — syntactically — by references (`--refs`).
3. Emit **bounded** results: path/line/kind/signature plus short snippet windows from live file reads, never whole files.
4. Enforce freshness at search time: stale index warns; missing index fails closed with a hint to run `doc-canon code-index build`.
5. Expose a public library contract: `searchCodeIndex` from `doc-canon/code-search`, mirroring `doc-canon/search`.
6. Work on repositories **with and without** a canon (P2a principle), and be deterministic (identical index + query → identical JSON bytes).

## Non-goals

- Index construction, extractors, freshness machinery, watch (P2a)
- Agent / skill rules for code-index-first analysis (P2c) — the search surface stays CLI/library; P2c consumes it
- Cross-symbol / cross-file reference resolution beyond the syntactic references already in the index (deferred, explicitly expensive tier)
- Editing source through the CLI; the index is read-only analysis substrate
- `doc-canon search` / canon BM25 index: documentation search is a separate artifact over `docs/canon/**`
- Embeddings / vector retrieval over source
- A secondary in-memory index or partial/streaming JSON reads over the artifact — a single `JSON.parse` + linear scan is fast enough (see Performance)
- Git-diff analysis as the primary change signal

## Decisions

| Topic | Choice |
| --- | --- |
| Command surface | **`doc-canon code-index search <query>`** — subcommand of `code-index` (P2a already announced it); `--root`, `--json`, `--max-hits <n>` (default 10), `--snippet-lines <n>` (default 4), `--kind <type>`, `--file <glob>`, `--refs` |
| Library contract | New `src/code-search/` with `searchCodeIndex(root, query, opts) → CodePack`; package export **`doc-canon/code-search`** (mirror of `doc-canon/search`) |
| Query model (symbol mode) | Case-insensitive **substring** against symbol `name`; ordering **exact name > prefix > substring**, tie-break by `file`, then `line` (deterministic, no score) |
| Filters | `--kind` filters by `SymbolKind`; `--file` filters the posix-relative file path via `micromatch` |
| Reference mode | `--refs <name>`: scan `references` for matching `name`; hits are `{ file, line, refKind, name, from, to }` ordered by `file`, then `line`; purely syntactic (anchor/import/binding) |
| Pack shape | `{ query, mode: "symbols" \| "refs", freshness: "fresh" \| "stale", warnings: string[], hits }` |
| Symbol hit | `{ file, line, endLine, kind, name, signature, snippets: [{ start_line, text }] }` |
| Snippets | Live file read; symbol mode — declaration lines `[line..endLine]` capped at `--snippet-lines`; refs mode — window of `--snippet-lines` lines centered on the reference line |
| Pack-size caps | Mirror `doc-canon search` defaults: max-hits 10, snippet-lines 4, plus a total snippet-line cap (120) enforced across hits |
| Freshness | `openCodeIndex`; missing/corrupt → fail closed exit ≠0 with hint `run: doc-canon code-index build`; stale (manifest hashes vs `liveHashes()`) → warn `code_index_stale` on stderr, results still emitted |
| Human output | Mirror `doc-canon search`: `file  L<line>  <kind>  <name>` + indented snippet lines; refs: `file  L<line>  <refKind>  <name>  → <to>`; no score column |
| Performance | Single `JSON.parse` of the artifact + linear substring scan over the symbols/references arrays — O(index size); secondary structures are out of scope |

## Architecture

```text
doc-canon code-index search <query>
        │
        ▼
  openCodeIndex(root)              ── missing / corrupt → fail closed
        │                            (hint: run: doc-canon code-index build)
        ▼
  freshness = isFresh(manifest.files, liveHashes())
        │                            stale → warning code_index_stale (stderr)
        ▼
  symbol mode (default):
    scan symbols → name substring match → filters (kind, file)
    → order exact > prefix > substring, tie file, line
  refs mode (--refs):
    scan references → name match → order file, line
        │
        ▼
  cap hits to max-hits
        │
        ▼
  snippet windows from live file reads (snippet-lines each, total-line cap)
        │
        ▼
  human output or --json CodePack
```

**Invariants**

- Deterministic: identical index + identical query/flags → identical JSON bytes and identical human output
- No LLM, no external processes, no name resolution — purely what the index carries
- Bounded: max-hits cap, snippet-lines per window, total snippet-line cap across hits
- Freshness reported independently of the canon index: `code_index_stale` (warn) / `code_index_missing` (fail closed)
- Works with and without a canon

## Components

| Module | Role |
| --- | --- |
| `src/code-search/types.ts` | `CodePack`, `CodeSearchHit`, `CodeRefHit`, `CodeSearchOptions`, `CodeSearchError` |
| `src/code-search/search.ts` | `searchCodeIndex(root, query, opts)` — open index, freshness, symbol/refs matching, ordering, filters, snippet extraction, pack assembly |
| `src/code-index/reader.ts` (reuse) | `openCodeIndex` — manifest + ast, `liveHashes()` for freshness |
| `src/commands/code-index-search-cmd.ts` | CLI wiring: flag validation, human/JSON output, exit codes |
| `src/agnostic/ignore.ts` + `micromatch` (reuse) | `--file` glob matching |

### Pack shape

```ts
type CodeSearchHit = {
  file: string;
  line: number;
  endLine: number;
  kind: string;
  name: string;
  signature: string;
  snippets: { start_line: number; text: string }[];
};

type CodeRefHit = {
  file: string;    // referencing file (posix relative)
  line: number;
  refKind: "anchor" | "import" | "binding";
  name: string;
  from: string;
  to: string;
};

type CodePack = {
  query: string;
  mode: "symbols" | "refs";
  freshness: "fresh" | "stale";
  warnings: string[];
  hits: CodeSearchHit[] | CodeRefHit[];
};
```

`CodeSearchError` carries a code (`empty_query` | `code_index_unavailable`) mirroring `SearchError` in `src/search/types.ts`.

## Data flow & CLI

### `searchCodeIndex(root, query, opts)`

1. Trim query; empty → throw `empty_query` (CLI exits ≠0).
2. `openCodeIndex(root)`; missing/corrupt/schema mismatch → `code_index_unavailable` with hint `run: doc-canon code-index build` (CLI exit ≠0).
3. Freshness: compare `manifest.files` hashes against `liveHashes()` (the same `isFresh` logic as `src/search/search.ts`); stale → `freshness: "stale"`, warning `code_index_stale` (stderr in human mode).
4. **Symbol mode:** scan `symbols()`; case-insensitive substring match on `name`; apply `--kind` and `--file` filters; bucket by match class (exact name / prefix / substring); within a class order by `file`, then `line`.
5. **Refs mode (`--refs`):** scan `references()`; exact (case-sensitive) `name` match; order by `file`, then `line`.
6. Cap hits to `max-hits`.
7. Snippets: read the live file; symbol mode — lines `[line..endLine]` truncated to `snippet-lines` lines; refs mode — `snippet-lines` lines centered on the reference `line`. Enforce the total snippet-line cap across hits (120).
8. Return `CodePack`.

### CLI surface

| Invocation | Behavior |
| --- | --- |
| `doc-canon code-index search <query>` | Search over the code index; human summary on stdout |
| `--json` | Emit `CodePack` JSON on stdout |
| `--max-hits <n>` | Cap hits (default 10; ≥1) |
| `--snippet-lines <n>` | Lines per snippet window (default 4; ≥1) |
| `--kind <type>` | Filter symbols by `SymbolKind` |
| `--file <glob>` | Filter by file path (`micromatch` on posix-relative path) |
| `--refs <name>` | Reference mode (mutually exclusive with `--kind`/`--file` at the semantic level) |
| `--root <path>` | Same as other commands (default `.`) |

`--refs` takes its value as a flag rather than the positional query; the positional query is invalid in refs mode (fail closed if both given).

### Human output (symbol mode)

```
src/code-search/search.ts  L33  function  searchCodeIndex
    export function searchCodeIndex(root, query, opts) {
      ...
```

### Human output (refs mode)

```
src/index/reader.ts  L23  anchor  openCanonIndex  → src/index/reader.ts
src/search/search.ts  L4   import  openCanonIndex  → src/index/reader.ts
```

## Error handling

| Situation | Behavior |
| --- | --- |
| Empty query | `code-index search` fail closed, exit ≠0, `error: query required` |
| No code index (missing/corrupt/schema mismatch) | Fail closed, exit ≠0, `error: code index unavailable (…); run: doc-canon code-index build` |
| Stale code index | Warning `code_index_stale` on stderr; results still emitted; exit 0 |
| Invalid `--max-hits` / `--snippet-lines` (< 1) | Fail closed before start, exit ≠0 |
| Unknown `--kind` value | Fail closed before start, exit ≠0 |
| `--refs` with empty name | Fail closed, exit ≠0 |
| `--refs` + positional query / `--kind` / `--file` | Fail closed, exit ≠0 |
| `--file` glob matches nothing | Empty hits, exit 0 (not an error) |
| Live file read fails during snippet extraction | Emit the hit without snippets; skip file read errors (mirror `searchCanon`) |
| Unknown symbol kind in index | Passed through verbatim; no coercion |

## Testing

**Unit:** substring matching and ordering (exact > prefix > substring; file/line tie-break); `--kind` and `--file` filters; refs-mode matching and ordering; pack caps (max-hits, snippet-lines, total-line cap); snippet extraction (declaration-line window in symbol mode, centered window in refs mode); flag validation failures.

**Integration (temp fixtures + built index):** round-trip — search a fixture symbol returns the expected symbol hit with matching file/line/kind/signature; `--refs` over a fixture returns the expected anchor/import/binding sites; edit a source file after `code-index build` → `freshness: "stale"` + `code_index_stale` warning; no index → fail closed with build hint; determinism — identical fixture index + identical query → byte-identical `--json` output across two invocations.

**CLI:** `code-index search` listed in `--help`; exit codes for empty query, missing index, invalid flags; `--json` shape matches `CodePack`; human output format.

**Out of scope:** search over the canon index (unchanged), P2c rules, embeddings, other languages.

## Performance

Measured on this repository's own index (2.2 MB `code-ast-index.json`, 2719 symbols, 8320 references): file read ~6 ms, `JSON.parse` ~14 ms, substring scan ~1 ms — a full search ~20 ms. `JSON.parse` is linear in index size (≈100 ms per 10 MB), so even large repos stay well within probe-tool latency. The dominant cost at search time is the freshness hash-check over the live corpus (`liveHashes()`), which is inherited from `doc-canon search`'s design and already accepted. A secondary in-memory index would break the read-only deterministic artifact discipline and is deliberately out of scope.

## Implementation order (after plan)

1. Canon-first: refresh living `CLI.md` / `ARCHITECTURE.md` / `GLOSSARY.md` via `canon-write`; mark P2b **implementing** and point the initiative Design link at this spec via `canon-future-plan`.
2. Wait for explicit go-ahead after substantial canon updates.
3. Implement library: `src/code-search/types.ts`, `src/code-search/search.ts` (matching, ordering, filters, refs mode, snippets, pack assembly) + `package.json` export `doc-canon/code-search`.
4. Implement CLI `code-index search` (flag validation, human/JSON output, exit codes).
5. Absorb into living canon; mark P2b **absorbed**; P2c unblocks.

## Relationship to prior artifacts

| Artifact | Role after this spec |
| --- | --- |
| `p2b-code-search-tools.md` initiative | Follow-up via `canon-future-plan`: Design link → this spec; prose already settled at brainstorming |
| `2026-08-18-p2a-code-ast-index-design.md` | Index shape, `openCodeIndex` facade, freshness machinery P2b consumes unchanged |
| `2026-08-12-p1-retrieval-and-context-pack-design.md` | Reused surface: human-first / `--json` split, `SearchError` pattern, snippet-line caps |
| `docs/canon/CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md` | Living absorption targets (updated at implementation) |

## Open questions

None blocking design. Deferred to implementation plan only:

- Whether `--kind` accepts multiple values (e.g. `function,method`) in v1 or later — default: single value in v1
- Whether the refs-mode snippet window should also honor `--snippet-lines`' default 4 or a fixed 1-line anchor — default: same `--snippet-lines` as symbol mode
- Case-sensitivity of `--refs` name matching — default: exact case-sensitive (mirrors the index's stored names)

## Related

- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- [`docs/canon/future_plans/p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)
- [`docs/canon/future_plans/p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md)
- Living absorption targets: `CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md`
