# doc-first-canon — Design Spec

**Date:** 2026-08-07  
**Status:** Approved for implementation planning  
**Approach:** Deterministic core (CLI) + agent layer (Cursor skills first)

## Problem

Development agents need durable project context. Ad-hoc docs drift from code, contradict each other, and diverge in structure when different LLMs edit them. Teams need a **canon**: rules for what documentation exists, how it is shaped, how it stays current, and how conflicts with reality are resolved with a human in the loop.

## Goals

1. Keep project documentation for agents accurate, consistent, and non-contradictory.
2. Treat documentation as the source of truth for agent context; when docs and code disagree, the user decides which is stale.
3. Edit documentation automatically (skills); never edit application code — emit detailed tasks for coding agents instead.
4. Make document structure stable across different LLMs via in-repo templates and a per-project contract.
5. Ship Cursor first; keep CLI/contract IDE-agnostic so Claude Code can be added later without breaking the core.

## Non-goals (MVP)

- IDE/plugin UI for Cursor or Claude Code
- Claude Code distribution pack (contract must not block it)
- Deep multi-language AST analysis as the primary audit engine
- Automatic application-code patches
- Plans/roadmaps as part of this product’s own canon workflow (this repo holds product design; target projects hold agent context docs)

## Architecture

Two layers:

| Layer | Responsibility |
|-------|----------------|
| **Deterministic core** (`doc-canon` CLI package) | Default contract, scaffold, structural validation, machine-readable reports. No LLM calls. |
| **Agent layer** (Cursor skills + thin rules) | Interview, semantic audit, doc authorship/refactor, conflict dialogue, discrepancy task writing. Must call CLI validate; must not bypass the contract. |

**Per-repo isolation:** On first run, the CLI writes a local contract into the target repository (default copied from the package). Agents may change only that project’s contract. Other repositories are unaffected. `schema_version` in the machine block enables future soft migrations.

**Boundary:** CLI does not invent prose. Skills do not invent required files, section types, or templates outside the contract.

```text
┌─────────────────────────────────────────┐
│ Cursor Agent (skills)                   │
│  bootstrap / audit / write / contract   │
└───────────────┬─────────────────────────┘
                │ validate / init / report
┌───────────────▼─────────────────────────┐
│ doc-canon CLI                           │
│  schema · structure · templates check   │
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│ Target repo: docs/canon/**              │
│  contract · templates · canon docs      │
│  DISCREPANCIES.md                       │
└─────────────────────────────────────────┘
```

## Canon layout

Everything under `docs/canon/` is the canon. Content outside that tree may be **import sources** during bootstrap, but is not the source of truth afterward.

### Mandatory top-level files

| File | Role |
|------|------|
| `INDEX.md` | Reading order and section catalog for agents |
| `OVERVIEW.md` | Product/project purpose and scope |
| `ARCHITECTURE.md` | Building blocks, flows, boundaries |
| `GLOSSARY.md` | Canonical terms and naming |
| `DISCREPANCIES.md` | Queue of divergence tasks (including coding-agent prompts) |
| `CANON_CONTRACT.md` | Human-readable contract + machine YAML block |
| `templates/` | In-repo templates that all LLMs must follow |

### Local contract: `CANON_CONTRACT.md`

- Markdown for humans/agents, plus **exactly one** fenced YAML machine block.
- That YAML block **must always be valid** against the CLI schema. Invalid or incomplete YAML fails `validate` and blocks audit/sync/write (except contract repair).
- After any agent edit to the contract, `doc-canon validate` is mandatory.
- Default contract is embedded in the CLI; `init` materializes it into the repo. Project-specific sections and policies live only in this file.

Machine block (conceptual shape):

```yaml
schema_version: 1
sections:
  - id: index
    path: INDEX.md
    role: index
    required: true
    template: INDEX
  # …
templates:
  - id: INDEX
    path: templates/INDEX.md
  # …
policies:
  max_lines: 400          # default bloat hint; overridable per section
  ignore: []              # globs excluded from structural expectations
```

Exact field set is finalized in implementation; the invariant is: **parseable, schema-valid, and the single source of structural truth for the repo.**

## Templates (structured level B)

Templates enforce the same heading structure across LLMs. Creating a canon file without a registered template is forbidden.

### Strictness

**Structured (B):** fixed H2 (and agreed H3 where noted) plus HTML/comment guidance in the template for what to write. `validate` checks required headings exist.

### Mandatory templates

**`INDEX.md`**
- `# Canon Index`
- `## How to use this canon`
- `## Reading order`
- `## Sections` (table: id \| path \| role \| required)
- `## Discrepancies`

**`OVERVIEW.md`**
- `# Overview`
- `## Purpose`
- `## Problem & context`
- `## Primary users / agents`
- `## Scope` → `### In scope` → `### Out of scope`
- `## Success signals`
- `## Related canon`

**`ARCHITECTURE.md`**
- `# Architecture`
- `## Summary`
- `## System context`
- `## Building blocks`
- `## Key flows`
- `## Boundaries & non-responsibilities`
- `## Tech & constraints`
- `## Related canon`

**`GLOSSARY.md`**
- `# Glossary`
- `## How to use`
- `## Terms` (entries as `### Term`)
- `## Naming conventions`
- `## Related canon`

**`DISCREPANCIES.md`**
- `# Discrepancies`
- `## How to use`
- `## Open`
- `## Resolved`
- `## Template for new entries`

Each open/resolved entry uses:

```markdown
### D-001: <short title>
- **status:** open | resolved
- **decision:** pending | docs_stale | code_stale
- **canon_paths:** …
- **code_paths:** …
- **evidence:** …
- **coding_agent_prompt:** |
  What to study; what diverges; questions the coding agent must clarify with the user.
```

**`CANON_CONTRACT.md`**
- `# Canon Contract`
- `## Purpose`
- `## How agents must use this file`
- `## Machine contract` (fenced YAML)
- `## Change policy`

### Extensible section templates

- **Base + kinds:** every custom file at least satisfies `SECTION`; specialized kinds add required headings.
- **Default kinds shipped in CLI `init`:** `SECTION`, `ENTITY`, `MODULE`, `DOMAIN_TOPIC`.
- **New kind workflow:** interview → agree headings with user → save under `docs/canon/templates/` → register in `CANON_CONTRACT.md` → `validate` → create document from template.
- Project-specific kinds (e.g. design, gameplay) do not affect other repos.

**`SECTION.md` (base)**
- `# <Title>`
- `## Purpose`
- `## Scope`
- `## Current state`
- `## Rules & invariants`
- `## Key details`
- `## Open questions`
- `## Related canon`

**`ENTITY.md`**
- `# <Entity>`
- `## Purpose`
- `## Scope`
- `## Current state`
- `## Identity & fields`
- `## Lifecycle`
- `## Invariants`
- `## Relations`
- `## Open questions`
- `## Related canon`

**`MODULE.md`**
- `# <Module>`
- `## Purpose`
- `## Scope`
- `## Current state`
- `## Responsibilities`
- `## Interfaces`
- `## Dependencies`
- `## Invariants`
- `## Open questions`
- `## Related canon`

**`DOMAIN_TOPIC.md`**
- `# <Topic>`
- `## Purpose`
- `## Scope`
- `## Current state`
- `## Concepts`
- `## Rules & invariants`
- `## Key details`
- `## Open questions`
- `## Related canon`

## Truth model and conflict resolution

- Documentation is the **intended source of truth** for agent context.
- Disagreement with code is not auto-resolved in favor of either side.
- User must confirm whether **docs** or **code** are stale.
- **Primary UX:** agent chat dialogue with evidence; CLI can detect/report and accept flags when no agent is present.
- If **docs** are stale → skill updates the canon, then `validate`.
- If **code** is stale → skill does **not** modify application code; it appends a task to `DISCREPANCIES.md` with: what to study, what diverges, evidence paths, and instruction that the coding agent must clarify non-obvious cases with the user.
- `DISCREPANCIES.md` is mandatory and part of the canon.

## Flows

### 1. Bootstrap (`init` + interview skill)

1. CLI scaffolds `docs/canon/`, default templates, and `CANON_CONTRACT.md`.
2. Skill detects empty vs existing code/docs.
3. For non-empty projects: analyze code and existing documentation; propose extra sections for the domain.
4. Interview user → update local contract (valid YAML) → `validate` → generate mandatory + agreed sections from templates → refresh `INDEX.md`.

### 2. Structural validate (CLI)

Checks: YAML machine block parses and matches schema; required files exist; index agrees with contract; template heading requirements; size/bloat hints; basic in-canon links.

### 3. Semantic audit (skill + CLI report)

Skill finds doc↔code and doc↔doc semantic issues. CLI persists/prints machine-readable findings. No silent auto-resolve.

### 4. Resolve

User chooses docs vs code (chat or CLI flags). Outcomes as in Truth model. Tasks move Open → Resolved when done; canon updated if needed.

### 5. Structure evolution

On bloat or new topic: interview → change contract + templates → split/add files → update index → `validate`.

### 6. Everyday sync

After meaningful changes: skill identifies affected sections → updates canon per templates → `validate` → open resolve flow if unresolved factual conflicts remain.

## Components and distribution

### Package install (chosen model)

- **`doc-canon` installed as a package** (global or local).
- Target repo keeps: `docs/canon/**`, thin Cursor rules/skills, optional `.doc-canon/report.json` (may be gitignored).

### CLI commands (MVP)

| Command | Behavior |
|---------|----------|
| `doc-canon init` | Scaffold canon + default contract + templates |
| `doc-canon validate` | Structural + schema + template heading checks |
| `doc-canon check` | validate + emit structural findings |
| `doc-canon report` | Print last machine-readable report |

### Cursor skills (MVP)

1. `canon-bootstrap` — first run, interview, import
2. `canon-audit` — semantic audit + resolve dialogue
3. `canon-write` — author/refactor canon, splits
4. `canon-contract` — change contract/templates with mandatory validate

### Report artifact

Optional `.doc-canon/report.json` with findings: `id`, `kind` (`structure` \| `consistency` \| `drift` \| `conflict`), `paths`, `summary`, `status`.

## Error handling

| Condition | Behavior |
|-----------|----------|
| Invalid/missing YAML machine block | Fail validate; block audit/sync/write except contract repair |
| Missing required file or template headings | Structural failure |
| File/section type without registered template | Forbidden until interview + registration |
| Doc↔code conflict undecided | Finding remains open; no silent pick |
| Code confirmed stale | Task in `DISCREPANCIES.md` only; no code edits by this system |

## Testing (MVP)

- CLI fixture repos: happy `init`/`validate`; broken YAML; missing section; missing headings; index≠contract; unknown template id.
- Template fixtures for mandatory set + `SECTION` / `ENTITY` / `MODULE` / `DOMAIN_TOPIC`.
- Skill flows documented as acceptance scenarios (bootstrap non-empty project; resolve docs vs code; add new template kind). Automated skill tests are out of MVP scope.

## Success criteria

1. After bootstrap, a project has a valid canon and local contract.
2. Different LLMs produce the same document shapes via in-repo templates.
3. `validate` catches broken contracts and template drift.
4. Conflicts require user decision; docs are skill-edited; code work is only tasked via `DISCREPANCIES.md`.
5. Extending one project’s structure never changes another project’s defaults.

## Future (explicitly later)

- Claude Code skill/rule pack consuming the same CLI contract
- Stronger code-aware analyzers (language-specific)
- Optional IDE plugin UX
- CI gate using `doc-canon validate` / `check`

## Open implementation choices (for planning, not product ambiguity)

- Concrete package ecosystem (e.g. npm vs other) for distributing `doc-canon`
- Exact YAML schema field names and report JSON schema
- Default numeric thresholds for bloat (`max_lines` etc.)
