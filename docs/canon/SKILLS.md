# Skills

## Purpose

Own the agent layer: interview, extract-then-freeze bootstrap, canon authorship, semantic audit, contract evolution, and discrepancy dialogue — always through the local contract and CLI validation.

## Scope

**Covers:** managed Cursor skills `canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`; guidance in the pointer rule and `AGENTS.md` managed block.

**Excludes:** inventing required files/section types/templates outside the contract; editing application code; replacing CLI structural validation.

## Current state

Four skills ship in `embedded/skills/` and are copied into target repos on `init` / `upgrade-skills`. Acceptance scenarios live in `docs/acceptance/skill-scenarios.md` (import source; not SoT). Automated skill execution tests are out of MVP scope.

Agents that use the canon follow a shared dual-audience recipe: progressive disclosure from `INDEX.md` → Scout a working-set manifest → Expand gate (`sufficient` / `need more`) → Execute with targeted deep reads. **Quality over thrift:** expand when doubtful; never silently under-read or invent facts to save tokens.

## Responsibilities

| Skill | Responsibility |
| --- | --- |
| `canon-bootstrap` | First run; empty interview or non-empty extract-then-freeze; fill mandatory (+ agreed) sections including required `future_plans/INDEX.md`; validate |
| `canon-write` | Author/refactor canon prose and everyday sync of affected sections; Scout → Expand (show working set + verdict) before deep reads; after Expand, clarify when invent-risk remains (one question at a time, A/B/C options, recommended answer, max 3) or skip when the request is already unambiguous; inventory/`check` only when syncing vs code/tree; when writing `future_plans/**`, keep initiatives directional (not a task list) and follow the draft → refining → implementing → absorbed lifecycle |
| `canon-audit` | Semantic audit vs inventory; Scout → Expand with visible working set + verdict before deep evidence reads (`validate` then `check` as Scout inputs); resolve dialogue; discrepancy lifecycle; mark unconfirmed skill findings stale |
| `canon-contract` | Propose contract/template diffs; write only after explicit user confirmation; validate |

Pointer rule / `AGENTS.md`: always-on context priority — start at `docs/canon/INDEX.md`; build a small working set and expand if unsure before deep reads (no mandatory chat ritual); escalate docs↔code divergence; do not silently pick a side.

`canon-bootstrap` may legitimately use a wide inventory/import pass—do not force an artificially tiny working set. `canon-contract` work is naturally narrow (contract + templates + INDEX); full phased skill text for those two can wait until write/audit patterns stabilize.

## Interfaces

- **Inputs:** user intent, inventory/report, existing canon and templates, legacy docs as import sources during bootstrap only
- **Outputs:** edits under `docs/canon/**`; discrepancy entries; skill findings in `.doc-canon/report.json`
- **Subprocess:** must invoke `doc-canon`; if missing on PATH, hard-fail with install hint (`npm install -g doc-canon` or local link/`npx`)

## Dependencies

- Installed `doc-canon` CLI on PATH
- Local `CANON_CONTRACT.md` and templates
- Cursor (MVP); Claude Code packaging deferred

## Invariants

- Never patch application code; `code_stale` → Open coding task only
- Never bypass contract for new section kinds
- `future_plans/**` holds directional initiatives only; never convert it into a task tracker, checklist, or coding-agent prompt list — execution work belongs in `DISCREPANCIES.md` / project task tools
- Always `doc-canon validate` before claiming success on canon edits
- `canon-write` must not invent material facts for substantial edits: clarify (MCQ + recommendation) or skip only when the request already resolves ambiguity
- `check` does not close discrepancies; only audit applies the lifecycle when appropriate

## Open questions

- Timing and packaging for Claude Code distribution remain Future.

## Related canon

- [CLI.md](CLI.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
- [GLOSSARY.md](GLOSSARY.md)
