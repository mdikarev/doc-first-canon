# Future plans

Directional initiatives describing the **future shape** of the system. **Not** behavioral source of truth — living product rules stay in the root canon files (`OVERVIEW`, `ARCHITECTURE`, `CLI`, `SKILLS`, …). **Not** a development task tracker: do not store checklists, sprint plans, or `coding_agent_prompt`-style work items here — execution tracking (roadmap tasks, tickets, PRs) lives outside this folder, in whatever tool the project already uses.

## How to use

1. Capture an initiative directionally (`draft`), then refine one at a time in a dedicated brainstorming session (`draft` → `refining`).
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
| 0 | Skill context efficiency | refining | [p0-skill-context-efficiency.md](p0-skill-context-efficiency.md) |
| 0b | Smart cache | draft | [p0b-smart-cache.md](p0b-smart-cache.md) |
| 1 | Retrieval & context pack | draft | [p1-retrieval-and-context-pack.md](p1-retrieval-and-context-pack.md) |
| 2 | Pluggable extractors | draft | [p2-pluggable-extractors.md](p2-pluggable-extractors.md) |
| 3 | Production hardening | draft | [p3-production-hardening.md](p3-production-hardening.md) |

P0 is in active design refinement. P0b (cache) was split out of P0 for a later session. P3 may proceed in parallel once P0 direction is clear; it is listed last because efficiency is the near-term product focus.
