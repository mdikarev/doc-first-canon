# P0b — BM25 index (standalone) — Design Spec

**Date:** 2026-08-11  
**Status:** Draft for review  
**Initiative:** [`p0b-bm25-index.md`](../../canon/future_plans/p0b-bm25-index.md)  
**Related split (approved):** [`2026-08-11-bm25-index-and-retrieval-split-design.md`](./2026-08-11-bm25-index-and-retrieval-split-design.md) — this document is the detailed SoT for **Initiative A / P0b** only. Where this spec and the older implementation plan disagree, **this spec wins**; update the plan after approval.  
**Approach:** Dual on-disk artifacts + hash-driven logical full rebuild + poll watch + thin reader facade for P1

## Problem

Agents and CLI need a durable, deterministic retrieval substrate over `docs/canon/**` so later `search` (P1) can rank relevant sections without dumping every markdown file. The approved split assigned index build/freshness to P0b, but left open the concrete update model, watcher UX, tokenization, and the stable contract P1 should consume. An existing plan assumed true posting-level incremental updates and `fs.watch`; this design replaces those choices with a simpler model fit for small canons.

## Goals

1. Ship `doc-canon index` (one-shot) and `doc-canon index --watch` / `--stop` that keep local BM25 artifacts aligned with on-disk canon.
2. Expose a **public contract** P1 can rely on: documented dual artifacts **plus** a thin stable reader facade (`openCanonIndex`), not ad-hoc JSON parsing in search code.
3. Keep the layer **deterministic** (no LLM, no embeddings).
4. Prefer simplicity over micro-optimized incremental postings: detect change via content hashes; on any churn, rebuild BM25 from the full current corpus.
5. Give operators a predictable watch lifecycle (single-instance, explicit stop).

## Non-goals

- `doc-canon search`, context pack format, Scout skill retrieval protocol (P1)
- Vector / embedding indexes
- Git diff as the primary invalidation path
- True posting-level incremental IDF/df updates (remove-one-doc-in-place without full rebuild)
- `fs.watch` / native FS events (v1 is poll-only)
- Stemming / stopword lists
- Auto-reindex inside `search`
- Claude Code packaging

## Decisions

| Topic | Choice |
| --- | --- |
| Scope of this spec | Full standalone P0b design (architecture → CLI → errors → tests) |
| Success bar | Working index/watch **and** explicit artifact + facade contract for P1 |
| Update model | **Logical incremental:** hash diff detects create/update/delete; any change → **full BM25 rebuild** from all current docs |
| Watch mechanism | **Poll only** (`setInterval`); default 2000 ms; `--interval <ms>` (min 200) |
| Watch lifecycle | Foreground process; pid lock; stop via signal **or** `doc-canon index --stop` |
| Tokenization | Unicode letters/digits: lowercase + split on non-`\p{L}`/`\p{N}` |
| P0b → P1 contract | Dual artifacts + **thin facade** `openCanonIndex(root)` (not raw module sprawl, not JSON-only) |
| Artifact layout | `.doc-canon/index-manifest.json` + `.doc-canon/bm25-index.json` |
| Corpus | `docs/canon/**/*.md` only (includes `future_plans/`) |
| CLI ownership | `index`, `--watch`, `--stop`, `--interval`, `--root` |

## Architecture

```text
docs/canon/**/*.md
        │
        ▼
  list + contentHash          ◄── syncCanonIndex(root)
        │
        ├─ hashes == manifest? ──► no-op (fresh)
        │
        └─ any create/update/delete
                 │
                 ▼
        rebuild Bm25Index from all current docs
                 │
                 ▼
   .doc-canon/index-manifest.json
   .doc-canon/bm25-index.json     (atomic write pair)

doc-canon index              → one-shot sync
doc-canon index --watch      → poll → sync
doc-canon index --stop       → SIGTERM watch via pid file

P1 later:
  openCanonIndex(root) → { score, manifest, … }
```

**Invariants**

- Deterministic; no LLM
- Artifacts under `.doc-canon/` (typically gitignored)
- Unchanged hashes → do not rewrite artifacts
- Manifest written **last** as the commit marker after a successful bm25 write

## Components

| Module | Role |
| --- | --- |
| `src/index/hash.ts` | `contentHash(text)` → `sha256:<hex>` over UTF-8 bytes |
| `src/index/tokenize.ts` | Unicode tokenize (see Decisions) |
| `src/index/list.ts` | Walk `docs/canon/**`, collect `.md`, posix-relative paths from `--root` |
| `src/index/bm25.ts` | In-memory BM25 Okapi (`k1=1.2`, `b=0.75`); build-from-docs; `score`; serialize |
| `src/index/io.ts` | Load/save pair; atomic tmp+rename; schema_version checks |
| `src/index/sync.ts` | `syncCanonIndex(root)` |
| `src/index/watch.ts` | Poll loop; pid lock acquire/release |
| `src/index/reader.ts` | **Stable facade** for P1 |
| `src/commands/index-cmd.ts` | CLI wiring |

### On-disk artifacts

**`index-manifest.json`**

```json
{
  "schema_version": 1,
  "built_at": "ISO-8601",
  "corpus": "docs/canon/**",
  "docs": {
    "docs/canon/CLI.md": { "hash": "sha256:…", "token_count": 123 }
  }
}
```

**`bm25-index.json`**

- `schema_version: 1`
- Serializable postings / df / docLens / avgdl (exact field names fixed in implementation; **P1 must not depend on them** — use the facade)

### Reader facade (P0b public library contract)

`openCanonIndex(root)`:

- Loads manifest + bm25 pair or throws if missing/corrupt/schema mismatch
- `.score(query: string): Array<{ path: string; score: number }>` — BM25 Okapi; omit zero scores; sort descending
- Exposes manifest / per-doc hashes so P1 can compare live disk hashes for `index_stale` without reimplementing IO
- May expose a small helper to recompute live hash set for freshness (implementation detail; keep stable)

Internal modules (`bm25.ts` postings shape, etc.) may change as long as facade + `schema_version` policy hold.

## Data flow & CLI

### `syncCanonIndex(root)`

1. Resolve `docs/canon/` under root; missing → fail closed.
2. List all `**/*.md` (posix paths relative to root).
3. Read each file → hash + keep text for possible rebuild.
4. Load existing manifest if present; missing/unreadable → treat as empty.
5. Diff: new / changed hash / deleted.
6. No diff → `{ status: "fresh", indexed: N }` (leave artifacts untouched, including `built_at`).
7. Diff → build fresh `Bm25Index` from **all** current docs → write `bm25-index.json` then `index-manifest.json` via tmp+rename → `{ status: "updated", indexed: N, changed: […] }`.

### CLI surface

| Invocation | Behavior |
| --- | --- |
| `doc-canon index` | One-shot sync; exit 0 on fresh/updated; human summary on stdout |
| `doc-canon index --watch` | Initial sync, then poll; default interval **2000 ms**; `--interval <ms>` (min 200) |
| `doc-canon index --stop` | Stop running watch via pid file |
| `--root <path>` | Same as other commands |

`--json` CLI output is out of scope for P0b v1.

### Watch UX (human workflow)

Watch is a **foreground long-lived process**, not a hidden daemon:

1. Operator opens a terminal tab → `doc-canon index --watch`.
2. First sync runs immediately; subsequent ticks poll and sync.
3. Work continues in the IDE / other terminals; canon edits are picked up within ~interval.
4. End of session → Ctrl+C **or** `doc-canon index --stop` from another terminal.
5. Agents/`search` do **not** require watch: without it, run one-shot `doc-canon index` after substantive canon writes.

**Single-instance:** `.doc-canon/index-watch.pid`. If pid is alive, a second `--watch` exits ≠0 with `already running (pid N)`. Stale pid (process dead) → take over after cleanup.

**`--stop`:** read pid → SIGTERM → remove lock. Not running / stale → exit 0, idempotent message (`not running`), clean stale lock if needed.

Watch logs updates only when `status === "updated"` (no spam on fresh ticks).

## Error handling

| Situation | Behavior |
| --- | --- |
| No `docs/canon/` | `index` fail closed, exit ≠0 |
| Corrupt / unreadable / schema mismatch artifacts | Writer treats as empty and full-rebuilds; `openCanonIndex` fail closed |
| Partial write (pair inconsistent) | Reader fail closed; next `index` rebuilds both |
| Empty corpus (0 `.md`) | Write empty-but-valid artifacts; exit 0; `score` → `[]` |
| Watch already running | `--watch` exit ≠0 + pid message |
| `--stop` idle / stale | exit 0 + cleanup |
| Transient I/O error mid-watch | Log stderr; keep polling |
| `docs/canon` disappears during watch | exit ≠0 |
| Invalid `--interval` | fail closed before start |

P0b does **not** define `search` stale/missing policy (P1). Freshness from the index side is “manifest hashes ↔ current files.”

## BM25 formula

Okapi BM25 with `k1 = 1.2`, `b = 0.75`:

For each query term `t` in doc `d`:  
`idf(t) * (tf * (k1+1)) / (tf + k1 * (1 - b + b * |d|/avgdl))`  
where `idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))`.

Document this idf form in `bm25.ts` and lock tests to it.

## Testing

**Unit:** hash stability; Unicode tokenize (including non-ASCII letters); BM25 ranking; JSON round-trip; empty index.

**Sync integration (temp fixtures):** first index creates both files; second unchanged run → `fresh`; edit one file → `updated` + hash change; delete file → path removed; corrupt bm25 → repaired by rebuild.

**CLI:** `index` listed in `--help`; missing canon → ≠0; second `--watch` fails; `--stop` stops / idempotent.

**Facade:** `openCanonIndex` after sync; throws on missing/corrupt; `.score` matches fixture expectations.

**Out of scope:** search pack, skill flows, embeddings.

## Implementation order (after plan)

1. Canon-first: refresh living `CLI.md` / `ARCHITECTURE.md` / glossary via `canon-write` (and point the initiative Design link at this spec via `canon-future-plan` if needed).
2. Wait for explicit go-ahead after substantial canon updates.
3. Implement library: hash, tokenize, list, bm25, io, sync, reader.
4. Implement CLI one-shot `index`.
5. Implement watch pid lock + poll + `--stop`.
6. Absorb into living canon; mark P0b `absorbed` when shipped (separate from P1).

## Relationship to prior artifacts

| Artifact | Role after this spec |
| --- | --- |
| Split design | Remains SoT for P0b vs P1 boundary |
| This spec | SoT for P0b detailed behavior |
| `docs/superpowers/plans/2026-08-11-bm25-index.md` | Must be revised to match (logical rebuild, poll, Unicode, facade, `--stop`) before/during implementation planning |

## Open questions

None blocking design. Deferred to implementation plan only:

- Exact JSON field names inside `bm25-index.json` postings blob
- Whether `--force` rewrite-even-if-fresh is worth a flag (default: no)

## Related

- [`docs/canon/future_plans/p0b-bm25-index.md`](../../canon/future_plans/p0b-bm25-index.md)
- [`docs/canon/future_plans/p1-retrieval-and-context-pack.md`](../../canon/future_plans/p1-retrieval-and-context-pack.md)
- Living absorption targets: `CLI.md`, `ARCHITECTURE.md`, `GLOSSARY.md`
