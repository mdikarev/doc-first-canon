# BM25 index vs retrieval pack — Design Spec

**Date:** 2026-08-11  
**Status:** Approved for implementation planning  
**Initiatives (to remap via `canon-future-plan`):**
- A ← current [`p0b-smart-cache.md`](../../canon/future_plans/p0b-smart-cache.md) → BM25 index build + hashes + watcher + `doc-canon index`
- B ← current [`p1-retrieval-and-context-pack.md`](../../canon/future_plans/p1-retrieval-and-context-pack.md) → `doc-canon search`, pack format, skill/CLI usage rules  
**Approach:** Split “index freshness” from “how agents search and pack context”; hashes live inside A as invalidation, not as a standalone skip-re-read cache

## Problem

`p0b-smart-cache` is a small content-hash / skip-re-read idea, while `p1-retrieval-and-context-pack` bundles index build, on-the-fly rebuild, search, pack, and skill flows into one large initiative. That mixes two different products: a durable local index with freshness guarantees, and a behavioral protocol for when/how agents retrieve canon context. Implementation and review become harder than necessary.

## Goals

1. **Initiative A (remapped P0b):** Build and maintain a local BM25-style index over `docs/canon/**`, with per-document content hashes and near–real-time watcher-driven **incremental** updates of changed docs only; expose `doc-canon index` (including `--watch`).
2. **Initiative B (narrowed P1):** Expose `doc-canon search`, define bounded pack format and size policy, and document skill + CLI flows so agents always know when/how to search canon.
3. Keep both layers **deterministic** (no LLM, no embeddings as the search engine).
4. Preserve Scout → Expand → Execute and **quality over thrift**: search never licenses skipping needed evidence.
5. Remap existing future-plan files/INDEX rows (prefer rewrite + rename of P0b/P1, not new lettered forks), via `canon-future-plan` — not ad-hoc coding-agent edits to `docs/canon/**`.

## Non-goals

- Vector / embedding search as the primary engine
- Git diff analyzer as the primary invalidation path
- AST extractors (P2)
- Standalone “hash-only skip re-scout” product separate from the BM25 index (hashes are index metadata)
- Auto-reindex inside `search` on hash mismatch
- Claude Code packaging
- Changing MVP living SoT beyond what absorption of A/B will later require

## Decisions

| Topic | Choice |
| --- | --- |
| Split | A = index build/update + hashes + watcher + `doc-canon index`; B = `doc-canon search` + pack + skill/CLI rules |
| Corpus | `docs/canon/**` only (includes `future_plans/`) |
| Update model | Incremental: reindex only changed documents (hash-driven); prefer true incremental BM25 stats when feasible |
| Freshness trigger | Watcher ≈ real-time (`doc-canon index --watch`); also explicit `doc-canon index` |
| Stale on `search` | **Warn + serve stale** (do not auto-reindex; do not fail closed solely for mismatch) |
| Missing index | `search` fail closed with hint to run `doc-canon index` |
| CLI ownership | `index` owned by A; `search` owned by B |
| Skill stale handling | Continue with pack; Expand if doubtful; refresh index only on explicit / post-write triggers, not hidden in Scout |
| Remap | Rewrite P0b → BM25 index initiative (rename file/INDEX); narrow P1 to retrieval/pack/rules; P1 depends on A |
| Pre-code gate | Canon-first: update living canon via `canon-write` / initiative bodies via `canon-future-plan` before app/CLI implementation; this spec does not replace that |

## Architecture

```text
docs/canon/** ──watcher / index──► .doc-canon/index-manifest.json
                                  .doc-canon/bm25-index.json
                                         │
                                         ▼
user / skill ──► doc-canon search <query> ──► pack (+ optional index_stale warn)
                                         │
                                         ▼
                              Scout → Expand → Execute
```

### Initiative A — Index build & freshness

**Owns**

- Content hashing: `doc_path → doc_hash` (+ token/length metadata as needed)
- BM25 index artifact and incremental update of changed docs
- Watcher mode and one-shot rebuild/update
- CLI: `doc-canon index` [`--watch`]

**Artifacts** (under `.doc-canon/`, typically gitignored)

- `index-manifest.json` — corpus scope, `schema_version`, per-doc hashes
- `bm25-index.json` (or equivalent) — postings / df / avgDocLen; tied to manifest version

**Public contract of A:** “Index `I` corresponds to corpus version `V` (hash set); given changed docs, update to `V'`.”

### Initiative B — Retrieval protocol

**Owns**

- CLI: `doc-canon search <query>` (no LLM)
- Pack format (manifest of paths + scored snippets; exact encoding TBD in plan) and size knobs aligned with `policies.max_lines` spirit
- Skill guidance: when to search, how to treat warn/stale, Expand vs re-query, examples/flows
- Does **not** own hash computation or index rebuild

**Stale vs missing**

| Condition | `search` behavior |
| --- | --- |
| No index artifacts | Fail closed + hint: run `doc-canon index` |
| Hash mismatch (stale) | Warn (`index_stale`) + still return pack from current index |
| Index present & fresh | Return pack normally |

## Skill workflow (B)

1. Scout: call `doc-canon search <topic>` instead of dumping all canon markdown.
2. If warn `index_stale`: surface it; continue with pack; Expand if evidence feels thin.
3. Expand gate unchanged: insufficient pack → other query / section ids / INDEX fallback — never invent.
4. Execute: deep reads only on paths from the pack (plus Expand additions).
5. Call `doc-canon index` when the user asks, after substantial canon writes, or when relying on `--watch` already running — **not** silently inside every Scout `search`.

## Future-plans remapping

| Current | Target |
| --- | --- |
| P0b “Smart cache” | BM25 index + hashes + watcher + `doc-canon index` (rename file e.g. `p0b-bm25-index.md`) |
| P1 “Retrieval & context pack” | Search + pack + skill/CLI rules only; depends on remapped P0b |
| Old “skip re-read without BM25” | Out of scope for these initiatives |

Execution of INDEX/prose edits: `canon-future-plan` in a later session. Absorption into living `CLI.md` / `ARCHITECTURE.md` / `SKILLS.md` / glossary after implementation.

## Error handling (summary)

- Corrupt / unreadable index: fail closed on `search` with clear message; repair via `doc-canon index`
- Watcher failure: index may go stale; `search` warns and serves; operator restarts watch or runs one-shot `index`
- Empty query / empty corpus: fail closed with usable diagnostics

## Testing (direction)

- A: hash change on one file updates only that doc’s contribution; watcher picks up create/update/delete under `docs/canon/**`
- B: `search` with missing index exits ≠0; with stale hashes prints warn and still emits pack; pack respects size policy
- Skill scenarios (acceptance docs): Scout uses search; Expand still required when pack is thin

## Open questions (deferred to implementation plan)

- Exact on-disk BM25 schema and whether true incremental IDF/df updates vs segment rebuild
- Pack encoding: JSON vs markdown concat vs path manifest + optional snippet windows
- Whether `search` stdout is human-first, machine-first, or dual (`--json`)
- How aggressively post-`canon-write` should suggest or run `index`

## Implementation order (after plans)

1. Remap future_plans A/B via `canon-future-plan`
2. Canon-first living-section updates when ready to implement
3. Implement A (`index` + artifacts + watcher + incremental update)
4. Implement B (`search` + pack + skill/CLI guidance)
5. Absorb into living canon; mark initiatives `absorbed`

## Related

- [`docs/canon/future_plans/INDEX.md`](../../canon/future_plans/INDEX.md)
- [`docs/canon/future_plans/p0b-smart-cache.md`](../../canon/future_plans/p0b-smart-cache.md)
- [`docs/canon/future_plans/p1-retrieval-and-context-pack.md`](../../canon/future_plans/p1-retrieval-and-context-pack.md)
- Living: `CLI.md`, `ARCHITECTURE.md`, `SKILLS.md` (post-absorption targets)
