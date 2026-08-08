# Glossary

## How to use

Use these terms consistently in canon prose, skill dialogue, and discrepancy entries. Prefer glossary wording over synonyms when naming the same concept.

## Terms

### Canon
The structured documentation tree under `docs/canon/` that is the source of truth for agent project context after bootstrap.

### SoT
Source of truth. For design/development context after successful bootstrap validate, SoT is exclusively `docs/canon/`.

### Contract
`CANON_CONTRACT.md`: human sections plus exactly one fenced YAML machine block that defines sections, templates, and policies for this repository only.

### Template
A registered markdown shape under `docs/canon/templates/` that required headings must satisfy. Extra headings are allowed.

### Inventory
Language-agnostic listing of repository paths (and glossary hits) produced by `doc-canon check` into `.doc-canon/inventory.json`.

### Finding
A machine-readable issue in `.doc-canon/report.json` with `source: cli` or `source: skill`. CLI check refreshes CLI findings and must preserve skill findings.

### Discrepancy
A human-tracked docs↔code (or related) conflict entry in `DISCREPANCIES.md` with lifecycle fields (`status`, `decision`, evidence, optional `coding_agent_prompt`).

### docs_stale
User decision that documentation is wrong; skill edits canon, validates, then may resolve the discrepancy in the same session.

### code_stale
User decision that application code is wrong; skill writes an Open coding task and does not edit application code. Resolved only on a later audit after code is fixed outside the skill.

### Extract-then-freeze
Non-empty bootstrap: inventory and legacy docs are import sources; agreed facts are written into canon templates; after validate, only `docs/canon/` is SoT.

### Managed assets
Skills, pointer rule, and `AGENTS.md` block copied/refreshed by `init` / `upgrade-skills` from the installed CLI package.

### skills_stamp
Version marker in the contract YAML recording which managed skills stamp was last applied; validate fails if skills are too old relative to CLI expectations.

## Naming conventions

- Section files use `UPPER_SNAKE` or clear `Title.md` paths registered in the contract (`OVERVIEW.md`, `CLI.md`, …).
- Discrepancy IDs: `D-NNN` assigned monotonically; never reuse.
- Finding IDs: `F-NNN` in reports.
- Skill names: `canon-<verb>` (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`).
- Prefer repo-relative paths in evidence fields.

## Related canon

- [OVERVIEW.md](OVERVIEW.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
