# P1 — Retrieval search & context pack — Design Spec

**Date:** 2026-08-12  
**Status:** Approved for implementation planning  
**Initiative:** [`docs/canon/future_plans/p1-retrieval-and-context-pack.md`](../../canon/future_plans/p1-retrieval-and-context-pack.md)  
**Depends on:** P0b BM25 index (absorbed) — `doc-canon index`, dual artifacts, `openCanonIndex` from `doc-canon/index-reader`  
**Related:** [BM25 index vs retrieval pack split](./2026-08-11-bm25-index-and-retrieval-split-design.md) (ownership boundary SoT)  
**Approach:** Public `searchCanon` module + thin `doc-canon search` CLI; hybrid pack; try-then-fallback Scout protocol

## Problem

Agents still discover canon mainly by reading `INDEX.md` and dumping sections. P0b provides a durable BM25 index and reader facade, but there is no public search/pack surface and no skill protocol that tells agents when to search, how to treat stale/missing index, or how to keep the index fresh after substantive writes. Without that layer, larger canons stay expensive and retrieval stays ad hoc.

## Goals

1. Expose deterministic retrieval: score a query against the P0b index and return a **bounded hybrid context pack** (paths + scores + short snippets).
2. Ship a **public Node API** (`doc-canon/search`) and a thin CLI wrapper `doc-canon search` (human-first stdout, `--json` for machines).
3. Document skill + CLI usage so Scout always tries search first, falls back safely when the index is missing, and never silently under-reads.
4. After successful substantive canon writes, skills **run** one-shot `doc-canon index` (not only hint).
5. Preserve Scout → Expand → Execute and **quality over thrift**; search never licenses inventing or skipping needed evidence.
6. Keep search free of LLM/embeddings and free of auto-reindex-on-stale.

## Non-goals

- Index build, watcher, hashes, or `doc-canon index` behavior (P0b)
- Auto-reindex inside `search` on hash mismatch
- Vector / embedding search as the engine
- Git-diff analyzer as primary retrieval
- Pluggable AST extractors (P2)
- Separate `doc-canon context` alias in v1
- Writing pack artifacts under `.doc-canon/` for reuse
- Changing living SoT before canon-first absorption at ship time

## Decisions

| Topic | Choice |
| --- | --- |
| Surface | Public `searchCanon` + thin CLI `doc-canon search` |
| Output | Human-first stdout; `--json` emits the same Pack shape |
| Pack shape | Hybrid: ranked paths + scores + short snippet windows |
| Missing / corrupt index | Fail closed + hint to run `doc-canon index` |
| Stale hashes | Warn + serve (`index_stale`); exit 0; do not auto-reindex |
| Zero hits | Success with empty `hits[]` (not an error) |
| Scout protocol | Always try search first; on CLI fail-closed → INDEX-first Scout + explicit index hint |
| Post-write freshness | After successful substantive canon writes, skill runs one-shot `doc-canon index` |
| Watch | Optional long-session tool (`--watch`); skills do not start watch by default |
| Snippet source | Live files on disk after BM25 doc ranking (not a second index) |
| Size policy | `max-hits` / `snippet-lines` / windows-per-hit + soft total snippet-line cap |

## Architecture

```text
docs/canon/**  ──(P0b)──►  .doc-canon/{index-manifest,bm25-index}.json
                                    │
                         openCanonIndex (doc-canon/index-reader)
                                    │
                         searchCanon (doc-canon/search)  ← P1
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
            doc-canon search                   Node consumers
            (human / --json)                   (skills, later agents)
                    │
                    ▼
         Scout → Expand → Execute
         (+ post-write: doc-canon index)
```

### Ownership

**P1 owns**

- `searchCanon(root, query, options) → PackResult` exported as `doc-canon/search`
- CLI `doc-canon search` as a thin wrapper
- Pack schema, size knobs, freshness semantics at search time
- Skill/CLI protocol: try-then-fallback Scout; stale handling; post-write `index`

**P1 does not own**

- Index construction, watch, content hashes, artifact IO (P0b)
- Auto-reindex inside search
- Embeddings / git-diff retrieval / AST extractors

### Data flow

1. Open index via `openCanonIndex(root)` (fail closed if pair missing/corrupt/`index_id` mismatch).
2. Compare `manifest` doc hashes to `liveHashes()`; set `freshness` to `fresh` or `stale`.
3. `score(query)` → take top `maxHits`.
4. For each hit, read the live markdown file and extract up to `maxWindowsPerHit` windows of `snippetLines` lines centered on query-term matches.
5. Enforce a soft total snippet-line budget across the pack; truncate later hits/windows rather than exceed it.
6. Return `PackResult`; CLI prints human text or `--json`.

## Pack format & CLI

### CLI

```text
doc-canon search <query> [--json] [--max-hits N] [--snippet-lines N] [--root <path>]
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--json` | off | Emit Pack JSON on stdout |
| `--max-hits` | `10` | Max ranked documents in the pack |
| `--snippet-lines` | `4` | Lines per snippet window |
| `--root` | cwd project root | Same root resolution spirit as other commands |

- Human mode: ranked path, score, snippets on stdout; stale warning on stderr.
- `--json`: one Pack object on stdout; `warnings` included in the object; stale still exit 0.
- Exit ≠0: missing/corrupt index, empty/whitespace-only query.
- Exit 0: success, including stale and zero hits.
- No auto-reindex.

### Pack schema (machine contract)

Snake_case field names (aligned with index artifacts):

```json
{
  "query": "string",
  "index_id": "string",
  "freshness": "fresh | stale",
  "warnings": ["index_stale"],
  "hits": [
    {
      "path": "docs/canon/CLI.md",
      "score": 1.23,
      "snippets": [
        { "start_line": 10, "text": "..." }
      ]
    }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `query` | Original query string |
| `index_id` | From the open index handle |
| `freshness` | `fresh` or `stale` |
| `warnings` | e.g. `["index_stale"]`; empty when fresh |
| `hits[]` | Ordered by descending score, then path for ties |
| `hits[].path` | Repo-relative canon path |
| `hits[].score` | BM25 score |
| `hits[].snippets[]` | Short windows; `text` required; `start_line` 1-based when known |

**Snippet / size defaults**

- Up to **2** windows per hit (`maxWindowsPerHit`)
- Soft total snippet-line cap across the pack: **~120** (aligned with `policies.max_lines` spirit, not a hard substitute for Expand deep reads)
- Truncate additional windows/hits to respect the cap

### Public API

```ts
searchCanon(
  root: string,
  query: string,
  options?: {
    maxHits?: number;
    snippetLines?: number;
    maxWindowsPerHit?: number;
    maxSnippetLinesTotal?: number;
  },
): PackResult;
```

- Missing/corrupt index and empty query: throw a typed/search error (CLI maps to ≠0 + message).
- Stale: successful `PackResult` with `freshness: "stale"` and `warnings` including `index_stale`.

Package export: add `"./search"` alongside existing `"./index-reader"`.

## Skill & agent protocol

### Scout

1. Always try `doc-canon search "<topic>"` first (or `searchCanon` for Node consumers).
2. If search fail-closed (missing/corrupt): fall back to INDEX-first Scout and emit an explicit hint to run `doc-canon index`. Do not hard-stop the skill.
3. If `index_stale`: surface the warning; continue with the pack; Expand if evidence feels thin.
4. Build the working-set stub from `hits[].path` (and brief stubs from snippets), not from dumping all canon files.

### Expand

- Gate unchanged: `sufficient` / `need more`.
- Thin or empty pack → alternate query, INDEX section ids, or targeted reads — never invent.
- Deep reads only on pack paths plus Expand additions.

### Execute

- Unchanged; search does not replace evidence-backed deep reads.

### When to call `index` (never inside `search`)

| Trigger | Behavior |
| --- | --- |
| After successful **substantive** writes to `docs/canon/**` via managed skills | Skill **runs** one-shot `doc-canon index` |
| User explicitly asks | Run `index` |
| Long edit sessions | Optional `doc-canon index --watch` (operator/skill may start it; not required every session) |
| Every Scout `search` | Never silent reindex |

If one-shot `index` fails because a watch holds the P0b pid lock, the skill surfaces that outcome and relies on the running watch (or suggests `--stop` then re-index) — it does not fight the lock inside `search`.

### Quality invariant

Search never licenses under-read. Quality over thrift remains: expand when doubtful.

## Error handling

| Case | Behavior |
| --- | --- |
| Empty / whitespace-only query | Fail closed |
| Missing or corrupt index / `index_id` mismatch | Fail closed + hint `doc-canon index` |
| Hash mismatch vs live corpus | Success + `index_stale` warn + pack |
| Zero BM25 hits | Success, `hits: []` |
| Hit file missing on disk (race) | Skip that hit entirely (do not emit a partial hit); do not fail the whole search |
| Watch running during post-write `index` | Follow P0b one-shot rules; surface lock failure to the user/skill |

## Testing

- **Unit (`searchCanon`):** missing index fails; stale yields warning + hits; caps on hits/snippets/total lines; deterministic ordering; empty query fails; empty hits succeed.
- **CLI:** human vs `--json` shape parity; exit codes; stderr warn on stale in human mode.
- **Skill acceptance scenarios (docs):** Scout uses search; missing → INDEX fallback + hint; post-write runs `index`; Expand still required when pack is thin.

## Absorption (after implementation)

Update living canon via `canon-write` (not this spec):

- `CLI.md` — `search` command and flags
- `ARCHITECTURE.md` — retrieval/pack path and `doc-canon/search` export
- `SKILLS.md` — Scout search protocol, stale/missing, post-write `index`
- `GLOSSARY.md` — pack, search, `index_stale`
- `OVERVIEW.md` — In scope includes `search`
- Acceptance skill scenarios as needed

Then mark the initiative `absorbed` via `canon-future-plan`.

Until ship, keep the initiative in `refining` / `implementing` and point its Design link at this file.

## Implementation order (after plan)

1. Refine `p1-retrieval-and-context-pack.md` Design link / open questions via `canon-future-plan` to match this spec.
2. Canon-first living-section updates when ready to implement (`canon-write`).
3. Implement `searchCanon` + package export + snippet extraction.
4. Implement CLI `search` wrapper.
5. Embed skill/CLI protocol updates (managed skills + docs).
6. Tests + acceptance scenarios.
7. Absorb into living canon; mark initiative `absorbed`.

## Open questions

None blocking for planning. Defaults above (`max-hits` 10, `snippet-lines` 4, 2 windows/hit, ~120 total snippet lines) may be tuned in the implementation plan or during coding without changing ownership or protocol decisions.
