# Glossary

## How to use

Use these terms consistently in canon prose, skill dialogue, and discrepancy entries. Prefer glossary wording over synonyms when naming the same concept.

## Terms

### Canon
The structured documentation tree under `docs/canon/` that is the source of truth for agent project context after bootstrap.

### SoT
Source of truth. For design/development context after successful bootstrap validate, SoT is exclusively `docs/canon/`.

### Contract
`CANON_CONTRACT.md`: human sections plus exactly one fenced YAML machine block that defines sections, templates, and policies for this repository only.

### Documentation coverage checklist
The required content categories that canon sections must cover when authored or revised — Public interfaces, Workflows / key flows, Usage examples, Operational runbooks, Failure modes / error handling, and Success criteria — or explicitly exclude in Scope with a reason. Applied as an authorship discipline in the managed skills (`canon-write`, `canon-bootstrap`); not validator-enforced structure. See [SKILLS.md](SKILLS.md).

### Template
A registered markdown shape under `docs/canon/templates/` that required headings must satisfy. Extra headings are allowed.

### Inventory
Language-agnostic listing of repository paths (and glossary hits) produced by `doc-canon check` into `.doc-canon/inventory.json`.

### Finding
A machine-readable issue in `.doc-canon/report.json` with `source: cli` or `source: skill`. CLI check refreshes CLI findings and must preserve skill findings.

### Discrepancy
A human-tracked docs↔code (or related) conflict entry in `DISCREPANCIES.md` with lifecycle fields (`status`, `decision`, evidence, optional `coding_agent_prompt`).

### docs_stale
User decision that documentation is wrong; skill edits canon, validates, then may resolve the discrepancy in the same session.

### code_stale
User decision that application code is wrong; skill writes an Open coding task and does not edit application code. Resolved only on a later audit after code is fixed outside the skill.

### Extract-then-freeze
Non-empty bootstrap: inventory and legacy docs are import sources; agreed facts are written into canon templates; after validate, only `docs/canon/` is SoT.

### Managed assets
Skills (identical trees under `.cursor/skills/`, `.claude/skills/`, and `.dsh/skills/`, written to the selected harnesses), Cursor pointer rule (`.cursor/rules/doc-canon.mdc`), short `AGENTS.md` managed block, and full pointer-rule body in `CLAUDE.md` (YAML frontmatter stripped), copied/refreshed by `init` / `upgrade-skills` from the installed CLI package.

### Harness
A coding-agent host that consumes doc-canon's managed assets: Cursor (`.cursor/skills/` + `.cursor/rules/doc-canon.mdc` + short `AGENTS.md` block), Claude Code (`.claude/skills/` + full pointer-rule body in `CLAUDE.md`), and DSH — the DeepSeek Harness (`.dsh/skills/` + the same `AGENTS.md`/`CLAUDE.md` blocks; no dedicated rule file). `init` / `upgrade-skills` / `migrate` select which harnesses get skill trees — interactively, via `--harnesses`, or by installed-harness detection.

### Working set
The small list of canon/artifact paths an agent intends to use for the current task. Discover via `doc-canon search` first (pack paths and snippet stubs); fall back to INDEX (and CLI inventory/report when needed) when search fails closed. Build the set before deep-reading file bodies.

### Scout
Phase that builds a working-set manifest (`path`, `role`, short why-in-set stub) without loading full file bodies or inventing structure.

### Expand gate
Check that the working set is **sufficient** or **need more** before deep reads. Doubt → expand. Managed canon skills briefly show the set and verdict in chat; coding agents apply the same discipline without a mandatory chat ritual.

### Feature-change order (canon-first)
For intentional new or changed behavior: update living canon via `canon-write` first, optionally
write/sync a project-local design/plan when the change is large, wait for user go-ahead after
substantial canon edits, implement application code, then close with `canon-audit` (semantic pass on
the affected topic until open decisions are cleared or unreproduced drift is marked stale). Spot
`canon-write` does not guarantee full-canon sibling sync; the closing audit catches that gap.
Exceptions: pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits.
Distinct from post-hoc everyday sync.

### Member-access reference
A syntactic `import`-kind reference edge from a member usage (`obj.method()` call or `obj.field`
read) on a local binding initialized from `new <Type>(...)` to the type's file, named
`<Type>.<member>` using the canonical imported name. `<Type>` may be an imported name (direct or
aliased `import { X as Y }` — the edge always carries canonical `X`) or a same-file class
declaration. Resolved syntactically with no name resolution: in TS/JS, factory-returned bindings
(`openCanonIndex()`) and namespace-member constructors (`new NS.Class()`) get no member-access edge
in v1. Only member accesses whose object is a bare binding identifier emit edges — so in a chained
`h.get().build()`, the leading `h.get()` links to `X.get` while the trailing `.build()` (object is a
call) does not. Reassignment is not tracked in v1: `let h = new X(); h = other; h.build()` still
emits `X.build` (cheap tier).

In Go, the same edge family covers composite/pointer-literal constructors: a binding initialized
from `x := &T{}` / `x := T{}` / `var x = T{}` resolves `x.method()` / `x.field` to a
`<Type>.<member>`-named edge where `<Type>` is the unqualified type name (imported `reader.Handle{}`
emits `Handle.member`); imported literals resolve through the import edge map to the imported file,
and same-package types resolve via the sync post-processing pass.

In C#, construction is an `object_creation_expression` (`new Type(...)`) like TS/JS but with its own
CST shape: a binding initialized from `new Type(...)` (`var x = new Type();` or explicit-typed)
resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge where `<Type>` is the unqualified
type name; same-file types resolve to the current file, and imported types resolve via an extended
`resolveCSharpNamespaceReferences` post-processing pass in `sync.ts` over a deterministic syntactic
project model — file↔namespace from the file's `module` symbols (all namespaces declared in a file,
nested included) plus per-file `using`-directive names. The pass resolves each unresolved candidate's
search-set own-namespace-first, then the `using`-union, emitting an edge only when exactly one
distinct file matches: `using App.Models;` + `new Widget()`/`w.Score` links to the file declaring
`App.Models.Widget`; `using R = App.Reader;` + `new R()` emits an edge carrying the canonical type
name `Reader.member`; namespace-qualified (`new App.Widget()`, type = last segment, prefix = its
namespace) and target-typed `new()` with an explicit non-`var` type (`Widget w = new();`) also emit
edges — `using static`, `global using`, and `var w = new();` (no syntactic type anchor) still get no
edge.

In Rust, construction is an associated-function call — a binding initialized from `Type::new()` /
`Type::default()` (a `scoped_identifier` callee in a `call_expression` initializer, `let`/`const`
bindings) resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge where `<Type>` is the
unqualified type name; same-file types resolve to the current file, and imported names resolve
through the import edge map to the imported file (relative `use self::…` / `use super::…` item
imports — crate-relative `use crate::…`, bare crate-path `use foo::bar`, and external-crate imports
emit no edge). Crate-relative imports, generic types, `Arc::new`/`Box::new` wrapping, and
non-`new`/`default` associated functions get no member-access edge in v1; Rust needs no cross-file
post-processing pass.

In Python, construction is a bare call — a binding initialized from `Type(...)` (an `assignment`
whose right-hand side is a `call` with an identifier callee) resolves `x.method()` / `x.field` to a
`<Type>.<member>`-named edge where `<Type>` is the class name; same-file types resolve to the
current file when the callee is a same-file `class` symbol, and imported names resolve through the
import edge map to the imported file when the callee is PascalCase (relative `from .module import
Type` imports, including `as`-aliases — the edge carries the canonical name). Lowercase same-file
classes count (grounded by symbol kind); absolute/external imports, attribute callees
(`util.Reader()`), and factory-function bindings get no member-access edge in v1; Python needs no
cross-file post-processing pass.

### migrate
CLI command that brings an existing canon up to the installed CLI by filling missing required scaffold from the target contract, then `upgrade-skills`. Not a schema-version rewriter; not `init`.

### skills_stamp
Version marker in the contract YAML recording which managed skills stamp was last applied; validate
fails if skills are too old relative to CLI expectations. **Any change to managed assets
(`embedded/skills`, `embedded/rules`, `embedded/agents`) must bump `SKILLS_STAMP` in the same
change** — enforced by the `SKILLS_STAMP guard` test (templates under `embedded/templates` are not
managed assets and need no bump). Soft coupling: managed-asset changes also bump npm version; a
CLI-only bugfix may bump npm patch only.

### Future plans
Canon subtree `docs/canon/future_plans/` for initiatives describing the **future shape** of the system. Not behavioral SoT for current behavior; not a development task tracker. After realization, absorb into living sections and mark the initiative absorbed or remove it.

### Future plans validate zone
Validate behavior for `future_plans/*.md` other than `INDEX.md`: exempt from the "not listed in contract" orphan check; instead checked against `future_plans/INDEX.md`'s Initiatives table (INDEX↔disk agreement) and required `FUTURE_PLAN` headings. Replaces per-initiative `future-p*` contract rows.

### index-manifest
`.doc-canon/index-manifest.json`: BM25 index manifest artifact (`schema_version`, opaque `index_id`, `built_at`, per-doc `hash`/`token_count`, optional per-doc stat snapshot `size`/`mtime_ms`, `tokenizer_version`) written last as the commit marker after a successful `bm25-index` write.

### bm25-index
`.doc-canon/bm25-index.json`: serialized Okapi BM25 data (postings/df/doc-length) for the current corpus, `schema_version: 2`, sharing `index_id` with its companion `index-manifest`. An optional per-doc `heading_terms` field carries the tokens of heading lines (`#`–`######`); the reader treats a missing field as no heading terms.

### index_id
Opaque string shared by one `index-manifest` + `bm25-index` pair from the same rebuild; a mismatch between the two makes the `openCanonIndex` reader facade fail closed.

### doc_hash
Per-document `sha256:<hex>` content hash recorded in `index-manifest`. Freshness is stat-first: an unchanged per-doc `size`/`mtime_ms` snapshot proves the doc is unchanged (content neither read nor hashed); a stat change is content-hash-confirmed, and confirmed create/update/delete triggers a full BM25 rebuild. On the fresh path the `bm25-index` pair is trusted by mtime ordering — it is parsed only when rewritten after the manifest commit marker, so external corruption is still repaired.

### tokenizer_version
A constant in `index-manifest.json` identifying the tokenizer semantics (lowercase/split + stemming). A mismatch vs. the current value at build time forces a full BM25 rebuild — `doc_hash` is a content hash and cannot detect a tokenizer change alone. Mirrors `grammar_versions` for the code index.

### Stemmer
A dependency-free light EN/RU suffix-strip applied to every token inside `tokenize`, so index and
query tokenize identically (consistency is required for BM25 matching). EN strips `ing`/`ed`/`ly`/
`er`/`est`, maps `ies→y`, and strips `es`/`s`; RU strips `ов`/`ев`/`ами`/`ями`/`ом`/`ем`/`ах`/`ях`/
`ый`/`ий`/`ой`/`ая`/`яя`/`ое`/`ее`/`ие`/`ые`/`и`/`ы`/`а`/`я`/`о`/`е`/`у`/`ю`. Only tokens longer
than 3 chars are stemmed; first matching rule wins, single application — so `index`/`indexes`/
`indexed`/`indexing` and `индекс`/`индекса`/`индексу` collapse to the same stem.

### Heading weight
A per-term score multiplier of 1.5 (`HEADING_WEIGHT`) applied when a term is in a doc's heading set — the tokens of markdown heading lines (`#`–`######`), stored as an optional `heading_terms` field in the BM25 state. Heading hits outrank body-only hits for equal otherwise.

### Liveness
The search downweight of `docs/canon/future_plans/**`: any doc whose path contains a `future_plans` segment at any depth (canon-relative `future_plans/...` or root-relative `docs/canon/future_plans/...`) gets its final score multiplied by 0.5 (`FUTURE_PLANS_WEIGHT`) so living canon (OVERVIEW/CLI/GLOSSARY/ARCHITECTURE) outranks directional plans for conceptual queries. Fixed constant; no `policies` knob.

### Pack
A bounded retrieval result containing the query, index identity and freshness, warnings, and ranked canon hits with scores and short snippet windows from live files.

### searchCanon / search
`searchCanon` is the public `doc-canon/search` API that ranks canon documents from the local BM25 index and builds a Pack from live-file snippets. `doc-canon search` is its thin human/JSON CLI wrapper.

### Probe log
`.doc-canon/probe-log.jsonl`: an append-only record of successful CLI searches (`doc-canon search` / `code-index search`), one JSON line per call — timestamp, kind (`doc` / `code`), query, mode (code only: `symbols` / `refs`), hit count, freshness, and whether the command auto-reindexed. The observability basis for the strict search-first gate: `doc-canon discipline` and `check` read it (trimmed to the last 1000 lines) to report probe currency.

### Discipline finding
A `kind: "discipline"` finding in `.doc-canon/report.json` (merged via the CLI finding merge) summarizing probe currency: age of the last doc/code probe and how many docs or source files changed after it. Informational in `check`; the `doc-canon discipline` command turns the same state into an exit-gate (exit ≠0 on un-probed state, or when an index exists but is unreadable — a corrupt index is reported, not masked as not-applicable).

### doc_miss
The documentation-side miss note, mirror of `code_miss`: `doc_miss: <query> -> docs:<path>`, required when a deep read of `docs/canon/**` happens outside a search pack (index unavailable or thin result).

### Glossary expansion
Search-time query expansion from `GLOSSARY.md`: a query term triggers expansion only when it equals a
**heading token** (a token of a term's canonical `###` heading) that is unique across all term
headings; it then adds that entry's full token set (canonical term tokens + synonym tokens) to the
query term set before scoring — additive (OR), never dropping original terms. Ambiguous/common tokens
(appearing in more than one term heading, or only in definition bodies) get no expansion — plain
stemming + BM25 handles them. The glossary is read live at search time via the contract's glossary
role (no manifest snapshot); a missing or unparsable glossary fails open to plain search.

### index_stale
A non-fatal freshness signal that one or more indexed document hashes differ from the live canon corpus. `doc-canon search` self-heals at the CLI layer when no watch owns the index: it rebuilds, re-runs, and serves a fresh Pack with an `auto_reindexed` warning; with a live watch the stale Pack is served with the `index_stale` warning. A missing index fails closed.

### Source root
A discovered or configured directory holding the project's source code to be indexed by `code-index build`; found via explicit config, manifest detection (`package.json` for TypeScript/JavaScript, `go.mod` for Go, `*.csproj`/`*.sln` for C#, `Cargo.toml` for Rust, `pyproject.toml`/`setup.py`/`setup.cfg` for Python — the five shipped languages), or extension-based fallback under the VCS root.

### Symbol
A named code unit (class, interface, enum, function, method, property, module, const, type, …) extracted from source and normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model; no per-language output formats are exposed to consumers.

### Extractor
Per-language tree-sitter WASM pipeline that parses a source file and normalizes its syntax into the shared symbol model; all languages share one extraction discipline with no external processes.

### Anchor
A same-file syntactic reference from a usage of a symbol to its declaration, resolved by the CST without cross-file name resolution.

### code-index-manifest
`.doc-canon/code-index-manifest.json`: deterministic code AST index manifest (`schema_version: 2`, `corpus`, `grammar_versions`, `roots`, per-file `hash`/`language`/`symbols`, and a `content_fingerprint` — SHA-256 over the canonical-ordered symbol/ref rows); has no `index_id`/`built_at`. `grammar_versions` divergence triggers a full rebuild, and a `content_fingerprint` mismatch vs. the SQLite store fails closed.

### code-ast-index
`.doc-canon/code-ast-index.sqlite`: embedded SQLite store (Node's built-in `node:sqlite`) of the
symbols and syntactic references (anchors, import edges, in-scope bindings) for the discovered source
roots, sharing its companion `code-index-manifest`; it replaces the former single
`.doc-canon/code-ast-index.json` so build and search no longer materialize the whole index.
`import` edges resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` import specifiers to their TS/TSX sources and
include call-site edges — identifier usages of imported names emit an `import`-kind edge to the
definition file. Member-access references extend this: a local binding initialized from
`new <Type>(...)` emits `<Type>.<member>` edges for its `obj.method()`/`obj.field` usages (canonical
name; aliased and same-file constructors included). Per-language import conventions and
member-access/resolution scope differ by language (Go composite/pointer literals with a same-package
pass, C# `object_creation_expression` with an imported-type/namespace pass over the syntactic project
model, Rust associated-function constructors and Python bare-call constructors resolved through the
import edge map with no cross-file pass) — see [CODE_INDEX.md](CODE_INDEX.md).

### code-index-stats
`.doc-canon/code-index-stats.json`: internal stat cache (`fingerprint` + per-file `size`/`mtime_ms`) that lets code freshness checks skip re-reading and re-hashing unchanged source files. Deliberately **outside** the deterministic pair (the manifest/`.sqlite` store stays content-stable across rebuilds); keyed by `index_fingerprint` — when absent or stale, readers fall back to full content hashing.

### content_fingerprint
A `sha256:<hex>` hash over the code index's canonical-ordered logical rows (symbols sorted by all model columns; refs sorted by `kind, from_file, to_file, name, line`), streamed via `SELECT ... ORDER BY` and stored in `code-index-manifest`. It replaces byte-identity as the determinism check for the SQLite store (SQLite files are not byte-deterministic); a mismatch vs. the store on load fails closed.

### code_index_stale
A non-fatal freshness signal for the code AST index: one or more indexed source hashes differ from the live tree. `code-index search` self-heals at the CLI layer when no watch owns the index (rebuild then serve, `auto_reindexed` warning); with a live watch the stale pack is served with `code_index_stale`. Reported independently of the canon `index_stale`.

### code_index_missing
A fail-closed code-index state: no code AST index artifact exists, so code-side retrieval cannot proceed; a hint to run `doc-canon code-index build` is surfaced.

### code_miss
A machine-parseable miss report (strict format `code_miss: <query> -> source:<path>`) required when a
whole-file source read happens outside a search pack — the probe returned nothing or a thin set, or
the index is unavailable. The agent reads source as evidence and notes the miss, mirroring the
canon's visible Expand gate. Code-index-first analysis is mandatory for the five covered languages
(TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages go straight to source without a
probe.

### Code pack
A bounded code retrieval result (CodePack) containing the query, mode (`symbols` or `refs`), freshness (`fresh`/`stale`), warnings, and symbol or syntactic-reference hits with short snippet windows from live files.

### Syntactic reference
A reference edge already carried by the code AST index — same-file `anchor`, `import` edge, or
in-scope `binding` — matched syntactically by `--refs` with no name resolution. `import` edges are
cross-file: they resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` import specifiers to their TS/TSX sources and
include call-site edges (identifier usages of imported names emit an `import`-kind edge to the
definition file) and member-access references — `obj.method()` / `obj.field` on `new Type()`-
initialized bindings link to `<Type>.<member>` in the type's file (canonical name, aliases resolved).
Import-edge resolution is per-language (TS/JS ESM substitution, Go relative paths, C# none, Rust
`self::`/`super::`, Python relative `from .` imports) — see [CODE_INDEX.md](CODE_INDEX.md).

## Naming conventions

- Section files use `UPPER_SNAKE` or clear `Title.md` paths registered in the contract (`OVERVIEW.md`, `CLI.md`, …).
- Discrepancy IDs: `D-NNN` assigned monotonically; never reuse.
- Finding IDs: `F-NNN` in reports.
- Skill names: `canon-<verb>` (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`).
- Prefer repo-relative paths in evidence fields.

## Related canon

- [OVERVIEW.md](OVERVIEW.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
