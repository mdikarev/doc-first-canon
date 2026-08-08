# Skills

## Purpose

Own the agent layer: interview, extract-then-freeze bootstrap, canon authorship, semantic audit, contract evolution, and discrepancy dialogue — always through the local contract and CLI validation.

## Scope

**Covers:** managed Cursor skills `canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`; guidance in the pointer rule and `AGENTS.md` managed block.

**Excludes:** inventing required files/section types/templates outside the contract; editing application code; replacing CLI structural validation.

## Current state

Four skills ship in `embedded/skills/` and are copied into target repos on `init` / `upgrade-skills`. Acceptance scenarios live in `docs/acceptance/skill-scenarios.md` (import source; not SoT). Automated skill execution tests are out of MVP scope.

## Responsibilities

| Skill | Responsibility |
| --- | --- |
| `canon-bootstrap` | First run; empty interview or non-empty extract-then-freeze; fill mandatory (+ agreed) sections; validate |
| `canon-write` | Author/refactor canon prose and everyday sync of affected sections |
| `canon-audit` | Semantic audit vs inventory; resolve dialogue; discrepancy lifecycle; mark unconfirmed skill findings stale |
| `canon-contract` | Propose contract/template diffs; write only after explicit user confirmation; validate |

Pointer rule: always-on context priority — start at `docs/canon/INDEX.md`; escalate docs↔code divergence; do not silently pick a side.

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
- Always `doc-canon validate` before claiming success on canon edits
- `check` does not close discrepancies; only audit applies the lifecycle when appropriate

## Open questions

- Timing and packaging for Claude Code distribution remain Future.

## Related canon

- [CLI.md](CLI.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
- [GLOSSARY.md](GLOSSARY.md)
