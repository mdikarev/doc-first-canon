# P0b — BM25 index for canon

> Outcomes absorbed into `CLI.md`, `ARCHITECTURE.md`, `OVERVIEW.md`, and `GLOSSARY.md` (`index` / `--watch` / `--stop`, dual artifacts, reader facade, glossary terms).

- **Status:** absorbed
- **Focus:** Local BM25 index over `docs/canon/**` with per-document content hashes, hash-driven logical full rebuilds on any change, poll-based `doc-canon index --watch` (default 2000 ms) with `--stop` and a pid lock, and a public reader facade for P1.
- **Depends on:** P0 Scout → Expand → Execute patterns (already absorbed)
- **Unblocks:** P1 retrieval (`doc-canon search` / context pack / skill search rules)
- **Design:** [2026-08-11-p0b-bm25-index-design.md](../../superpowers/specs/2026-08-11-p0b-bm25-index-design.md) — detailed SoT for P0b behavior (update model, watch, tokenization, artifacts, facade, CLI). The [split design](../../superpowers/specs/2026-08-11-bm25-index-and-retrieval-split-design.md) remains related but only as SoT for the P0b↔P1 ownership boundary, not for P0b implementation details. Implementation planned separately (not tracked here).

## Intent

Skills and CLI need a durable, deterministic retrieval substrate so later search can select relevant canon
without dumping every markdown file. Content hashes are the freshness mechanism for that index—not a
standalone “skip re-scout” cache and not embeddings. On any create/update/delete detected via hash diff, the
index does a logical full BM25 rebuild from the current corpus rather than true posting-level incremental
updates — simpler and fit for small canons. A poll-based watcher (`doc-canon index --watch`, default 2000 ms,
`--stop` to end it, pid lock to keep a single instance) keeps the index aligned with on-disk `docs/canon/**`
without requiring native FS events.

## In scope

- Corpus: `docs/canon/**` only (includes `future_plans/`)
- Per-document content hashes (`doc_path → doc_hash`) and an index manifest under `.doc-canon/` (typically gitignored)
- Local BM25 postings / statistics artifact tied to that manifest, sharing an opaque `index_id` with the manifest
- Hash-driven change detection: diff current corpus hashes against the manifest to find created/updated/deleted docs
- Logical full BM25 rebuild from all current docs on any detected change (not true posting-level incremental updates)
- Poll-based `doc-canon index --watch` (default interval 2000 ms, `--interval` configurable) plus one-shot `doc-canon index`, `--stop` to end a running watch, and a pid lock so only one watch instance runs at a time
- Dual on-disk artifacts (`index-manifest.json` + `bm25-index.json`) plus a public, stable reader facade (`openCanonIndex` from `doc-canon/index-reader`) for P1 to consume instead of parsing raw JSON
- Deterministic CLI surface for build/update only — no LLM

## Out of scope

- `doc-canon search`, context pack format, and skill retrieval flows (P1)
- Standalone hash-only skip-re-read product without BM25
- Vector / embedding indexes
- Git diff as the primary invalidation path
- AST extractors (P2)
- Auto-reindex inside search (P1 decides stale behavior; this initiative only builds/updates the index)

## Absorbs into

Absorbed into: `CLI.md` (`index` / `--watch` / `--stop`), `ARCHITECTURE.md` (index/sync building block, dual artifacts, reader facade), `OVERVIEW.md` (In scope), `GLOSSARY.md` (manifest / hash / `index_id` / bm25-index terms). Skill guidance for *when* to run `index` stays thin here; Scout/search protocol belongs to P1.

## Open questions

None blocking — resolved by the design linked above (corpus = canon only; hash-driven change detection with logical full rebuild, not true incremental; poll-based watch, not `fs.watch`; CLI `index`/`--watch`/`--stop` owned here). Deferred to the implementation session only:

- Exact JSON field names inside the `bm25-index.json` postings blob
- Opaque `index_id` generation strategy
- Whether a `--force` rewrite-even-if-fresh flag is worth adding (default: no)
