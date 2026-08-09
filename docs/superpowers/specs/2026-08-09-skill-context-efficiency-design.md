# Skill context efficiency (P0) — Design Spec

**Date:** 2026-08-09  
**Status:** Synced with refined P0; ready for implementation planning  
**Approach:** Recipe-first dual-audience pattern; skill + canon + pointer guidance; no new CLI; smart cache split to a separate initiative

## Problem

Canon maintenance and project agents that rely on `docs/canon/` often load too much context (or invent structure) instead of discovering a small working set first. Progressive disclosure is mentioned (start at `INDEX.md`) but skills do not separate **Scout → Expand → Execute**, so thrift and reliability are accidental. Meanwhile the product goal of doc-canon is efficient context for **any** agent using the canon—not only internal maintenance skills.

## Goals

1. Define one **dual-audience** recipe: Progressive disclosure → Scout → Expand gate → Execute.
2. Encode the invariant **quality over thrift**: when the working set is doubtful, expand; never silently under-read or invent facts to save tokens.
3. Implement explicit phases in `canon-write` and `canon-audit`.
4. Teach the same reading discipline to project/coding agents via pointer rule / `AGENTS.md` (no pack, no new skill, no mandatory expand-gate chatter).
5. Document the recipe in living canon (`SKILLS.md`, glossary, light `ARCHITECTURE` note); keep `future_plans/p0-skill-context-efficiency.md` as the directional SoT until absorption.
6. Keep **smart cache** in its own draft initiative (P0b) for a later brainstorming session.

## Non-goals

- New CLI commands or scout helpers (use existing `validate` / `check` / `report` + INDEX)
- Content hashes / smart cache artifacts (separate initiative)
- BM25 / `doc-canon context` packs (P1)
- AST / pluggable extractors (P2)
- Changing the rule that canon skills never patch application code
- Measuring token savings numerically in this phase
- Requiring coding agents to invoke canon skills
- Mandatory chat ritual of working-set/verdict for coding agents

## Decisions

| Topic | Choice |
| --- | --- |
| Success priority | Reliability first, then cheapness—without harming task quality |
| Expand behavior | Explicit expand gate before Execute |
| Expand visibility | Managed skills briefly show working set + verdict in chat; coding agents follow the discipline without mandatory chatter |
| Scout output | Paths + role + short stub (why-in-set); free-form brevity; not section digests; no rigid one-line template |
| Clarify vs Scout (`canon-write`) | Scout → Expand first; clarify-before-invent only if invent-risk remains before substantial write |
| Skill implementation | Full phases in `canon-write` and `canon-audit` |
| Shared recipe | Documented in canon for all agents; bootstrap/contract get a short note only |
| Coding agents | Same recipe via pointer / `AGENTS`; no pack in P0 |
| CLI | No new commands |
| Smart cache | P0b draft; out of P0 delivery |

## Shared recipe

### Step 0 — Progressive disclosure

1. Always start at root `docs/canon/INDEX.md`.
2. Select only INDEX rows/ids relevant to the task.
3. Do not preload the entire canon. Load `CANON_CONTRACT.md` / templates only when the task needs structure, a new kind, or a write template.

### Step 1 — Scout

Produce a **working-set manifest**, not file bodies:

- `path`
- `role` (`index` | `section` | `template` | `inventory` | `report` | `code_evidence` | `discrepancy` | …)
- `stub` — short why-in-set note (from INDEX role, finding kind, or user intent—not a content digest); free-form brevity

Typical maintenance minimum: INDEX; often contract; affected section paths; for audit/code sync, fresh inventory/report via existing `doc-canon check`; templates only for sections that will be written.

Scout must not invent structure or deep-read “just in case.”

### Step 2 — Expand gate

Before full reads, form:

- current working set (paths + stubs)
- verdict: **sufficient** / **need more** (+ which paths and why)

Rules: doubt → expand; no silent under-read; expanding is encouraged when quality needs it; may expand multiple times.

**Visibility:** `canon-write` / `canon-audit` briefly show the set and verdict in chat (free-form). Coding agents apply the same gate internally; pointer/`AGENTS` teach the habit without requiring a visible ritual every turn.

### Step 3 — Execute

Only after “sufficient”: targeted full reads → normal skill/task work → `doc-canon validate` after canon edits.

For substantial SoT writes in `canon-write`: if invent-risk remains after Expand, run clarify-before-invent (existing MCQ rules) **before** writing—not before Scout.

## Audience specializations

### `canon-write`

Scout → Expand → Execute. Prefer expand (or later clarify) over reading the whole canon when “affected sections” are unclear. Clarify-before-invent runs after Expand when invent-risk remains before substantial writes. `check`/inventory only when syncing against the tree/code. Show a brief working set + verdict before deep reads.

### `canon-audit`

`validate` first (structure repair if needed). `check` for inventory/report as Scout inputs. Scout INDEX, contract, findings, evidence path candidates. Expand until claims are evidence-backed; show brief working set + verdict before deep reads. Execute semantic pass, report merge, resolve dialogue. Broader than write, still not “every markdown file.”

### Project / coding agents

Pointer rule and managed `AGENTS.md` block: start at INDEX; build a small working set; expand if unsure; then deep-read; on docs↔code conflict escalate (do not silently pick a side). Same mental model; no maintenance skill required; no mandatory expand-gate chatter.

### `canon-bootstrap` / `canon-contract` (P0 note only)

Bootstrap may legitimately need a wide inventory/import pass—do not force an artificially tiny set. Contract work is naturally narrow (contract + templates + INDEX); full phased text can wait for a follow-up once write/audit patterns stabilize.

## Absorption (after implementation)

| Artifact | Change |
| --- | --- |
| `docs/canon/SKILLS.md` | Dual-audience recipe, quality invariant, write/audit phase responsibilities |
| `embedded/skills/canon-write/SKILL.md` | Scout → Expand → [clarify if needed] → Execute |
| `embedded/skills/canon-audit/SKILL.md` | Same phases wired to validate/check; visible expand gate |
| Pointer rule + `AGENTS.md` managed block | Progressive disclosure + working-set + expand discipline (guidance only) |
| `docs/canon/GLOSSARY.md` | Working set, Scout, Expand gate |
| `docs/canon/ARCHITECTURE.md` | Short agent-layer note (no new CLI block) |
| `docs/canon/future_plans/p0-…` | Stay `refining` until implementation starts; later `absorbed` |
| `future_plans/p0b-smart-cache.md` | Already drafted; out of this delivery |
| `docs/acceptance/skill-scenarios.md` | Human-run checks: write/audit show working set + expand before deep reads; pointer/AGENTS mention the reading discipline |
| `CLI.md` | Unchanged (no new commands) |

## Testing / acceptance

- Automated skill execution remains out of MVP scope.
- Add human-run acceptance scenarios: write and audit show working set + expand verdict before deep reads; pointer/AGENTS mention the reading discipline (not a chat-output requirement for coding agents).
- Legitimate expand is not a failure. Token metrics are not a gate.

## Relationship to other initiatives

- **P1 (retrieval & context pack):** builds on this recipe; adds search/pack for larger canons and richer coding-agent packs.
- **P0b (smart cache):** hashes / skip re-analysis; brainstorm separately.
- **P2 / P3:** unchanged dependencies relative to this design.

## Files touched when implementing (preview)

- Skill bodies under `embedded/skills/` (write, audit) + upgrade path mirrors
- Living canon sections listed above
- Managed pointer rule / AGENTS embedded assets
- Acceptance scenarios
- Future-plans index/status when absorbing
