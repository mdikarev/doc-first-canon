# CLI

## Purpose

Own the deterministic core of `doc-canon`: scaffold, structural validation, inventory, report I/O, managed-asset copy, local BM25 index build/watch, and bounded canon retrieval — with no LLM calls and no invented prose.

## Scope

**Covers:** commands `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, `code-index`; contract parse/schema; heading and INDEX agreement checks; ignore-aware inventory; CLI finding merge; embedding default templates/skills/rules into target repos; required-gap ensure on existing canons (`migrate`); build/update a local BM25 index over `docs/canon/**/*.md` (`index`), including poll-based `--watch` (default 2000 ms, `--interval`) and `--stop`, writing `.doc-canon/index-manifest.json` + `.doc-canon/bm25-index.json`; one-shot `index` exits ≠0 if a watch process is running; search that index and return a bounded context pack without auto-reindexing; build/update a deterministic AST index over the project's discovered source roots (`code-index build`), writing `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`, with the same poll `--watch`/`--stop` discipline and a separate watch pid; search that code index (`code-index search`) and return a bounded code pack without auto-reindexing.

**Excludes:** interview, semantic audit judgements, discrepancy dialogue, and any application-code edits (those belong to skills or coding agents).

## Current state

MVP package `doc-canon@0.2.0` (Node ≥20, ESM). Entry: `bin/doc-canon.js` → compiled `dist/`. Commands: `init`, `validate`, `check`, `report`, `upgrade-skills`, `migrate`, `index`, `search`, plus the `code-index` subcommands `build` (tree-sitter WASM extraction over discovered source roots) and `search` (search over that code AST index). All commands accept `--root <path>` (default: cwd).

## Responsibilities

- Materialize default canon + managed Cursor and Claude Code overlays on `init`, including a required `future_plans/INDEX.md` and its templates: identical skill trees under `.cursor/skills/` and `.claude/skills/`, Cursor pointer rule (`.cursor/rules/doc-canon.mdc`), short managed block in `AGENTS.md`, and full pointer-rule body (YAML frontmatter stripped) in `CLAUDE.md`
- Fail closed on invalid contract YAML, incompatible `schema_version`, missing required files/headings, INDEX≠contract, too-old `skills_stamp`
- Refresh inventory and `source: cli` findings on `check` while preserving `source: skill`
- Refresh managed skills/rules/`AGENTS.md`/`CLAUDE.md` overlays on `upgrade-skills` without wiping canon document content
- On `upgrade-skills`, idempotently migrate existing repos onto the `future_plans/INDEX.md` skeleton (contract section + templates entries, INDEX table row, index file) without overwriting existing initiative prose or templates, and bump `skills_stamp`
- On existing canon, `init` preserves canon prose; skills refresh only with `--force-skills` / upgrade path
- Validate `future_plans/*.md` (except `INDEX.md`) via an INDEX-driven zone instead of per-file contract rows: exempt from the orphan check; each file must have a `future_plans/INDEX.md` Initiatives row; each must carry required `FUTURE_PLAN` headings
- On `upgrade-skills`, strip obsolete optional `future-p*` contract section rows for initiatives under `future_plans/`, keeping the `future_plans/INDEX.md` section and on-disk initiative files untouched
- After stripping obsolete initiative contract rows, any initiative file still on disk must appear in `future_plans/INDEX.md` Initiatives or `validate` fails: `upgrade-skills` does not auto-add Initiatives rows, so the user or `canon-future-plan` must reconcile the table
- `migrate` does not rewrite section prose, initiative files, or `DISCREPANCIES.md`; `future_plans` contract-skeleton ensure stays on `upgrade-skills`
- Discover code source roots (explicit config > manifest > extension scan) and build a deterministic, hash-driven AST index over them; report `code_index_stale` → warn and `code_index_missing` → fail closed with a hint to run `doc-canon code-index build`
- Search the code AST index (`code-index search`): symbol mode is tokenized — every query token is a case-insensitive substring of `name` or, falling back, `signature`; ordering exact > prefix > name-tokens > signature-tokens, tie-break file then line — with kind/file filters, an optional `--body` snippet window (symbol mode only), and a syntactic reference mode (`--refs`; accepts `Class.method`, matching member-access edges for `new Type()`-initialized bindings (TS/JS and C#) and Go composite/pointer-literal bindings (`x := &T{}` / `x := T{}` / `var x = T{}`) — same-file, qualified-import, same-package, and same-namespace (C#) — query stays exact/case-sensitive); report `code_index_stale` → warn and `code_index_missing` → fail closed with a hint to run `doc-canon code-index build`

## Interfaces

| Command | Behavior |
| --- | --- |
| `init` | Scaffold `docs/canon/`, templates, default contract (including required `future_plans/INDEX.md`), dual skill trees (`.cursor` + `.claude`), Cursor pointer rule, short `AGENTS.md` block, full-body `CLAUDE.md`; `--yes`, `--force-skills`, `--root` |
| `validate` | Schema + structure; exit ≠0 on errors; need not write report; does not require presence of IDE overlay paths on disk (stamp-only for managed-asset currency) |
| `check` | validate + inventory + merge CLI findings into `.doc-canon/report.json` |
| `report` | Print last report.json to stdout (read-only) |
| `upgrade-skills` | Refresh Cursor + Claude managed overlays from installed package; idempotently ensure `future_plans/INDEX.md` skeleton on pre-existing canons; bump `skills_stamp` |
| `migrate` | Require existing canon + parseable `CANON_CONTRACT.md` (else fail closed; that path is `init`); reject `schema_version` other than `1` before writes (no YAML rewrite); create missing **required** section files and listed templates from the **target contract** (never overwrite; never inject default-kit sections); add missing INDEX Sections rows for contract sections; then run `upgrade-skills`. Flags: `--root` only. |
| `index` | Build/update a local BM25 index for `docs/canon/**/*.md`; one-shot exits ≠0 if a watch is running; `--watch` polls (default 2000 ms, `--interval <ms>`, min 200) and keeps artifacts in sync; `--stop` stops a running watch via its pid file; `--root` |
| `search <query>` | Search the existing index and print a ranked context pack; ranking applies light EN/RU stemming (inside the tokenizer), a 1.5× heading-token weight, a 0.5× `future_plans/**` downweight, and glossary-aware query expansion from a live glossary read (all internal — no surface change); human output on stdout; `--json`; `--max-hits <N>` (default 10); `--snippet-lines <N>` (default 4); `--root <path>` |
| `code-index build` | Discover source roots (config > manifests > extension scan), extract symbols/references via tree-sitter WASM into the shared normalized model, and write a deterministic `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`; `--watch` polls (default 2000 ms, `--interval <ms>`, min 200) and keeps artifacts in sync; `--stop` stops a running watch via its pid file; `--root`. Separate artifact from `index` (docs, not code); freshness reported independently |
| `code-index search <query>` | Search the code AST index and print a bounded code pack; symbol mode matches tokenized (every query token is a case-insensitive substring of `name` or, falling back, `signature`; ordering exact > prefix > name-tokens > signature-tokens, tie-break file then line) with `--kind <type>` / `--file <glob>`; `--body` widens symbol-mode snippet windows from the declaration start to the symbol's `endLine` (symbol mode only; `--body` + `--refs` fails closed); `--refs <name>` for syntactic references (anchor/import/binding, incl. `Class.method` member-access edges for `new Type()`-initialized bindings (TS/JS and C#) and Go composite/pointer-literal bindings — same-file, qualified-import, same-package, and same-namespace (C#)); `--json`; `--max-hits <N>` (default 10); `--snippet-lines <N>` (default 4); `--root <path>` |

Artifacts: `.doc-canon/inventory.json`, `.doc-canon/report.json`, `.doc-canon/index-manifest.json`, `.doc-canon/bm25-index.json`, `.doc-canon/code-index-manifest.json`, `.doc-canon/code-ast-index.json` (may be gitignored in target repos).

`search` fails with exit ≠0 for an empty or whitespace-only query and for a missing or corrupt index; index failures include a hint to run `doc-canon index`. A stale index is served with exit 0 and an `index_stale` signal: human mode prints a warning on stderr; `--json` includes `warnings` (and `freshness`) in the Pack on stdout with no stderr warning. Zero hits also exit 0. `search` never auto-reindexes. Ranking internally applies stemming, heading weights, the `future_plans/**` downweight, and glossary expansion (fail-open when `GLOSSARY.md` is absent) — no flags or output-shape changes.

`code-index search` fails with exit ≠0 for an empty query, an empty `--refs` name, a missing/corrupt code index (hint to run `doc-canon code-index build`), invalid flags, `--refs` combined with a positional query / `--kind` / `--file`, and `--body` combined with `--refs`. A stale code index is served with exit 0 and a `code_index_stale` warning (human mode on stderr; `--json` carries `warnings` + `freshness`). Zero hits exit 0. `code-index search` never auto-reindexes.

## Usage guide: `code-index search`

`code-index search` is the agent-facing probe for the code AST index. Two modes, chosen by flags:

**Symbol mode** (positional `<query>`): finds declarations. Every query token is a case-insensitive substring of the symbol `name` or, falling back, the `signature`. Ordering: exact name > name prefix > name tokens > signature tokens, tie-break file then line. `--kind <type>` and `--file <glob>` narrow the scan; `--body` widens the snippet window from the declaration start to the symbol's `endLine` (symbol mode only; `--body` + `--refs` fails closed).

```bash
doc-canon code-index search "searchCanon"        # declaration of searchCanon (src/search/search.ts)
doc-canon code-index search "search code index"  # multi-token: every token matches name/signature
doc-canon code-index search "Reader" --kind class
doc-canon code-index search "search" --file "src/**"
doc-canon code-index search "searchCanon" --body
```

**Refs mode** (`--refs <name>`): finds usages. Exact, case-sensitive match over syntactic references — `anchor` (same-file usage), `import` (cross-file edges: import statements, call-site edges for identifier usages of imported names, and `Class.method` member-access edges for `new Type()`-initialized bindings (TS/JS and C#) and Go composite/pointer-literal bindings (`x := &T{}` / `x := T{}` / `var x = T{}`, same-file, qualified-import, same-package, or — C# — same-namespace), aliased or same-file, canonical name), and `binding` (in-scope locals).

```bash
doc-canon code-index search --refs "searchCanon"      # import statement + call sites across files
doc-canon code-index search --refs "Reader.score"     # member-access edge: calls on new Reader() bindings
doc-canon code-index search --refs "Store.save"       # aliased constructor (import { Store as ST }) resolves to canonical Store.save
doc-canon code-index search --refs "Handle.Score"     # Go member-access edge: calls on &Handle{} / Handle{} / var x = Handle{} bindings
doc-canon code-index search --refs "Reader.Score"     # C# member-access edge: calls on new Reader() bindings (same-file or same-namespace)
```

Each hit carries a bounded snippet window from the live source file. A missing/corrupt index fails closed with a hint to run `doc-canon code-index build`; a stale index serves the pack with a `code_index_stale` warning; zero hits exit 0. `code-index search` never auto-reindexes — agents follow code-index-first, and on empty/thin packs read source as evidence and note `code_miss`.

## Dependencies

- `commander` — CLI parsing
- `yaml` — machine-block parse
- `micromatch` — ignore globs (via `src/agnostic/ignore.ts`)
- `@vscode/tree-sitter-wasm` — pinned tree-sitter WASM runtime + grammar binaries for `code-index` extraction (no native modules)
- Embedded files under `embedded/` published with the package

## Invariants

- Never invents canon prose
- Never edits `DISCREPANCIES.md` or other canon content during `check` / `report`
- Report merge must not wipe skill-owned findings
- `doc-canon` must be on PATH for skills that spawn it

## Open questions

- None for MVP freeze; Claude Code marketplace / plugin packaging remains out of scope (dual-write overlay is in scope).

## Related canon

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SKILLS.md](SKILLS.md)
- [OVERVIEW.md](OVERVIEW.md)
