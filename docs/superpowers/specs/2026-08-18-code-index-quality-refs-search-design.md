# Code index quality — refs/search slice (A+B) — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Scope:** Quality slice over the shipped code index (P2a/P2b absorbed): make `--refs` actually resolve cross-file on real ESM code, add call-site edges, multi-token + signature search, `--body` snippet windows, and exclude `.worktrees/**` from discovery.
**Approach:** Fix the ESM-extension resolution gap in the TS extractor, emit syntactic call-site edges reusing the `import` reference kind, extend symbol search to multi-token name/signature matching, add a `--body` flag that widens snippet windows to `endLine`, and add `.worktrees` to default ignore globs. No index schema change, no CodePack shape change, no name resolution, hash-driven determinism and freshness untouched.

This spec is the SoT for the A+B slice. It builds on the P2a/P2b design specs and the shipped `src/code-index/*` + `src/code-search/*` implementation. Where this spec disagrees with prior docs, this spec wins.

## Problem

Empirical tests of the shipped code index on this repository found four quality gaps:

1. **`--refs` is effectively dead on real code.** The index carries 8946 references, all intra-file (7782 `binding` + 1164 `anchor`), **zero** import edges, zero cross-file references. `--refs openCanonIndex` returns nothing even though `openCanonIndex` is imported in `src/search/search.ts:4` and used in `src/search/search.ts:40` plus three test files. Root cause: this repo's 149 relative imports use the ESM `.js`-extension convention (`from "../index/reader.js"`), but `resolveImportPath` (`src/code-index/extractors/typescript.ts`) only **appends** extensions to the specifier and never **substitutes** `.js` → `.ts`. Every relative import fails to resolve, so no import edge is emitted. The existing integration test (`tests/code-search.test.ts:175-187`) writes fixture imports **without** an extension, so it never exercises the failure.
2. **Snippet windows are too thin for understanding.** `declarationWindow` receives `endLine` (already in the index) but caps the window at `--snippet-lines` (default 4) lines, so function bodies never surface without opening the file.
3. **Multi-token queries return zero hits.** Symbol search matches the whole query string against the symbol `name` (`matchClass`), so `searchCodeIndex(repo, "bm25 tokenize")` → empty. Search never looks at `signature`.
4. **Worktree copies bloat the index.** Default discovery has no exclusion for `.worktrees/`, so this repo's index duplicates ~34% of symbols from `.worktrees/feat-p1-retrieval-search-pack/**`.

The canon (GLOSSARY, CLI, ARCHITECTURE) claims the code AST index carries import edges; on this codebase it carries none. That is a docs↔code divergence to be resolved by this slice (bugfix) and recorded in DISCREPANCIES.

## Goals

1. Resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` import specifiers to their TS/TSX sources so real-world relative imports emit import edges.
2. Emit **call-site edges**: identifier usages that resolve to an imported symbol get an `import`-kind reference from the using file to the definition file, so `--refs <name>` finds cross-file call sites.
3. Extend symbol search to **multi-token queries** that match against `name` and, as a fallback, `signature` — preserving current single-token behavior and determinism.
4. Add `--body` to widen symbol-mode snippet windows from declaration start to `endLine`, subject to the existing total-line cap.
5. Exclude `.worktrees/**` from code discovery by default.
6. Keep the index schema (`schema_version` 1, `symbols` + `references`, `ReferenceKind = anchor | import | binding`) and the `CodePack` shape unchanged; keep hash-driven determinism and freshness intact.

## Non-goals

- Adding a new reference kind (`call`) or extending `ReferenceKind` — call sites reuse `kind: "import"` (both are syntactic file→file dependency edges carrying a name); a new kind would change the model, the docs, and the readers for marginal clarity.
- Alias handling (`import { X as Y }`) — direct imported names only in v1 (documented limitation).
- Extractor changes for Go / Rust / C# / Python — each has its own import conventions; this repo is 175/177 files TypeScript. Their resolution behavior is unchanged.
- Full cross-symbol / cross-file reference resolution with name resolution — remains the deferred, explicitly expensive tier from P2a.
- Binary index format, embedding bodies in the index, or any format/performance restructuring (size is not the problem; query quality and reference completeness are).
- Changes to `doc-canon search` / canon BM25 index.
- Refs-mode query semantics (stays exact, case-sensitive — asserted by `tests/code-search.test.ts:189-194`).

## Decisions

| Topic | Choice |
| --- | --- |
| ESM resolution | `resolveImportPath` gains a substitution pass: specifiers ending `.js`/`.jsx`/`.mjs`/`.cjs` also try `.ts`/`.tsx`/`.mts`/`.cts` (and `index.*` fallback), before the existing append-ext candidates; extensionless specifiers unchanged |
| Call-site edges | In `collectAnchorAndBindingRefs` (or a sibling pass), an identifier usage that (a) is not a declaration, (b) is not in an import context, and (c) matches a resolved imported name emits `{ kind: "import", from, to: <definition file>, name, line }`; checked before the local `binding`/`anchor` fallthrough |
| Reference kind | Reuse `"import"` for call sites — no `ReferenceKind` change |
| Search query model | Tokenize the query; a symbol matches when every token is a case-insensitive substring of `name` **or** `signature`. Buckets: exact-name (0) > name-prefix of whole query (1) > every-token-in-name (2) > every-token-in-signature (3); within a bucket order by `file`, then `line` |
| Snippets | Symbol mode gains `body?: boolean`: window `[line..endLine]` (instead of `[line..line+snippetLines-1]`), still clamped by `maxSnippetLinesTotal` (120) across hits |
| CLI | `--body` flag on `code-index search` (symbol mode only; fail closed with `--refs`); `--snippet-lines` still honored when `--body` is absent |
| Worktrees | Add `.worktrees` to `DEFAULT_EXCLUDES` in `src/agnostic/ignore.ts` (canonical ignore helper, already consulted by discovery and `liveHashes()`); no effect on the canon index (corpus is `docs/canon/**`) |
| Freshness / determinism | Unchanged — pure functions over the CST, hash-driven rebuild, stable ordering |
| Refs mode | Unchanged: exact, case-sensitive match on `ref.name`; ordering by `file`, `line` |

## Architecture

```text
code-index build (extractor, TS/JS only in this slice)
    │
    ├─ resolveImportPath        + ESM extension substitution (.js→.ts …)
    ├─ collectImportEdges       unchanged (now resolves on real code)
    ├─ collectAnchorAndBindingRefs   unchanged (binding/anchor)
    └─ NEW sibling pass: call-site — imported-name usages emit
                         kind:"import" edges to the definition file
        │
        ▼
code-ast-index.json  (same schema, same ReferenceKind set)
        │
        ▼
code-index search <query>  (src/code-search/search.ts)
    ├─ symbol mode: multi-token name/signature match, buckets 0-3
    ├─ symbol mode + --body: window [line..endLine]
    └─ refs mode: exact name over all reference kinds (now incl. real import + call-site edges)
```

**Invariants**

- Index schema and `CodePack` shape unchanged; existing readers unchanged.
- Deterministic: identical index + identical live corpus + identical query/flags → identical bytes.
- No name resolution; call-site edges are syntactic (imported-name match), as P2a's "cheap syntactic references" tier promises.
- Freshness and pack-size caps unchanged.
- `.worktrees/**` excluded from discovery by default for all consumers of `isIgnored`.

## Components

| Module | Change |
| --- | --- |
| `src/code-index/extractors/typescript.ts` | `resolveImportPath` substitution pass; call-site edge pass reusing `collectImportNames` results |
| `src/agnostic/ignore.ts` | `.worktrees` added to `DEFAULT_EXCLUDES` |
| `src/code-search/search.ts` | Multi-token `matchClass` (name/signature, buckets 0–3); `body` option widening the declaration window |
| `src/code-search/snippets.ts` | `declarationWindow` honors `body` (window to `endLine`) |
| `src/commands/code-index-search-cmd.ts` | `--body` flag; fail closed when combined with `--refs` |

No change: `src/code-index/sync.ts`, `io.ts`, `reader.ts`, `types.ts`, `discovery.ts` (ignore globs flow through `isIgnored` unchanged), the canon index, `doc-canon search`.

### Call-site edge shape

```ts
// emitted in addition to import-statement edges
{ kind: "import", from: "src/search/search.ts", to: "src/index/reader.ts", name: "openCanonIndex", line: 40 }
```

`--refs openCanonIndex` then returns both the import-statement site (`src/search/search.ts:4`) and the call site (`src/search/search.ts:40`), each with a live-file snippet.

## Data flow & CLI

### Symbol mode matching

1. Tokenize the trimmed query (reuse `src/index/tokenize`).
2. A symbol matches iff every token is a case-insensitive substring of `name` or `signature`.
3. Bucket by class: 0 exact name == query; 1 `name` starts with the whole query; 2 every token in `name`; 3 every token in `signature` (and not all in `name`). Within a bucket, order by `file`, then `line`.
4. Single-token queries reproduce today's exact/prefix/substring ordering exactly (bucket 2 collapses to the single-token substring case).

### CLI surface (additions only)

| Invocation | Behavior |
| --- | --- |
| `--body` | Symbol mode only; snippet window runs to `endLine` (still capped by the total 120-line pack cap). Fail closed with `--refs` |

### Refs mode

Unchanged semantics; the improvement is purely in the data — real import edges and call-site edges now exist, so exact-name matches return cross-file hits.

## Error handling

| Situation | Behavior |
| --- | --- |
| `.js` specifier that does not resolve to a `.ts`/`.tsx` source | No edge (as today for unresolvable specifiers) |
| Imported name used but never imported | Falls through to existing `binding`/`anchor` logic |
| Alias import `{ X as Y }` | Usage of `Y` not matched in v1 (documented limitation) |
| `--body` combined with `--refs` | Fail closed, exit ≠0 |
| `--body` with an index symbol whose `endLine` is missing/stale | Falls back to `snippetLines` window |
| Stale / missing index | Unchanged (`code_index_stale` warn, `code_index_missing` fail closed) |

## Testing

**Unit:** `resolveImportPath` cases — `.js`→`.ts`, `.jsx`→`.tsx`, `.mjs`→`.mts`, `.cjs`→`.cts`, `index.js`→`index.ts`, extensionless unchanged, unresolvable → null. Multi-token `matchClass` buckets (exact > prefix > name-tokens > signature-tokens; file/line tie-break; single-token equivalence). `declarationWindow` with `body` (window to `endLine`, cap respected).

**Integration (temp fixtures + built index):**
- Regression for the real bug: fixture writes `import { Reader } from "./reader.js"` → `syncCodeIndex` → `--refs Reader` returns the import edge (`from: src/main.ts`, `to: src/reader.ts`).
- Call-site edge: `src/main.ts` calls a function imported from `src/reader.ts` → `--refs <fn>` includes the call-site line.
- Multi-token: `searchCodeIndex(repo, "search code index")` finds `searchCodeIndex`; a query whose tokens only land in `signature` still matches (bucket 3).
- `--body`: symbol-mode hit snippet runs past `--snippet-lines` up to `endLine`.
- `.worktrees/**` absent from `listSourceFiles` on a fixture with a `.worktrees` subtree.
- Dogfood: rebuild this repo's own index → nonzero import edges and cross-file call-site edges appear; `--refs openCanonIndex` returns `src/search/search.ts` lines.

**Regression:** all existing `tests/code-index*.test.ts`, `tests/code-search.test.ts`, `tests/code-analysis-token-guard.test.ts` pass unchanged (extensionless fixtures still resolve; refs exactness and determinism asserts hold).

**Out of scope:** other-language extractors, index format, canon search, embeddings.

## Performance

No structural change to search cost (single `JSON.parse` + linear scan, as P2b measured ~20 ms on this repo). The extractor gains a linear identifier-usage pass per file and a substitution pass in path resolution; build time impact is negligible (a rebuild of 190 files, 15 changed, measured ~1.8 s on this repo). Excluding `.worktrees/**` shrinks the index (~34% fewer symbols on this repo) and therefore shrinks both build and scan cost.

## Implementation order (after plan)

1. Canon-first: `canon-write` — GLOSSARY (import edges now include call-site edges and note ESM resolution), CLI.md (`--body`, multi-token/signature search semantics), ARCHITECTURE.md (ESM-extension resolution, `.worktrees` default exclude); add a DISCREPANCIES entry for the found divergence (docs promise import edges; index carried zero due to the `.js`-specifier bug — resolved by this slice).
2. Wait for explicit go-ahead after the substantial canon updates.
3. Implement extractor (resolution + call-site edges), then search/snippets (`matchClass`, `body`), then CLI (`--body`), then ignore defaults — TDD throughout against the tests above.
4. Rebuild this repo's index and confirm dogfood outcomes.
5. `canon-audit` to close.

## Relationship to prior artifacts

| Artifact | Role |
| --- | --- |
| `2026-08-18-p2a-code-ast-index-design.md` | Index shape, extractor model, `ReferenceKind` — consumed unchanged; this slice fixes the resolution gap in the shipped extractor |
| `2026-08-18-p2b-code-search-tools-design.md` | Search surface, `matchClass`, snippet windows, refs semantics — extended by multi-token/signature matching and `--body` |
| `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` | Living absorption targets (updated at canon-first) |
| `docs/canon/DISCREPANCIES.md` | Records the found divergence, resolved by this slice |

## Open questions

None blocking design. Deferred to implementation:

- Whether bucket 3 (signature-only) should rank above or below bucket 2 — default: name tokens (2) above signature tokens (3), keeping name the primary key.
- Whether `--body` should also widen refs-mode centered windows — default: no (fail closed), refs mode stays centered.

## Related

- [`docs/canon/future_plans/p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)
- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- [`docs/canon/future_plans/p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md)
- Living absorption targets: `CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md`
- `src/code-index/extractors/typescript.ts`, `src/code-search/search.ts`, `src/code-search/snippets.ts`, `src/agnostic/ignore.ts`
