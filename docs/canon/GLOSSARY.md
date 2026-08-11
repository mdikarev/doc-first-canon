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

### Working set
The small list of canon/artifact paths an agent intends to use for the current task, discovered via INDEX (and CLI inventory/report when needed) before deep-reading file bodies.

### Scout
Phase that builds a working-set manifest (`path`, `role`, short why-in-set stub) without loading full file bodies or inventing structure.

### Expand gate
Check that the working set is **sufficient** or **need more** before deep reads. Doubt → expand. Managed canon skills briefly show the set and verdict in chat; coding agents apply the same discipline without a mandatory chat ritual.

### Feature-change order (canon-first)
For intentional new or changed behavior: update living canon via `canon-write` first, optionally write/sync a project-local design/plan when the change is large, wait for user go-ahead after substantial canon edits, then implement application code. Exceptions: pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits. Distinct from post-hoc everyday sync.

### skills_stamp
Version marker in the contract YAML recording which managed skills stamp was last applied; validate fails if skills are too old relative to CLI expectations.

### Future plans
Canon subtree `docs/canon/future_plans/` for initiatives describing the **future shape** of the system. Not behavioral SoT for current behavior; not a development task tracker. After realization, absorb into living sections and mark the initiative absorbed or remove it.

### Future plans validate zone
Validate behavior for `future_plans/*.md` other than `INDEX.md`: exempt from the "not listed in contract" orphan check; instead checked against `future_plans/INDEX.md`'s Initiatives table (INDEX↔disk agreement) and required `FUTURE_PLAN` headings. Replaces per-initiative `future-p*` contract rows.

### index-manifest
`.doc-canon/index-manifest.json`: BM25 index manifest artifact (`schema_version`, opaque `index_id`, `built_at`, per-doc `hash`/`token_count`) written last as the commit marker after a successful `bm25-index` write.

### bm25-index
`.doc-canon/bm25-index.json`: serialized Okapi BM25 data (postings/df/doc-length) for the current corpus, sharing `index_id` with its companion `index-manifest`.

### index_id
Opaque string shared by one `index-manifest` + `bm25-index` pair from the same rebuild; a mismatch between the two makes the `openCanonIndex` reader facade fail closed.

### doc_hash
Per-document `sha256:<hex>` content hash recorded in `index-manifest`, used to detect create/update/delete and trigger a full BM25 rebuild.

## Naming conventions

- Section files use `UPPER_SNAKE` or clear `Title.md` paths registered in the contract (`OVERVIEW.md`, `CLI.md`, …).
- Discrepancy IDs: `D-NNN` assigned monotonically; never reuse.
- Finding IDs: `F-NNN` in reports.
- Skill names: `canon-<verb>` (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`).
- Prefer repo-relative paths in evidence fields.

## Related canon

- [OVERVIEW.md](OVERVIEW.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
