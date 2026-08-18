# P2a — Code AST index (slice 1: TypeScript/JavaScript) — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Initiative:** [`p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)  
**Approach:** Source-root discovery → tree-sitter WASM extraction → shared symbol/reference model → byte-deterministic dual artifact + poll watch + reader facade

This spec is the detailed SoT for **P2a, slice 1**: a full end-to-end pipeline for **TypeScript/JavaScript** (discovery → extraction → index → CLI → watch → facade → tests), including References v1 (same-file anchors, import/export edges, in-scope local bindings). Remaining languages (Go, C#, Rust, GDScript, Python) are subsequent vertical slices reusing the slice-1 pipeline shape and are **out of scope here**. Where this spec and the initiative disagree on P2a *details*, this spec wins.

## Problem

Coding agents currently analyze a project by reading source files directly; when a change touches many files they pull whole trees into context — a direct token cost that grows with the language count. The canon's own retrieval discipline (Scout a small working set, expand only when unsure) stops at documentation; there is no code-side equivalent. This slice builds the probe's first vertical: a deterministic AST index over the project's discovered TypeScript/JavaScript source roots, plus the CLI/watch/facade surface the remaining languages will reuse.

## Goals

1. Ship `doc-canon code-index build` (one-shot) and `--watch` / `--stop` that keep a code AST index aligned with the project's source roots, independent of the canon documentation index.
2. Discover where code lives: explicit config > manifests > extension scan, with a VCS root as the project boundary — code roots are found, not assumed.
3. Extract TypeScript/JavaScript symbols and syntactic references via a single tree-sitter WASM pipeline (`@vscode/tree-sitter-wasm`, pinned) normalized into a shared `{ name, kind, signature, file, line, endLine, scope }` model — no per-language output formats.
4. Produce a **byte-deterministic** dual artifact (`.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`) with hash-driven freshness: identical input → identical bytes.
5. Expose a **public contract**: dual artifacts plus a thin stable reader facade `openCodeIndex` (package export `doc-canon/code-index-reader`), mirroring `openCanonIndex`.
6. Work on repositories **with and without** a canon.

## Non-goals

- CLI search over the index (`code-index search` → P2b), agent/skill code-index-first rules (→ P2c)
- Languages other than TypeScript/JavaScript in this slice (Go/C#/Rust/GDScript/Python are later slices)
- Cross-symbol / cross-file reference resolution (deferred, explicitly expensive tier); type inference; call-graph inference
- Embeddings / vector retrieval over source; editing source through the index
- Incremental per-language index updates (full rebuild only, like the canon index)
- Git-diff analysis as the primary change signal; `fs.watch` (v1 is poll-only)
- Honoring the canon contract's `policies.ignore` — the code index config is **fully independent**
- `index_id` / `built_at` in the code manifest (those would break byte-determinism)

## Decisions

| Topic | Choice |
| --- | --- |
| Decomposition | Vertical slices, **TS/JS first**; P2a stays one initiative, slices live in this spec / the implementation plan |
| WASM runtime + grammars | **`@vscode/tree-sitter-wasm`** (pinned exact version) — covers TS/JS/Go/C#/Rust/Python; GDScript resolved separately in its own slice |
| Grammar versioning | **Stamp mechanism:** `GRAMMAR_VERSIONS` constant in `src/code-index/grammar-versions.ts` written into the manifest as `grammar_versions`; divergence → full rebuild (like `skills_stamp`) |
| Determinism | **Byte-deterministic** manifest: no `index_id`, no `built_at`; identical input + identical grammar versions → identical artifact bytes |
| Config | `.doc-canon/code-index.json` (explicit `roots`, `ignore`, per-root `languages`); precedence **explicit config > manifests > extension scan** |
| Contract coupling | Config fully independent of canon contract `policies.ignore` |
| References v1 | **In this slice** for TS/JS: same-file anchors, import/export edges, in-scope local bindings (CST-only, no name resolution) |
| Update model | **Logical incremental:** hash diff detects create/update/delete; any change **or** `grammar_versions` divergence → full rebuild from all current files |
| Watch mechanism | Poll only (`setInterval`); default 2000 ms; `--interval <ms>` (min 200); foreground process; **separate pid file** `.doc-canon/code-index-watch.pid` |
| Writer concurrency | One-shot `code-index build` refuses if code-index watch pid is alive (exit ≠0) |
| Artifact consistency | Both files from one rebuild; manifest written **last** as commit marker; reader fail closed on missing/corrupt/schema mismatch; shared deterministic `index_fingerprint` (sha256 over sorted `rel:hash`) — mismatch → reader fail closed |
| Corpus | Discovered source roots under the VCS root, filtered by the ignore set |
| CLI ownership | `code-index build` with `--root`, `--watch`, `--stop`, `--interval`; `code-index search` lands with P2b |
| Package export | `doc-canon/code-index-reader` → `openCodeIndex`, shipped in this slice so tests and future P2b share one stable interface |

## Architecture

```text
VCS root (up-search .git)
        │
        ▼
  discoverSourceRoots(root)     ◄── config > manifests > extension scan
        │                        (slice 1: package.json → TS/JS root;
        │                          go.mod/Cargo.toml/etc. recognized but not indexed)
        ▼
  listSourceFiles(roots)         ◄── ignore set (node_modules, vendor, …) + config overrides
        │
        ▼
  parse each file with tree-sitter WASM
        │        ├─ .ts  → typescript grammar
        │        ├─ .tsx → tsx grammar
        │        ├─ .js/.mjs/.cjs → javascript grammar
        │        └─ extract symbols + references into shared model
        ▼
  syncCodeIndex(root)
        ├─ hashes == manifest && grammar_versions match? ──► no-op (fresh)
        └─ any create/update/delete or grammar bump
                 ▼
        rebuild full index from all current files
                 ▼
   .doc-canon/code-ast-index.json      (tmp+rename first)
   .doc-canon/code-index-manifest.json (tmp+rename last)

doc-canon code-index build        → one-shot sync (fails if code-index watch pid alive)
doc-canon code-index build --watch→ poll → sync
doc-canon code-index build --stop → SIGTERM watch via pid file

P2b later:
  import { openCodeIndex } from "doc-canon/code-index-reader"
  openCodeIndex(root) → { symbols, references, manifest, … }
```

**Invariants**

- Deterministic; no LLM; no external processes
- Artifacts under `.doc-canon/` (typically gitignored)
- Unchanged hashes + unchanged `grammar_versions` → do not rewrite artifacts
- Manifest written **last** as the commit marker after a successful code-ast-index write
- Same pipeline shape (discovery → extraction → model → artifact → CLI → facade) reused by later language slices

## Components

| Module | Role |
| --- | --- |
| `src/code-index/grammar-versions.ts` | `GRAMMAR_VERSIONS: Record<string, string>` constant; bump together with `@vscode/tree-sitter-wasm` |
| `src/code-index/discovery.ts` | `discoverSourceRoots(root)` — VCS up-search, manifest detection, sibling/nested root rules, extension fallback; slice 1 detects TS/JS roots |
| `src/code-index/config.ts` | Load/merge `.doc-canon/code-index.json` (roots, ignore, languages); precedence rules |
| `src/code-index/list.ts` | Walk discovered roots, apply ignore set, posix-relative paths |
| `src/code-index/extractors/typescript.ts` | tree-sitter WASM parse of one file → `{ symbols, references }` in the shared model |
| `src/code-index/model.ts` | `SymbolKind`, `CodeSymbol`, `CodeReference` types |
| `src/code-index/sync.ts` | `syncCodeIndex(root)` — hash diff, freshness, full rebuild, artifact write |
| `src/code-index/io.ts` | Load/save dual artifact; atomic tmp+rename; schema_version checks |
| `src/code-index/watch.ts` | Poll loop; pid lock acquire/release on SIGINT and SIGTERM |
| `src/code-index/reader.ts` | **Stable facade** for P2b; published as `doc-canon/code-index-reader` |
| `src/commands/code-index-cmd.ts` | CLI wiring |
| `src/agnostic/ignore.ts` (reuse) | Default ignore globs via `micromatch` |

### On-disk artifacts

**`code-index-manifest.json`** (byte-deterministic — no `index_id`, no `built_at`; pair consistency is carried by a deterministic `index_fingerprint`)

```json
{
  "schema_version": 1,
  "index_fingerprint": "sha256:<hash over sorted rel:hash entries>",
  "corpus": "src/**",
  "grammar_versions": { "typescript": "0.23.2", "javascript": "0.25.0" },
  "roots": ["src"],
  "files": {
    "src/index.ts": { "hash": "sha256:…", "language": "typescript", "symbols": 42 }
  }
}
```

**`code-ast-index.json`**

```json
{
  "schema_version": 1,
  "index_fingerprint": "sha256:<same value as the manifest>",
  "symbols": [
    { "name": "openCanonIndex", "kind": "function", "signature": "function openCanonIndex(root: string): CanonIndexHandle", "file": "src/index/reader.ts", "line": 15, "endLine": 29, "scope": "" }
  ],
  "references": [
    { "kind": "import", "from": "src/commands/search.ts", "to": "src/index/reader.ts", "name": "openCanonIndex", "line": 5 },
    { "kind": "anchor", "from": "src/index/reader.ts", "to": "src/index/reader.ts", "name": "openCanonIndex", "line": 23 },
    { "kind": "binding", "from": "src/index/reader.ts", "to": "src/index/reader.ts", "name": "root", "line": 15 }
  ]
}
```

`index_fingerprint` is the byte-deterministic replacement for the canon index's opaque `index_id`: sha256 over the sorted `rel:hash` entries of the rebuilt corpus, present in both files. Mismatch → reader fail closed; identical input → identical fingerprint. **Write order:** build full symbol/reference set → write `code-ast-index.json` (tmp+rename) → write `code-index-manifest.json` with the same `index_fingerprint`/hashes/`grammar_versions` (tmp+rename).

### Reader facade (P2a public library contract)

Package export (add to `package.json` `exports`):

```ts
import { openCodeIndex } from "doc-canon/code-index-reader";
```

`openCodeIndex(root)`:

- Loads manifest + ast pair or throws if missing/corrupt/schema mismatch
- `.symbols(): CodeSymbol[]`, `.references(): CodeReference[]`
- Exposes manifest / per-file hashes so P2b can compute `code_index_stale` without reimplementing IO
- May expose a helper to recompute live hash set for freshness (implementation detail; keep stable)

Internal modules may change as long as facade + `schema_version` policy hold.

## Data flow & CLI

### `syncCodeIndex(root)`

1. Resolve VCS root (up-search `.git`); missing → fail closed.
2. Discover source roots via precedence: **config > manifests > extension scan**; slice 1 indexable files are `.ts/.tsx/.js/.mjs/.cjs`.
3. List files under roots, apply default ignore + config overrides.
4. Read each file → hash + parse to symbols/references for a possible rebuild.
5. Load existing manifest if present; missing/unreadable → treat as empty.
6. Diff: new / changed hash / deleted. Also compare current `GRAMMAR_VERSIONS` against manifest `grammar_versions`.
7. No diff and matching `grammar_versions` → `{ status: "fresh", indexed: N }` (leave artifacts untouched).
8. Diff or grammar bump → rebuild full index from **all** current files → write `code-ast-index.json` then `code-index-manifest.json` via tmp+rename → `{ status: "updated", indexed: N, changed: […] }`.

**Cost:** every sync (including each watch poll tick) reads, hashes, and parses the full corpus. `fresh` skips artifact rewrite. Acceptable for small repos; do not promise a cheap watch.

### CLI surface

| Invocation | Behavior |
| --- | --- |
| `doc-canon code-index build` | One-shot sync; exit 0 on fresh/updated; human summary on stdout; **exit ≠0 if code-index watch pid is alive** |
| `doc-canon code-index build --watch` | Initial sync, then poll; default interval **2000 ms**; `--interval <ms>` (min 200) |
| `doc-canon code-index build --stop` | Stop running watch via pid file |
| `--root <path>` | Same as other commands |

`--json` CLI output is out of scope for P2a v1.

**Flag rules:** `--interval` is valid only with `--watch`; `--watch` and `--stop` together → fail closed before start. Mutually exclusive with canon `index` flags only in that they are separate commands; code-index watch uses its **own** pid file and does not collide with the canon index watch.

### Watch UX (human workflow)

Watch is a **foreground long-lived process**, not a hidden daemon; identical discipline to `doc-canon index --watch`, but with pid file `.doc-canon/code-index-watch.pid`:

1. Operator runs `doc-canon code-index build --watch` in a terminal tab.
2. First sync runs immediately; subsequent ticks poll and sync.
3. End of session → Ctrl+C (SIGINT) **or** `doc-canon code-index build --stop` (SIGTERM) from another terminal.
4. Without watch, run one-shot `doc-canon code-index build` after substantive source changes.

**Single-instance:** `.doc-canon/code-index-watch.pid`. Second `--watch` exits ≠0 with `already running (pid N)`. Stale pid → take over after cleanup.

**One-shot vs watch:** if code-index watch pid is alive, one-shot `doc-canon code-index build` exits ≠0 with a message such as `watch running (pid N); stop it or rely on watch`.

**`--stop`:** read pid → SIGTERM → remove lock. Not running / stale → exit 0, idempotent message (`not running`), clean stale lock if needed.

**Signals:** watch handles **SIGINT and SIGTERM**; both paths release the pid lock on exit. Watch logs updates only when `status === "updated"`.

## Error handling

| Situation | Behavior |
| --- | --- |
| No VCS root (no `.git` up-search) | `code-index build` fail closed, exit ≠0, with a hint to pass `--root` |
| No code roots discovered (no manifest, no matching files) | Write empty-but-valid artifacts; exit 0; symbols/references empty |
| Corrupt / unreadable / schema mismatch artifacts | Writer treats as empty and full-rebuilds; `openCodeIndex` fail closed |
| Partial write (crash between ast and manifest) | Reader fail closed; next build rebuilds both |
| `grammar_versions` divergence (dependency bumped) | Full rebuild on next build; artifact bytes reflect new grammar |
| Watch already running | `--watch` exit ≠0 + pid message |
| One-shot while watch alive | exit ≠0 + pid message |
| `--stop` idle / stale | exit 0 + cleanup |
| Transient I/O error mid-watch | Log stderr; keep polling |
| Source root disappears during watch | exit ≠0 |
| Invalid `--interval`, `--interval` without `--watch`, `--watch`+`--stop` | fail closed before start |
| tree-sitter parse error on a file | Extract what the CST yields (error nodes skipped); record no crash; parse result is deterministic |

## Extraction model (slice 1: TypeScript/JavaScript)

```ts
type SymbolKind =
  | "class" | "interface" | "enum" | "struct" | "trait"
  | "function" | "method" | "property" | "module" | "const" | "type";

type CodeSymbol = {
  name: string;
  kind: SymbolKind;
  signature: string;      // deterministic signature text from the CST
  file: string;           // posix path relative to root
  line: number;
  endLine: number;
  scope: string;          // nested scope path, e.g. "MyClass"
};

type CodeReference = {
  kind: "anchor" | "import" | "binding";
  from: string;           // source file (posix relative)
  to: string;             // target file (posix relative); may equal from
  name: string;
  line: number;
};
```

**Grammar selection by extension:** `.ts` → `typescript`, `.tsx` → `tsx`, `.js`/`.mjs`/`.cjs` → `javascript`.

**Node-type mapping (illustrative, locked in extractor tests):**

| tree-sitter node | kind |
| --- | --- |
| `class_declaration` | `class` |
| `interface_declaration` | `interface` |
| `enum_declaration` | `enum` |
| `function_declaration` | `function` |
| `method_definition` | `method` |
| `property_signature` / `public_field_definition` | `property` |
| `lexical_declaration` (const) | `const` |
| `type_alias_declaration` | `type` |
| `internal_module` / `module` | `module` |

**References v1:**

- `anchor` — a usage of a symbol resolves to its declaration in the same file (CST-only, no name resolution).
- `import` — `import {x} from "./y"` produces an edge from the current file to the target module file; `./y` resolved to a file path via the existing file list (no cross-symbol resolution).
- `binding` — an identifier resolves to the nearest in-scope declaration within the same file.

## Testing

**Unit:** grammar version stamp; discovery precedence (config > manifest > extension); ignore matching (default + config overrides); extractor symbol mapping per grammar (typescript/tsx/javascript); reference extraction (anchor/import/binding); model serialization.

**Sync integration (temp fixtures):** first build creates both files; second unchanged run → `fresh` (byte-identical artifacts, no rewrite); edit one file → `updated`; delete file → removed; `GRAMMAR_VERSIONS` bump → `updated` even with unchanged hashes; corrupt artifact → rebuilt; monorepo fixture (sibling `package.json` → separate roots); code outside `src/` fixture; repo without manifest → extension fallback.

**Determinism (golden snapshot):** identical fixture input + fixed grammar version → byte-identical `code-index-manifest.json` and `code-ast-index.json` across two builds.

**CLI:** `code-index` group listed in `--help`; `build` without VCS root → ≠0; second `--watch` fails; one-shot fails when code-index watch pid alive; `--stop` stops / idempotent; invalid flag combos fail closed.

**Facade:** `openCodeIndex` after sync; throws on missing/corrupt; symbols/references match fixture expectations.

**Watch cleanup:** SIGINT and SIGTERM release pid lock.

**Out of scope:** code search, skill flows, embeddings, other languages.

## Implementation order (after plan)

1. Canon-first: refresh living `CLI.md` / `ARCHITECTURE.md` / `GLOSSARY.md` / `OVERVIEW.md` via `canon-write` — **done** in this session; point the initiative Design link at this spec via `canon-future-plan`.
2. Wait for explicit go-ahead after substantial canon updates.
3. Implement library: grammar-versions, model, config, discovery, list, extractor (TS/JS), sync, io, reader + `package.json` export `doc-canon/code-index-reader`.
4. Implement CLI one-shot `code-index build` (including watch-pid guard).
5. Implement watch pid lock + poll + `--stop` + signal cleanup.
6. Absorb into living canon; mark P2a slice 1 shipped, then proceed to next language slices.

## Relationship to prior artifacts

| Artifact | Role after this spec |
| --- | --- |
| `p2a-code-ast-index.md` initiative | Follow-up via `canon-future-plan`: Design link → this spec; prose already settled at brainstorming |
| This spec | SoT for P2a slice-1 detailed behavior |
| `docs/canon/CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `OVERVIEW.md` | Living absorption targets (updated in this session) |
| `docs/superpowers/specs/2026-08-11-p0b-bm25-index-design.md` | Reused patterns: dual artifact + reader facade + hash-driven rebuild + poll watch + pid lock; **deliberate divergence:** code manifest is byte-deterministic (no `index_id`/`built_at`) |

## Open questions

None blocking design. Deferred to implementation plan only:

- Exact tree-sitter node-type names for edge TS constructs (decorators, generics, exported const objects) — locked in extractor tests
- Whether `--force` rebuild-even-if-fresh is worth a flag (default: no)
- GDScript wasm packaging strategy (own slice; not this one)

## Related

- [`docs/canon/future_plans/p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)
- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- [`docs/canon/future_plans/p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md)
- Living absorption targets: `CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `OVERVIEW.md`
