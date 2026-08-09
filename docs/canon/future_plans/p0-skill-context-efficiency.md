# P0 — Skill context efficiency

- **Status:** refining
- **Focus:** Reduce tokens and noise while agents use `docs/canon/`, without harming solution quality—starting with canon skills, with the same reading discipline for project agents.
- **Depends on:** MVP CLI + skills (current)
- **Unblocks:** Cheaper everyday sync; shared progressive-disclosure habit for coding agents; cleaner base for P1 packs and P0b cache
- **Design:** [`docs/superpowers/specs/2026-08-09-skill-context-efficiency-design.md`](../../superpowers/specs/2026-08-09-skill-context-efficiency-design.md)

## Intent

Make canon use cheaper and more reliable **without** language-specific AST and **without** sacrificing task quality. Agents should discover a small working set first, confirm it is enough, then deep-read and act—instead of loading the whole tree or inventing structure.

This initiative is **dual-audience**: the same mental model serves (1) managed canon skills that maintain the SoT and (2) coding/project agents that consume the canon to ship product work. Pack/search stay in P1; hash cache is a separate initiative (P0b).

## Quality invariant

**Quality over thrift.** A smaller context window is a default, never a hard cap that forces under-reading or invented facts. If the working set is doubtful, the agent must expand.

## Shared recipe (future shape)

### 0 — Progressive disclosure

Start at root `docs/canon/INDEX.md`. Select only relevant INDEX rows. Do not preload the entire canon. Open contract/templates only when structure, a new kind, or a write template is needed.

### 1 — Scout

Build a **working-set manifest** (not file bodies):

| Field | Meaning |
| --- | --- |
| `path` | File or artifact path |
| `role` | e.g. index, section, template, inventory, report, code_evidence, discrepancy |
| `stub` | One-line why-in-set (from INDEX role, finding kind, or user intent—not a content digest) |

Use existing CLI artifacts where needed (`doc-canon check` → inventory/report). No new Scout CLI in this initiative.

### 2 — Expand gate

Before full reads, briefly state the working set and a verdict: **sufficient** or **need more** (which paths, why). Doubt → expand. Multiple expands are fine. Silent under-read is not.

### 3 — Execute

Targeted full reads of the approved set, then normal work (write/audit/coding). After canon edits, `doc-canon validate` before claiming success. Substantial writes still use the existing clarify-before-invent gate.

## How audiences specialize

| Audience | Shape in this initiative |
| --- | --- |
| `canon-write` | Full Scout → Expand → Execute; clarify gate unchanged; inventory only when syncing vs code/tree |
| `canon-audit` | Full phases; `validate` then `check` as Scout inputs; expand until claims are evidence-backed |
| Project / coding agents | Same recipe via pointer rule / `AGENTS.md`; no pack and no requirement to run canon skills |
| `canon-bootstrap` | Note only: wide inventory/import pass remains legitimate; do not force an artificially tiny set |
| `canon-contract` | Note only: naturally narrow set (contract + templates + INDEX) |

## In scope

- Shared dual-audience recipe in living canon (`SKILLS.md`, glossary, light architecture note)
- Explicit phases in `canon-write` and `canon-audit` skill bodies
- Stronger progressive-disclosure guidance in pointer rule / managed `AGENTS.md`
- Acceptance scenarios for working set + expand before deep reads
- Split smart-cache ideas into [P0b](p0b-smart-cache.md)

## Out of scope

- Smart cache / content hashes ([P0b](p0b-smart-cache.md))
- Deep AST, dependency graphs, schema extractors (P2)
- Git-diff–driven context packs; BM25 / `context` pack CLI (P1)
- Embeddings / RAG
- New CLI scout helpers
- Changing the rule that canon skills never patch application code

## Absorbs into

Likely: `SKILLS.md`, `GLOSSARY.md`, light touch on `ARCHITECTURE.md`, skill bodies under `embedded/skills/` (`canon-write`, `canon-audit`), pointer rule / `AGENTS.md` managed block, acceptance skill scenarios. Not `CLI.md` (no new commands).

## Open questions

- Exact stub wording conventions in skill text (how verbose is “brief” for the expand verdict in chat)
- Whether bootstrap later gets explicit phased text in a follow-up once P0 write/audit patterns stabilize
