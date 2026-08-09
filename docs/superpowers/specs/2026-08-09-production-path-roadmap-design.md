# Production path & agent-context efficiency — Design Spec

**Date:** 2026-08-09  
**Status:** Approved for capturing long-term drafts (not for immediate implementation)  
**Approach:** Phased initiatives under `docs/canon/future_plans/`; refine each via separate brainstorming; build `docs/roadmap/` later; absorb into living canon after implementation

## Problem

MVP `doc-canon` ships CLI + Cursor skills with language-agnostic inventory and structured `docs/canon/`. Next step toward production readiness needs a durable long-term map that:

1. Prioritizes **agent context efficiency** (tokens, progressive disclosure), starting with **canon skills**, then coding agents.
2. Defers product-hardening work without losing it.
3. Avoids premature AST/core complexity that the MVP canon explicitly marked Future.

External ideas (signature maps, dep graphs, schema extractors, git-diff context, progressive disclosure, BM25/RAG, delta patches, smart cache, Scout→Execute) need triage into phases rather than a single mega-feature.

## Goals

1. Record a phased long-term plan as **draft initiatives** agents and humans can refine later.
2. Keep living canon (`OVERVIEW`, `ARCHITECTURE`, `CLI`, `SKILLS`, …) as the SoT for **current** product behavior.
3. Prefer high-ROI efficiency work that stays language-agnostic before pluggable extractors.
4. Keep production hardening visible as a parallel/later track.

## Non-goals (this capture)

- Implementing CLI commands, skill rewrites, search, or extractors in this change
- Creating `docs/roadmap/` or `*-agent-tasks.md` decomposition yet
- Making `future_plans` **required** contract sections (they are optional / `required: false`)
- Git-diff–based incremental context (explicitly deferred out of P1)
- Deep multi-language AST in the CLI core

## Decisions

| Decision | Choice |
| --- | --- |
| Primary near-term focus | Context efficiency for agents; product maturity second |
| First consumer to optimize | Canon skills (`write` / `audit` / …), then coding agents |
| Artifact home | `docs/canon/future_plans/` (not `docs/roadmap/` yet) |
| Contract | Optional (`required: false`) sections + `FUTURE_PLAN` / `FUTURE_PLANS_INDEX` templates (orphans fail validate) |
| Roadmap | Separate later, after per-initiative brainstorming |
| After implementation | Initiative content absorbed into normal canon files; draft marked absorbed / removed |
| AST / signatures / graphs / schemas | P2 pluggable extractors; core stays language-agnostic |
| Git diff analyzer | Out of P1 for now |
| Delta/patch doc updates | Low priority; prefer whole-section edits + validate |
| Local search | Keyword/BM25-style in P1; embeddings/RAG not first iteration |

## Artifacts

| Path | Role |
| --- | --- |
| `docs/canon/future_plans/INDEX.md` | List of initiatives, order, status vocabulary |
| `docs/canon/future_plans/p0-skill-context-efficiency.md` | Draft initiative P0 |
| `docs/canon/future_plans/p1-retrieval-and-context-pack.md` | Draft initiative P1 |
| `docs/canon/future_plans/p2-pluggable-extractors.md` | Draft initiative P2 |
| `docs/canon/future_plans/p3-production-hardening.md` | Draft initiative P3 |
| Root `INDEX.md` / `OVERVIEW.md` | Pointers only; `future_plans` is not behavioral SoT |
| This spec | Rationale and triage; not the operational checklist |

Status values for initiatives: `draft` → `refining` → `implementing` → `absorbed`.

## Phases (summary)

### P0 — Skill context efficiency

Scout→Execute for canon skills; stronger progressive disclosure (INDEX → affected sections); hash-based smart cache over inventory/sections. No AST.

### P1 — Retrieval & context pack

Local keyword/BM25 search over canon; optional deterministic `doc-canon context` / pack for skills. **No** git-diff analyzer in this phase.

### P2 — Pluggable extractors

Optional signature / dependency / schema extractors behind contract or plugins; CLI core remains language-agnostic.

### P3 — Production hardening

npm publish & versioning, CI validate/check, schema migrate story, Claude Code pack, acceptance automation where useful. May run parallel once P0 direction is clear.

## Lifecycle

```text
future_plans (draft)
  → per-initiative brainstorming (refining)
  → later: roadmap / agent tasks
  → implementation
  → absorb into OVERVIEW / ARCHITECTURE / CLI / SKILLS / …
  → mark absorbed (or remove draft)
```

## External idea triage

| Idea | Placement |
| --- | --- |
| Progressive disclosure | P0 (strengthen) + P1 (retrieval) |
| Scout → Execute | P0 |
| Smart cache (hashes) | P0 |
| BM25 / local doc search | P1 |
| `context` / pack CLI | P1 |
| Git diff analyzer | Deferred (not P1) |
| Signature / AST stripping | P2 plugin |
| Dependency graph | P2 plugin |
| Schema extractor | P2 plugin |
| Delta / patch doc format | Deprioritized |
| Embeddings RAG | After keyword search proves insufficient |
| CI / publish / Claude pack | P3 |

## Next steps after this capture

1. User reviews this spec and `future_plans/` drafts.
2. Separate brainstorming session per initiative (start with P0).
3. Only then: implementation plans / roadmap decomposition.
4. Product-hardening (P3) can be refined in parallel without blocking P0.

## Related

- Living SoT: [`docs/canon/INDEX.md`](../../canon/INDEX.md)
- Drafts: [`docs/canon/future_plans/INDEX.md`](../../canon/future_plans/INDEX.md)
- MVP design: [`2026-08-07-doc-first-canon-design.md`](2026-08-07-doc-first-canon-design.md)
