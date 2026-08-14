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
| 2 | Pluggable extractors | draft | [p2-pluggable-extractors.md](p2-pluggable-extractors.md) |
| 3 | Production hardening | implementing | [p3-production-hardening.md](p3-production-hardening.md) |

P0, P0c, P0b, and P1 are absorbed. P2 (pluggable extractors) remains draft; P3 is `implementing` for the adopter-ready first public release checkpoint (Claude dual-write already shipped).
