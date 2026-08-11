# P1 — Retrieval search & context pack

- **Status:** refining
- **Focus:** Deterministic `doc-canon search` and bounded context packs, plus skill and CLI rules so agents know when and how to search canon — without owning index construction.
- **Depends on:** P0b BM25 index (hashes + `doc-canon index`); P0 Scout → Expand → Execute patterns
- **Unblocks:** Scale to larger canons; shared pack for coding agents later
- **Design:** [2026-08-11-bm25-index-and-retrieval-split-design.md](../../superpowers/specs/2026-08-11-bm25-index-and-retrieval-split-design.md) — approved split: P0b owns index freshness; this initiative owns search, pack, and usage protocol. Implement in a separate session after P0b.

## Intent

Agents should request “what matters for X” instead of reading every canon file. This initiative defines the retrieval *protocol*: public search CLI, pack shape and size policy, and Scout → Expand flows that use search results while preserving quality-over-thrift. The BM25 index itself is a black box produced by P0b.

## In scope

- CLI `doc-canon search <query>` (no LLM): score against the P0b index and emit a bounded pack
- Pack format and size knobs (aligned with `policies.max_lines` spirit): paths + scores + snippets; human and/or `--json` output
- Freshness policy at search time: **warn + serve** when hashes mismatch (`index_stale`); **fail closed** with hint to run `doc-canon index` when the index is missing
- Skill + CLI rules and example flows: when to search in Scout; how to treat stale warnings; Expand when pack is thin; when to call `index` (explicit / post-write / watcher already running — not silently inside every Scout search)
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

Resolved in the design linked above (corpus consumed via P0b index over `docs/canon/**`; stale = warn+serve; missing = fail closed; skills + CLI both document the protocol). No separate `doc-canon context` alias for v1 — `search` + pack is enough. Left for the implementation session:

- Exact pack encoding details (JSON schema field names, snippet window size, default `max-hits`)
- How strongly embedded skills mandate search vs INDEX-first Scout when no index exists yet
