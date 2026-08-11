# P0b — BM25 index for canon

- **Status:** refining
- **Focus:** Local BM25 index over `docs/canon/**` with per-document content hashes, near–real-time watcher-driven incremental updates of changed docs, and CLI `doc-canon index` (including `--watch`).
- **Depends on:** P0 Scout → Expand → Execute patterns (already absorbed)
- **Unblocks:** P1 retrieval (`doc-canon search` / context pack / skill search rules)
- **Design:** [2026-08-11-bm25-index-and-retrieval-split-design.md](../../superpowers/specs/2026-08-11-bm25-index-and-retrieval-split-design.md) — approved split: this initiative owns index build & freshness; P1 owns search/pack/usage rules. Implementation planned separately (not tracked here).

## Intent

Skills and CLI need a durable, deterministic retrieval substrate so later search can select relevant canon without dumping every markdown file. Content hashes are the freshness mechanism for that index—not a standalone “skip re-scout” cache and not embeddings. Near–real-time watcher updates keep the index aligned with on-disk `docs/canon/**` by reindexing only changed documents.

## In scope

- Corpus: `docs/canon/**` only (includes `future_plans/`)
- Per-document content hashes (`doc_path → doc_hash`) and an index manifest under `.doc-canon/` (typically gitignored)
- Local BM25 postings / statistics artifact tied to that manifest
- Incremental update model: detect changed/new/deleted docs via hashes; update only those documents’ contributions
- Near–real-time freshness via watcher (`doc-canon index --watch`) plus one-shot `doc-canon index`
- Deterministic CLI surface for build/update only — no LLM

## Out of scope

- `doc-canon search`, context pack format, and skill retrieval flows (P1)
- Standalone hash-only skip-re-read product without BM25
- Vector / embedding indexes
- Git diff as the primary invalidation path
- AST extractors (P2)
- Auto-reindex inside search (P1 decides stale behavior; this initiative only builds/updates the index)

## Absorbs into

Likely: `CLI.md` (`index` / `--watch`), `ARCHITECTURE.md` (index/sync building block and artifacts), `GLOSSARY.md` (manifest / hash / bm25-index terms). Skill guidance for *when* to run `index` stays thin here; Scout/search protocol belongs to P1.

## Open questions

Resolved in the design linked above (corpus = canon only; incremental hash-driven updates; watcher ≈ real-time; CLI `index` owned here). Left for the implementation session:

- Exact on-disk BM25 schema and whether true incremental IDF/df updates vs segment rebuild
- Watcher robustness across platforms (`fs.watch` vs poll fallback)
