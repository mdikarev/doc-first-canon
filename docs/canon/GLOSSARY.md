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
Skills (identical trees under `.cursor/skills/` and `.claude/skills/`), Cursor pointer rule (`.cursor/rules/doc-canon.mdc`), short `AGENTS.md` managed block, and full pointer-rule body in `CLAUDE.md` (YAML frontmatter stripped), copied/refreshed by `init` / `upgrade-skills` from the installed CLI package.

### Working set
The small list of canon/artifact paths an agent intends to use for the current task. Discover via `doc-canon search` first (pack paths and snippet stubs); fall back to INDEX (and CLI inventory/report when needed) when search fails closed. Build the set before deep-reading file bodies.

### Scout
Phase that builds a working-set manifest (`path`, `role`, short why-in-set stub) without loading full file bodies or inventing structure.

### Expand gate
Check that the working set is **sufficient** or **need more** before deep reads. Doubt → expand. Managed canon skills briefly show the set and verdict in chat; coding agents apply the same discipline without a mandatory chat ritual.

### Feature-change order (canon-first)
For intentional new or changed behavior: update living canon via `canon-write` first, optionally write/sync a project-local design/plan when the change is large, wait for user go-ahead after substantial canon edits, implement application code, then close with `canon-audit` (semantic pass on the affected topic until open decisions are cleared or unreproduced drift is marked stale). Spot `canon-write` does not guarantee full-canon sibling sync; the closing audit catches that gap. Exceptions: pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits. Distinct from post-hoc everyday sync.

### Member-access reference
A syntactic `import`-kind reference edge from a member usage (`obj.method()` call or `obj.field` read) on a local binding initialized from `new <Type>(...)` to the type's file, named `<Type>.<member>` using the canonical imported name. `<Type>` may be an imported name (direct or aliased `import { X as Y }` — the edge always carries canonical `X`) or a same-file class declaration. Resolved syntactically with no name resolution: factory-returned bindings (`openCanonIndex()`) and namespace-member constructors (`new NS.Class()`) get no member-access edge. Only member accesses whose object is a bare binding identifier emit edges — so in a chained `h.get().build()`, the leading `h.get()` links to `X.get` while the trailing `.build()` (object is a call) does not. Reassignment is not tracked in v1: `let h = new X(); h = other; h.build()` still emits `X.build` (cheap tier). In Go, the same edge family covers composite/pointer-literal constructors: a binding initialized from `x := &T{}` / `x := T{}` / `var x = T{}` resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge where `<Type>` is the unqualified type name (imported `reader.Handle{}` emits `Handle.member`); imported literals resolve through the import edge map to the imported file, and same-package types resolve via the sync post-processing pass. In C#, construction is an `object_creation_expression` (`new Type(...)`) like TS/JS but with its own CST shape: a binding initialized from `new Type(...)` (`var x = new Type();` or explicit-typed) resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge where `<Type>` is the unqualified type name; same-file types resolve to the current file, and same-namespace types (declared in another file whose namespace matches the using file's) resolve via a `resolveCSharpNamespaceReferences` post-processing pass in `sync.ts` — `using`-directive, namespace-qualified (`new NS.Type()`), and target-typed `new()` (no type name in the CST) get no member-access edge in v1 (no project model).

### migrate
CLI command that brings an existing canon up to the installed CLI by filling missing required scaffold from the target contract, then `upgrade-skills`. Not a schema-version rewriter; not `init`.

### skills_stamp
Version marker in the contract YAML recording which managed skills stamp was last applied; validate fails if skills are too old relative to CLI expectations. **Any change to managed assets (`embedded/skills`, `embedded/rules`, `embedded/agents`) must bump `SKILLS_STAMP` in the same change** — enforced by the `SKILLS_STAMP guard` test (templates under `embedded/templates` are not managed assets and need no bump). Soft coupling: managed-asset changes also bump npm version; a CLI-only bugfix may bump npm patch only.

### Future plans
Canon subtree `docs/canon/future_plans/` for initiatives describing the **future shape** of the system. Not behavioral SoT for current behavior; not a development task tracker. After realization, absorb into living sections and mark the initiative absorbed or remove it.

### Future plans validate zone
Validate behavior for `future_plans/*.md` other than `INDEX.md`: exempt from the "not listed in contract" orphan check; instead checked against `future_plans/INDEX.md`'s Initiatives table (INDEX↔disk agreement) and required `FUTURE_PLAN` headings. Replaces per-initiative `future-p*` contract rows.

### index-manifest
`.doc-canon/index-manifest.json`: BM25 index manifest artifact (`schema_version`, opaque `index_id`, `built_at`, per-doc `hash`/`token_count`, `tokenizer_version`) written last as the commit marker after a successful `bm25-index` write.

### bm25-index
`.doc-canon/bm25-index.json`: serialized Okapi BM25 data (postings/df/doc-length) for the current corpus, `schema_version: 2`, sharing `index_id` with its companion `index-manifest`. An optional per-doc `heading_terms` field carries the tokens of heading lines (`#`–`######`); the reader treats a missing field as no heading terms.

### index_id
Opaque string shared by one `index-manifest` + `bm25-index` pair from the same rebuild; a mismatch between the two makes the `openCanonIndex` reader facade fail closed.

### doc_hash
Per-document `sha256:<hex>` content hash recorded in `index-manifest`, used to detect create/update/delete and trigger a full BM25 rebuild.

### tokenizer_version
A constant in `index-manifest.json` identifying the tokenizer semantics (lowercase/split + stemming). A mismatch vs. the current value at build time forces a full BM25 rebuild — `doc_hash` is a content hash and cannot detect a tokenizer change alone. Mirrors `grammar_versions` for the code index.

### Stemmer
A dependency-free light EN/RU suffix-strip applied to every token inside `tokenize`, so index and query tokenize identically (consistency is required for BM25 matching). EN strips `ing`/`ed`/`ly`/`er`/`est`, maps `ies→y`, and strips `es`/`s`; RU strips `ов`/`ев`/`ами`/`ями`/`ом`/`ем`/`ах`/`ях`/`ый`/`ий`/`ой`/`ая`/`яя`/`ое`/`ее`/`ие`/`ые`/`и`/`ы`/`а`/`я`/`о`/`е`/`у`/`ю`. Only tokens longer than 3 chars are stemmed; first matching rule wins, single application — so `index`/`indexes`/`indexed`/`indexing` and `индекс`/`индекса`/`индексу` collapse to the same stem.

### Heading weight
A per-term score multiplier of 1.5 (`HEADING_WEIGHT`) applied when a term is in a doc's heading set — the tokens of markdown heading lines (`#`–`######`), stored as an optional `heading_terms` field in the BM25 state. Heading hits outrank body-only hits for equal otherwise.

### Liveness
The search downweight of `docs/canon/future_plans/**`: any doc whose path contains a `future_plans` segment at any depth (canon-relative `future_plans/...` or root-relative `docs/canon/future_plans/...`) gets its final score multiplied by 0.5 (`FUTURE_PLANS_WEIGHT`) so living canon (OVERVIEW/CLI/GLOSSARY/ARCHITECTURE) outranks directional plans for conceptual queries. Fixed constant; no `policies` knob.

### Pack
A bounded retrieval result containing the query, index identity and freshness, warnings, and ranked canon hits with scores and short snippet windows from live files.

### searchCanon / search
`searchCanon` is the public `doc-canon/search` API that ranks canon documents from the local BM25 index and builds a Pack from live-file snippets. `doc-canon search` is its thin human/JSON CLI wrapper.

### Glossary expansion
Search-time query expansion from `GLOSSARY.md`: a query term triggers expansion only when it equals a **heading token** (a token of a term's canonical `###` heading) that is unique across all term headings; it then adds that entry's full token set (canonical term tokens + synonym tokens) to the query term set before scoring — additive (OR), never dropping original terms. Ambiguous/common tokens (appearing in more than one term heading, or only in definition bodies) get no expansion — plain stemming + BM25 handles them. The glossary is read live at search time via the contract's glossary role (no manifest snapshot); a missing or unparsable glossary fails open to plain search.

### index_stale
A non-fatal search warning that one or more indexed document hashes differ from the live canon corpus. Search serves the Pack with exit 0, surfaces the warning, and does not auto-reindex.

### Source root
A discovered or configured directory holding the project's source code to be indexed by `code-index build`; found via explicit config, manifest detection (`package.json` for TypeScript/JavaScript, `go.mod` for Go, `*.csproj`/`*.sln` for C#, `Cargo.toml` for Rust, `pyproject.toml`/`setup.py`/`setup.cfg` for Python — the five shipped languages), or extension-based fallback under the VCS root.

### Symbol
A named code unit (class, interface, enum, function, method, property, module, const, type, …) extracted from source and normalized into the shared `{ name, kind, signature, file, line, endLine, scope }` model; no per-language output formats are exposed to consumers.

### Extractor
Per-language tree-sitter WASM pipeline that parses a source file and normalizes its syntax into the shared symbol model; all languages share one extraction discipline with no external processes.

### Anchor
A same-file syntactic reference from a usage of a symbol to its declaration, resolved by the CST without cross-file name resolution.

### code-index-manifest
`.doc-canon/code-index-manifest.json`: deterministic, byte-identical code AST index manifest (`schema_version`, `corpus`, `grammar_versions`, `roots`, per-file `hash`/`language`/`symbols`); has no `index_id`/`built_at`, so identical input produces an identical artifact. `grammar_versions` divergence triggers a full rebuild.

### code-ast-index
`.doc-canon/code-ast-index.json`: serialized symbols and syntactic references (anchors, import edges, in-scope bindings) for the discovered source roots, sharing its companion `code-index-manifest`. `import` edges resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` import specifiers to their TS/TSX sources and include call-site edges — identifier usages of imported names emit an `import`-kind edge to the definition file. Member-access references extend this: a local binding initialized from `new <Type>(...)` emits `<Type>.<member>` edges for its `obj.method()`/`obj.field` usages (canonical name; aliased and same-file constructors included). Per-language import conventions and member-access/resolution scope differ by language (Go composite/pointer literals with a same-package pass, C# `object_creation_expression` with a same-namespace pass, Rust/Python relative-import edges only and no member-access in v1) — see [CODE_INDEX.md](CODE_INDEX.md).

### code_index_stale
A non-fatal freshness signal for the code AST index: one or more indexed source hashes differ from the live tree. Reported independently of the canon `index_stale`.

### code_index_missing
A fail-closed code-index state: no code AST index artifact exists, so code-side retrieval cannot proceed; a hint to run `doc-canon code-index build` is surfaced.

### code_miss
An agent-facing miss report when a code-index probe returns nothing or a thin set: the agent reads source as evidence and notes `code_miss: <query> -> source:<path>`, mirroring the canon's visible Expand gate. Code-index-first analysis applies to the five covered languages (TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages go straight to source.

### Code pack
A bounded code retrieval result (CodePack) containing the query, mode (`symbols` or `refs`), freshness (`fresh`/`stale`), warnings, and symbol or syntactic-reference hits with short snippet windows from live files.

### Syntactic reference
A reference edge already carried by the code AST index — same-file `anchor`, `import` edge, or in-scope `binding` — matched syntactically by `--refs` with no name resolution. `import` edges are cross-file: they resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` import specifiers to their TS/TSX sources and include call-site edges (identifier usages of imported names emit an `import`-kind edge to the definition file) and member-access references — `obj.method()` / `obj.field` on `new Type()`-initialized bindings link to `<Type>.<member>` in the type's file (canonical name, aliases resolved). Import-edge resolution is per-language (TS/JS ESM substitution, Go relative paths, C# none, Rust `self::`/`super::`, Python relative `from .` imports) — see [CODE_INDEX.md](CODE_INDEX.md).

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
