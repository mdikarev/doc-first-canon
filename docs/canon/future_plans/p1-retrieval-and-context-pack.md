# P1 — Retrieval search & context pack

- **Status:** refining
- **Focus:** Deterministic public `searchCanon` retrieval, a thin `doc-canon search` CLI, bounded context packs, and skill/CLI rules for try-then-fallback Scout and post-write indexing — without owning index construction.
- **Depends on:** P0b BM25 index (hashes + `doc-canon index`); P0 Scout → Expand → Execute patterns
- **Unblocks:** Scale to larger canons; shared pack for coding agents later
- **Design:** [2026-08-12-p1-retrieval-and-context-pack-design.md](../../superpowers/specs/2026-08-12-p1-retrieval-and-context-pack-design.md) — approved P1 design; the earlier split remains its ownership-boundary reference.

## Intent

Agents should request “what matters for X” instead of reading every canon file. This initiative defines the retrieval *protocol*: public search CLI, pack shape and size policy, and Scout → Expand flows that use search results while preserving quality-over-thrift. The BM25 index itself is a black box produced by P0b.

## In scope

- Public Node API `searchCanon(root, query, options) → PackResult`, exported as `doc-canon/search`
- Thin CLI `doc-canon search <query>` (no LLM): score against the P0b index and emit the same bounded pack in human-first or `--json` form
- Hybrid pack format and size knobs (aligned with `policies.max_lines` spirit): ranked paths + scores + short snippet windows
- Freshness policy at search time: **warn + serve** when hashes mismatch (`index_stale`); **fail closed** with hint to run `doc-canon index` when the index is missing
- Skill + CLI rules and example flows: always try search first in Scout; fall back to INDEX-first Scout when search fails closed; surface stale warnings; Expand when the pack is thin
- After successful substantive canon writes, managed skills **run** one-shot `doc-canon index`; watch remains optional for long sessions
- Contract/policy guidance absorbed into living `CLI.md` / `SKILLS.md` when this ships

## Out of scope

- Index build, content-hash manifest maintenance, watcher, and `doc-canon index` (P0b)
- Vector embeddings / hosted RAG as the first search engine
- Git diff analyzer as primary retrieval
- Pluggable AST extractors (P2)
- Delta/patch as the primary doc-edit format
- Auto-reindex inside `search` on stale

## Absorbs into

Likely: `CLI.md` (`search`), `ARCHITECTURE.md` (retrieval/pack path), `SKILLS.md` (Scout search protocol, stale/missing handling), glossary terms for pack/search; acceptance skill scenarios.

## Open questions

None blocking. The approved design fixes the snake_case Pack fields; defaults (`max-hits` 10, `snippet-lines` 4, up to 2 windows per hit, and a soft ~120 total snippet-line cap); and the Scout rule (always try search first, then fall back to INDEX-first Scout with an explicit index hint when search fails closed). These defaults may be tuned during implementation without changing the initiative's ownership or protocol decisions.
