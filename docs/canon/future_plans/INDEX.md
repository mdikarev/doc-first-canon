# Future plans

Directional initiatives describing the **future shape** of the system. **Not** behavioral source of truth — living product rules stay in the root canon files (`OVERVIEW`, `ARCHITECTURE`, `CLI`, `SKILLS`, …). **Not** a development task tracker: do not store checklists, sprint plans, or `coding_agent_prompt`-style work items here — execution tracking (roadmap tasks, tickets, PRs) lives outside this folder, in whatever tool the project already uses.

## How to use

1. Capture an initiative directionally (`draft`) via the `canon-future-plan` skill, then refine one at a time in a dedicated brainstorming session (`draft` → `refining`). Author here through `canon-future-plan`, not ad-hoc edits or `canon-write` create — `canon-write` hands off any create/refine/status request for this folder (see `SKILLS.md`).
2. Execute/build the initiative using this project's normal task-tracking (outside `future_plans/`); this folder only records status, not the work items themselves. If `implementing` is used, it must stay a single status marker — never let it grow into a task dump.
3. After implementation, absorb outcomes into normal canon sections and mark the initiative `absorbed` (or remove it).

Design rationale: [`docs/superpowers/specs/2026-08-09-production-path-roadmap-design.md`](../../superpowers/specs/2026-08-09-production-path-roadmap-design.md).

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `draft` | Captured; not refined |
| `refining` | Active brainstorming / design |
| `implementing` | Build in progress (status marker only — not a task list) |
| `absorbed` | Outcomes merged into living canon |

## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 0 | Skill context efficiency | absorbed | [p0-skill-context-efficiency.md](p0-skill-context-efficiency.md) |
| 0c | Future plans authoring skill | absorbed | [p0c-future-plans-authoring-skill.md](p0c-future-plans-authoring-skill.md) |
| 0b | BM25 index | absorbed | [p0b-bm25-index.md](p0b-bm25-index.md) |
| 1 | Retrieval search & context pack | absorbed | [p1-retrieval-and-context-pack.md](p1-retrieval-and-context-pack.md) |
| 2a | Code AST index construction | absorbed | [p2a-code-ast-index.md](p2a-code-ast-index.md) |
| 2a-go | Go code AST index slice | absorbed | [p2a-go-code-index.md](p2a-go-code-index.md) |
| 2a-csharp | C# code AST index slice | absorbed | [p2a-csharp-code-index.md](p2a-csharp-code-index.md) |
| 2a-rust | Rust code AST index slice | absorbed | [p2a-rust-code-index.md](p2a-rust-code-index.md) |
| 2a-python | Python code AST index slice | absorbed | [p2a-python-code-index.md](p2a-python-code-index.md) |
| 2b | Code search tools | absorbed | [p2b-code-search-tools.md](p2b-code-search-tools.md) |
| 2c | Code analysis rules for agents & skills | absorbed | [p2c-code-analysis-rules.md](p2c-code-analysis-rules.md) |
| 3 | Production hardening | absorbed | [p3-production-hardening.md](p3-production-hardening.md) |
| 4 | BM25 scoring | absorbed | [p4-bm25-scoring.md](p4-bm25-scoring.md) |
| 5 | Glossary-aware search | absorbed | [p5-glossary-aware-search.md](p5-glossary-aware-search.md) |
| 6 | Code-refs member-access resolution | absorbed | [p6-code-refs-member-access.md](p6-code-refs-member-access.md) |
| 6a-go | Go code-refs member-access slice | absorbed | [p6a-go-code-refs-member-access.md](p6a-go-code-refs-member-access.md) |
| 6a-rust | Rust code-refs member-access slice | absorbed | [p6a-rust-code-refs-member-access.md](p6a-rust-code-refs-member-access.md) |
| 6a-csharp | C# code-refs member-access slice | absorbed | [p6a-csharp-code-refs-member-access.md](p6a-csharp-code-refs-member-access.md) |
| 6a-csharp-2 | C# code-refs member-access imported-type resolution | absorbed | [p6a-csharp-2-code-refs-member-access.md](p6a-csharp-2-code-refs-member-access.md) |
| 6a-python | Python code-refs member-access slice | absorbed | [p6a-python-code-refs-member-access.md](p6a-python-code-refs-member-access.md) |
| 7 | Strict search discipline | absorbed | [p7-strict-search-discipline.md](p7-strict-search-discipline.md) |

P0, P0c, P0b, P1, and P3 are absorbed. P2 split into three sequential initiatives — P2a (code AST index construction), P2b (code search tools), P2c (code analysis rules); P2a is fully absorbed (all five language slices shipped: TypeScript/JavaScript, Go, C#, Rust, Python), P2b and P2c are absorbed; P4 (BM25 scoring) and P5 (glossary-aware search) are absorbed — the doc-search quality scoring slice shipped them and their open questions are resolved in the initiative files (P5's expansion strategy follows the final rule: unique heading tokens only). P6 (code-refs member-access resolution) is `absorbed`, having shipped the deferred Block B from the A+B refs slice — it delivered `--refs Class.method` and sits below P4/P5 in the table as the code-side follow-up, not part of the current doc-search quality slice. The P2 trio outranks P4/P5 in the table: it fills the previously referenced-but-unwritten AST-extractor slot and is the code-side analogue of the canon's retrieval discipline. The code AST index is a separate artifact from the canon BM25 index — `doc-canon index` indexes `docs/canon/**` documentation, not code. The language list is TypeScript/JavaScript, Go, C#, Rust, Python (five); GDScript was dropped (out of scope). P6 is `absorbed` — the code-refs member-access resolution slice shipped `--refs Class.method` and its outcomes are merged into living canon (GLOSSARY `Member-access reference` term, CLI `--refs Class.method`, ARCHITECTURE code-index block) — with P6a-Go and P6a-CSharp now `absorbed` (their member-access slices shipped and their open questions are resolved in the initiative files; C# covers same-file and same-namespace `new Type(...)` bindings via `resolveCSharpNamespaceReferences` in `sync.ts`, leaving `using`/namespace-qualified/target-typed `new()` out of v1), P6a-Rust is `absorbed` (the Rust member-access slice shipped `Type::new()`/`Type::default()` associated-function-constructor bindings — same-file and imported names via the `use`-edge map, no cross-file pass — following the P2a language-slice precedent) and P6a-Python is `absorbed` (the final language slice — bare-call constructor bindings with the kind-grounded same-file + PascalCase-imported rule, aliases canonicalized; this completes the per-language P6a member-access set). P6a-csharp-2 is `absorbed` — the C# imported-type follow-up to the absorbed P6a-CSharp slice shipped `using`/`using`-alias, namespace-qualified `new NS.Type()`, explicit-typed target-typed `new()`, and cross-namespace type resolution via a deterministic syntactic project model (file↔namespace from `module` symbols + per-file `using` names) with own-first/using-union resolution and canonical edge names; its outcomes are merged into living canon (GLOSSARY `code-ast-index`, CLI `--refs Class.method`, ARCHITECTURE code-index block, CODE_INDEX C# row) and its open questions are resolved per the design spec's Decisions.

P7 (strict search discipline) is `absorbed`: it reversed P1's no-auto-reindex decision at the CLI layer, added the probe log / `discipline` gate, and hardened the search-first rule into a mandatory gate with machine-parseable miss notes (`code_miss` / `doc_miss`) — outcomes merged into living canon (`CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md`), shipped in `doc-canon@0.5.0`.
