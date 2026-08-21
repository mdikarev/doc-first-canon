# Changelog

## 0.10.0

- **feat:** new `doc-canon scout "<topic>"` command — emits a generated working-set manifest (docs hits ranked by search, each annotated with its contract role and snippet stubs, plus a deterministic `sufficient` / `need_more` verdict hint and an optional code pack) in one call, replacing the hand-built Scout step in the managed skills; `--json`, `--max-hits`, `--snippet-lines`, `--no-code`; self-heals stale indexes like `search`, records doc/code probes in `.doc-canon/probe-log.jsonl`, code probe runs automatically when a code index exists (docs-only otherwise); `SKILLS_STAMP` 0.17.0 — managed skills' Scout step now calls `doc-canon scout`

## 0.9.0

- **feat:** `doc-canon validate --json` — structured issues (`{schema_version: 1, ok, issues: [{message, kind, paths, severity}]}`) replace English-message parsing; validators attach kind/paths at detection, `check` maps issues to findings directly; `SKILLS_STAMP` 0.16.0 — all five canon skills gate success on `validate --json`

## 0.8.0

- **feat:** code AST index storage on an embedded SQLite store (Node built-in `node:sqlite`) — `code-index build` streams symbols/references into `.doc-canon/code-ast-index.sqlite` (replacing the monolithic `.doc-canon/code-ast-index.json`, whose single `JSON.stringify` exceeded V8's max-string length on large repositories), with a deterministic `content_fingerprint` (SHA-256 over canonical-ordered rows) in `code-index-manifest.json` (`schema_version: 2`); `code-index search` queries the store directly — FTS5 trigram index for substring matching, `name_lower` b-tree for exact/prefix, `LIKE` fallback for <3-char tokens — with the `matchClass` ranking, freshness, and CLI surface unchanged
- **chore:** Node engine floor `>=20` → `>=22.16` (`node:sqlite` ships FTS5 only from 22.16); `node:sqlite` prints a one-time `ExperimentalWarning` to stderr (accepted, cosmetic)
- **perf:** prefix symbol search binds the full prefix pattern so `name_lower LIKE ?` uses the `name_lower` b-tree index (the previous `? || '%'` form forced a full scan)

## 0.7.0

- **perf:** stat-first freshness for both indexes — per-doc `size`/`mtime_ms` snapshots in the manifest prove unchanged docs (content neither read nor hashed), stat changes are content-hash-confirmed; new internal `.doc-canon/code-index-stats.json` sidecar (fingerprint-keyed, outside the byte-identical dual artifact) lets code freshness checks skip re-reading/re-hashing unchanged files
- **feat:** new optional contract policy `policies.max_line_length` (default 500 via `init` scaffold) — `validate` warns on prose/list lines longer than the cap (table rows and fenced code blocks exempt); all five managed skills teach the rule; `SKILLS_STAMP` 0.15.0
- **docs:** ARCHITECTURE split — indexing/retrieval detail moved to a new registered `INDEXING.md` canon section; all canon files wrapped to ≤500-char prose lines

## 0.6.0

- **feat:** DSH (DeepSeek Harness) is a first-class managed harness: `init` / `upgrade-skills` / `migrate` write identical skill trees to `.dsh/skills/` alongside `.cursor/skills/` and `.claude/skills/`; DSH loads the always-on `AGENTS.md` / `CLAUDE.md` guidance and needs no dedicated rule file
- **feat:** harness selection — `init` prompts on a TTY (checkbox, all checked by default); `--harnesses cursor,claude,dsh` picks an exact set on `init` / `upgrade-skills` / `migrate`; `--yes` / non-TTY install all harnesses on `init` and, on `upgrade-skills` / `migrate`, refresh only the harnesses already present in the repo (missing ones are offered on a TTY); unknown harness names fail closed with exit ≠0

## 0.5.0

- **feat:** `search` / `code-index search` self-heal a stale index at the CLI layer when no watch owns it (rebuild then serve; `auto_reindexed` warning); missing index stays fail-closed
- **feat:** every successful CLI search appends one line to `.doc-canon/probe-log.jsonl` (trimmed to 1000)
- **feat:** new `doc-canon discipline` command — probe-currency report (`--json`), exit ≠0 on un-probed state; `check` merges `kind: "discipline"` findings
- **feat:** mandatory search-first gate in managed overlays (pointer rule, `AGENTS.md`, `CLAUDE.md`, canon skills); machine-parseable `code_miss` / new `doc_miss`; `skills_stamp` 0.14.0

## 0.4.0

- `code-index search --refs Class.method` C# imported-type member-access edges: `using`-imported / `using`-alias (canonical name) / namespace-qualified `new Ns.Type()` / explicit-typed target-typed `new()` bindings resolved through a deterministic syntactic project model (`resolveCSharpNamespaceReferences` own-first/using-union)
- Documentation coverage checklist in managed skills (`canon-write`, `canon-bootstrap`): authored canon sections cover Public interfaces, Workflows, Usage examples, Operational runbooks, Failure modes, and Success criteria (or explicitly exclude a category in Scope); `SKILLS_STAMP` 0.13.0
- Exhaustive CLI command flags table in canon: a flag not listed in `CLI.md` does not exist; unknown options fail closed with `error: unknown option '<flag>'` (exit ≠0)

## 0.3.0

- `code-index search --refs Class.method` member-access edges across all five languages: Go composite/pointer-literal constructors (`x := &T{}` / `x := T{}` / `var x = T{}`) with same-package cross-file resolution (`resolveGoSamePackageReferences`); C# `new Type(...)` with same-namespace cross-file resolution (`resolveCSharpNamespaceReferences`); Rust associated-function constructors (`Type::new()` / `Type::default()`) for same-file and `use`-imported names; Python bare-call constructors (`Type(...)`) for same-file classes and PascalCase imported names with `as`-alias canonicalization

## 0.2.0

- Code AST index over discovered source roots: `code-index build` (tree-sitter WASM for TypeScript/JavaScript, Go, C#, Rust, Python; `--watch`/`--stop`) and `code-index search` (symbol mode with multi-token name/signature matching, `--kind`/`--file`/`--body`, and syntactic `--refs` mode incl. `Class.method` member-access edges for `new Type()`-initialized bindings)
- ESM `.js`-extension import resolution and call-site edges in the TS extractor
- Code-index-first analysis rules in managed assets (AGENTS block, pointer rule, canon skills) with `code_miss` miss reporting
- BM25 scoring quality: light EN/RU stemming, heading-token weights (1.5×), `future_plans/**` downweight, glossary-aware query expansion
- `SKILLS_STAMP` guard: managed-asset changes require a stamp bump
- Usage guides for `code-index build`/`search` in README (EN/RU) and canon CLI

## 0.1.1

- README and usage flows describe Cursor and Claude Code as default managed hosts (not Cursor-only)

## 0.1.0

First public release.

- CLI: `init`, `validate`, `check`, `report`, `upgrade-skills`, `index`, `search`, `migrate`
- Dual-write Cursor + Claude Code overlays
- Local BM25 `index` / `search`
- `doc-canon migrate` fills missing required canon files from the target contract, then runs `upgrade-skills`
