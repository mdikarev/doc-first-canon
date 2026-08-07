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
6. Ensure all agents in a target repo treat `docs/canon/` as the context source of truth for design and development (via managed pointer rules / AGENTS block).

## Non-goals (MVP)

- IDE/plugin UI for Cursor or Claude Code
- Claude Code distribution pack (contract must not block it; `init` overlay can grow later)
- Deep multi-language AST analysis as the primary audit engine (inventory is language-agnostic; AST is Future)
- Automatic application-code patches
- Plans/roadmaps as part of this product’s own canon workflow (this repo holds product design; target projects hold agent context docs)
- Multiple canons per monorepo (single root `docs/canon/` only)
- Git hooks or CI as the everyday sync trigger (CI gate is Future; sync is human-invoked in MVP)

## Architecture

Two layers:

| Layer | Responsibility |
|-------|----------------|
| **Deterministic core** (`doc-canon` CLI package) | Default contract, scaffold, structural validation, language-agnostic inventory, machine-readable reports. No LLM calls. |
| **Agent layer** (Cursor skills + thin rules) | Interview, semantic audit against inventory, doc authorship/refactor, conflict dialogue, discrepancy task writing. Must call CLI validate; must not bypass the contract. |

**Per-repo isolation:** On first run, the CLI writes a local contract into the target repository (default copied from the package). Agents may change only that project’s contract. Other repositories are unaffected.

**`schema_version` policy:** Unknown or incompatible major → `validate` **fails closed** with upgrade/migrate guidance. Same major with newer optional fields → warn and ignore unknowns (soft forward-compat). No auto-migrate of YAML in MVP.

**Boundary:** CLI does not invent prose. Skills do not invent required files, section types, or templates outside the contract.

```text
┌─────────────────────────────────────────┐
│ Cursor Agent (skills + pointer rule)    │
│  bootstrap / audit / write / contract   │
└───────────────┬─────────────────────────┘
                │ init / validate / check / report
                │ upgrade-skills / inventory
┌───────────────▼─────────────────────────┐
│ doc-canon CLI                           │
│  schema · structure · inventory         │
│  templates check · report merge (struct)│
└───────────────┬─────────────────────────┘
                │
┌───────────────▼─────────────────────────┐
│ Target repo                             │
│  docs/canon/** (SoT)                    │
│  .cursor/skills + pointer rule          │
│  AGENTS.md managed block (optional)     │
│  .doc-canon/report.json + inventory.json│
└─────────────────────────────────────────┘
```

## Canon layout

Everything under `docs/canon/` is the canon. Content outside that tree may be **import sources** during bootstrap, but is **not** the source of truth afterward.

**Monorepo:** one `docs/canon/` at the repository root for MVP.

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
- Contract changes via `canon-contract` require **explicit user confirmation** of the intended diff before write.
- Default contract is embedded in the CLI; `init` materializes it into the repo. Project-specific sections and policies live only in this file.

Machine block (conceptual shape):

```yaml
schema_version: 1
cli_compat: "…"          # min CLI / skills stamp expectations
skills_stamp: "…"        # version of skills last copied by init/upgrade-skills
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
  ignore: []              # globs excluded from inventory and structural expectations
```

Exact field set is finalized in implementation; the invariant is: **parseable, schema-valid, and the single source of structural truth for the repo.**

## Templates (structured level B)

Templates enforce the same heading structure across LLMs. Creating a canon file without a registered template is forbidden.

### Strictness

**Structured (B):** fixed H2 (and agreed H3 where noted) plus HTML/comment guidance in the template for what to write.

**Heading policy (required-only):** `validate` fails if any required template headings are missing. **Extra headings are allowed**; excess size may produce bloat **warnings**, not structural failure. (Exact-set heading enforcement is out of MVP.)

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
- **finding_ids:** …          # optional links to report findings
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

- Documentation under `docs/canon/` is the **source of truth for agent context**.
- Disagreement with code is not auto-resolved in favor of either side.
- User must confirm whether **docs** or **code** are stale.
- **Primary UX:** agent chat dialogue with evidence; CLI can detect/report and accept flags when no agent is present.
- If **docs** are stale → skill updates the canon, then `validate`.
- If **code** is stale → skill does **not** modify application code; it appends/updates a task in `DISCREPANCIES.md` with: what to study, what diverges, evidence paths, and instruction that the coding agent must clarify non-obvious cases with the user.
- Coding agents still **must consult the canon** (pointer rule); they implement code changes from discrepancies / normal work, not via canon-skills.
- `DISCREPANCIES.md` is mandatory and part of the canon.

### Discrepancy lifecycle

| Stage | Who | Rule |
|-------|-----|------|
| Finding in report (`open`) | CLI (`check`) or `canon-audit` | Detected; not yet a user decision |
| `DISCREPANCIES` **Open** (`decision: pending` or decided) | Audit skill after resolve dialogue (or explicit “record this conflict”) | Waiting on or recording docs vs code |
| Open + `docs_stale` | User decision | Skill edits canon → `validate` |
| Open + `code_stale` | User decision | Task + `coding_agent_prompt` only; no app-code edits by canon system |
| **Resolved** | Same session after successful fix, **or** next `canon-audit` / `check` | Move Open → Resolved when the conflict condition no longer reproduces (docs fixed + validate ok, or code aligned and audit no longer sees the drift). No separate mandatory “close” click if the next check clears it |

**IDs:** `D-NNN` assigned monotonically from the max existing id in the file; never reuse.  
**Dedup:** before creating a new Open entry, search open entries with overlapping `canon_paths` / `code_paths`; update evidence instead of cloning.  
**Links:** report findings may carry `discrepancy_id`; entries may list `finding_ids`.

## Inventory and semantic audit

### Inventory (CLI, no AST)

`doc-canon check` (and audit precondition) builds a **language-agnostic inventory** of the target repo, respecting `policies.ignore` plus default excludes (e.g. `.git`, `node_modules`, `dist`, `build`, `.doc-canon`):

- path tree (dirs/files)
- basename / path tokens for matching names claimed in canon
- optional grep-level text hits for glossary terms

Written to `.doc-canon/inventory.json` (may be gitignored). Semantic audit must use a fresh or explicitly current inventory; it does not rely on model memory of the tree.

### Semantic pass (skill + inventory)

`canon-audit` flow:

1. `doc-canon validate` — on failure, only structure/contract repair (no semantic pass).
2. Refresh/read inventory via `check` (or equivalent).
3. Skill compares canon to inventory and selective file reads. Every finding must cite inventory paths and/or canon quotes.
4. Skill **merges** semantic findings into `.doc-canon/report.json` (`source: skill`). CLI structural findings use `source: cli`.

**MVP checks:**

1. **Coverage** — every required contract path exists and appears in INDEX.
2. **Orphans** — files under `docs/canon/**` (except `templates/`) missing from contract/INDEX → finding.
3. **Glossary** — each Terms H3 either has inventory/text hits or is explicitly evidenced as doc-only/aspirational; otherwise `drift` candidate.
4. **Architecture claims** — building-block / module names vs inventory paths; no match → `conflict` candidate.
5. **In-canon links** — relative links and Related canon targets resolve; broken → consistency/structure finding.
6. **Doc↔doc** — escalate only with two or more cited passages + paths.

**Anti-noise:**

- Do not open a conflict without `canon_paths` and `code_paths` (or explicit “code missing”) plus short evidence.
- Deduplicate by normalized `(kind, canon_paths, code_paths)`.
- Honor ignore globs and default excludes.
- Never silently auto-resolve semantic findings.

Deep language-specific AST analyzers remain Future.

## Flows

### 1. Bootstrap (`init` + interview skill)

1. CLI scaffolds `docs/canon/`, default templates, `CANON_CONTRACT.md`, Cursor skills, pointer rule, and AGENTS managed block (per Distribution).
2. Skill detects empty vs non-empty project.
3. **Empty:** short interview (purpose/scope) → mandatory files from templates → `validate` → INDEX.
4. **Non-empty (extract-then-freeze):** build inventory; read existing docs (`README`, `docs/**`, `AGENTS.md`, etc.) as **import sources only**; propose extra sections; interview → update contract → `validate` → generate mandatory + agreed sections from templates (content extracted into canon) → refresh INDEX. Record import provenance in Related/OVERVIEW where useful.
5. After successful validate, **only `docs/canon/` is SoT**. Legacy files are not deleted or auto-edited; INDEX may note “legacy outside canon.” README↔code conflicts go through resolve, not silent merge.

### 2. Structural validate (CLI)

`doc-canon validate`: schema-valid YAML; `schema_version` compat (fail closed on breaking); required files; INDEX↔contract agreement; required template headings (extra headings allowed); skills stamp vs CLI minimum (fail if skills too old); size/bloat **hints**; basic in-canon link checks as implemented. Does **not** have to write `report.json`.

### 3. Check + semantic audit

- `doc-canon check` = validate + refresh inventory + write/update **structural** findings in `.doc-canon/report.json`.
- `canon-audit` runs semantic pass (above), merge findings, then resolve dialogue. No silent auto-resolve.

### 4. Resolve

User chooses docs vs code (chat or CLI flags). Outcomes per Truth model and Discrepancy lifecycle.

### 5. Structure evolution

On bloat or new topic: interview → user confirms contract/template diff → change contract + templates → split/add files → update index → `validate`.

### 6. Everyday sync (human-invoked)

MVP trigger is **manual**: user or agent session invokes `canon-write` / `canon-audit` after meaningful changes. Pointer/skill guidance: if the session changed code or canon, **offer** sync. No git hooks required in MVP. Flow: identify affected sections → update canon per templates → `validate` → resolve if factual conflicts remain.

## Components and distribution

### Package install (chosen model)

- **`doc-canon` installed as a package** (global or local/devDependency).
- **`init` copies** into the target repo: `docs/canon/**` (default contract + templates), Cursor skills (`canon-bootstrap`, `canon-audit`, `canon-write`, `canon-contract`), managed pointer rule, and AGENTS managed block.
- **`doc-canon upgrade-skills`** (or `init --force-skills`) refreshes managed skills/rules/AGENTS block from the installed CLI **without** wiping canon document content. Manual edits to managed skill/rule files may be overwritten on upgrade (documented).
- On existing canon, `init` does not overwrite canon content; skills/rules update only with explicit flag/confirm.
- Target repo may gitignore `.doc-canon/report.json` and `inventory.json`.
- Skills **must** invoke the CLI; if `doc-canon` is missing from PATH, fail with an install hint.

### CLI commands (MVP)

| Command | Behavior |
|---------|----------|
| `doc-canon init` | Scaffold canon + contract + templates + skills + pointer rule + AGENTS block |
| `doc-canon upgrade-skills` | Refresh managed skills/rules/AGENTS block from current package |
| `doc-canon validate` | Schema + structure + required headings; exit ≠0 on failure; need not write report |
| `doc-canon check` | validate + inventory refresh + structural findings → `.doc-canon/report.json` |
| `doc-canon report` | Print last machine-readable report (read-only) |

### Cursor skills (MVP)

1. `canon-bootstrap` — first run, interview, import (extract-then-freeze)
2. `canon-audit` — semantic audit + resolve dialogue + discrepancy updates
3. `canon-write` — author/refactor canon, splits, everyday sync
4. `canon-contract` — change contract/templates with user confirm + mandatory validate

### Pointer rule and AGENTS.md

On `init` / `upgrade-skills`, CLI creates or updates:

1. **Managed Cursor rule** (e.g. `.cursor/rules/doc-canon.mdc`) — always-on for agents in the repo.
2. **Managed block in `AGENTS.md`** delimited by `<!-- doc-canon:start -->` … `<!-- doc-canon:end -->`. If `AGENTS.md` is missing: create a minimal file with that block (confirm first on non-empty repos). Never replace the entire existing `AGENTS.md` outside the managed markers.

**Rule substance:**

- For design and development, **context SoT is `docs/canon/`**; start with `INDEX.md`.
- Before architectural or behavioral changes, consult relevant canon sections.
- On docs↔code divergence, do not silently pick a side; escalate via canon skills / `DISCREPANCIES.md`.
- This rule sets context priority; it does not replace other domain rules in the repo.
- Canon-skills still must not patch application code; coding agents implement code but **must lean on the canon**.

### Report artifact

`.doc-canon/report.json` findings include: `id`, `kind` (`structure` \| `consistency` \| `drift` \| `conflict`), `paths`, `summary`, `status`, `source` (`cli` \| `skill`), optional `discrepancy_id`.

## Error handling

| Condition | Behavior |
|-----------|----------|
| Invalid/missing YAML machine block | Fail validate; block audit/sync/write except contract repair |
| Incompatible `schema_version` / too-old skills stamp | Fail validate (fail closed) with upgrade guidance |
| Missing required file or required template headings | Structural failure |
| Extra headings beyond template | Allowed; may warn on bloat |
| File/section type without registered template | Forbidden until interview + registration |
| Doc↔code conflict undecided | Finding remains open; no silent pick |
| Code confirmed stale | Task in `DISCREPANCIES.md` only; no code edits by this system |
| `doc-canon` missing from PATH when skill runs | Hard fail with install hint |

## Testing (MVP)

- CLI fixture repos: happy `init`/`validate`/`check`; broken YAML; incompatible schema_version; missing section; missing required headings; index≠contract; unknown template id; inventory respects ignore; upgrade-skills does not wipe canon content.
- Template fixtures for mandatory set + `SECTION` / `ENTITY` / `MODULE` / `DOMAIN_TOPIC`.
- Skill flows documented as acceptance scenarios: bootstrap empty; bootstrap non-empty extract-then-freeze; resolve docs vs code; Resolved on next check after fix; add new template kind; pointer rule / AGENTS block present after init. Automated skill tests are out of MVP scope.

## Success criteria

1. After bootstrap, a project has a valid canon, local contract, installed skills, and pointer rule/AGENTS block directing agents to `docs/canon/`.
2. Different LLMs produce the same required document shapes via in-repo templates (extra headings allowed).
3. `validate` catches broken contracts, incompatible schema, and missing required headings; `check` produces inventory + structural report.
4. Semantic audit is grounded in inventory evidence; conflicts require user decision; docs are skill-edited; code work is tasked via `DISCREPANCIES.md`; Resolved happens after fix or on the next clearing check.
5. Extending one project’s structure never changes another project’s defaults.
6. Legacy docs outside canon are import-only after freeze; everyday sync is human-invoked.

## Future (explicitly later)

- Claude Code skill/rule pack consuming the same CLI contract
- Stronger code-aware analyzers (language-specific AST)
- Optional IDE plugin UX
- CI gate using `doc-canon validate` / `check`
- Git-hook hints for sync
- Multi-canon / per-package canons in monorepos
- Exact-set heading enforcement option

## Open implementation choices (for planning, not product ambiguity)

- Concrete package ecosystem (e.g. npm vs other) for distributing `doc-canon`
- Exact YAML schema field names, report JSON schema, inventory JSON schema
- Default numeric thresholds for bloat (`max_lines` etc.)
- Exact Cursor paths for skills/rules (follow current Cursor conventions at implement time)
