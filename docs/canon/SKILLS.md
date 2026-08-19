# Skills

## Purpose

Own the agent layer: interview, extract-then-freeze bootstrap, canon authorship, semantic audit, contract evolution, and discrepancy dialogue — always through the local contract and CLI validation.

## Scope

**Covers:** managed skills `canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan` (identical trees under `.cursor/skills/` and `.claude/skills/`); Cursor pointer rule; short `AGENTS.md` managed block; full pointer-rule body in `CLAUDE.md` (Claude Code always-on; Claude does not load `.cursor/rules`).

**Excludes:** inventing required files/section types/templates outside the contract; editing application code; replacing CLI structural validation.

## Current state

Five skills ship in `embedded/skills/` and are dual-written into `.cursor/skills/` and `.claude/skills/` on `init` / `upgrade-skills`. `canon-future-plan` authors directional initiatives under `future_plans/`; validate enforces an INDEX-driven zone for that folder (see `ARCHITECTURE.md`, `CLI.md`). Acceptance scenarios live in `docs/acceptance/skill-scenarios.md` (import source; not SoT). Automated skill execution tests are out of MVP scope.

Agents that use the canon follow a shared dual-audience recipe: try `doc-canon search` → Scout a working-set manifest → Expand gate (`sufficient` / `need more`) → Execute with targeted deep reads. Search failure falls back to progressive disclosure from `INDEX.md`. **Quality over thrift:** expand when doubtful; never silently under-read or invent facts to save tokens. For **code analysis** in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), agents apply the same discipline through the code index first: try `doc-canon code-index search` before whole-file source reads, then read source as evidence when the probe is empty or thin and note the miss (`code_miss: <query> -> source:<path>`). `canon-bootstrap` and `canon-audit` build the indexes first (`doc-canon index`, `doc-canon code-index build` when covered source exists) and prefer index search for their goals when the indexes exist.

Coding agents follow feature-change order for new or changed behavior and public contracts: invoke `canon-write` first, proceed to application code only after the canon-first flow in the pointer rule is satisfied, then close the cycle with `canon-audit` (spot write does not replace a full-topic semantic pass).

## Responsibilities

| Skill | Responsibility |
| --- | --- |
| `canon-bootstrap` | First run; empty interview or non-empty extract-then-freeze; fill mandatory (+ agreed) sections including required `future_plans/INDEX.md`; validate |
| `canon-write` | Author/refactor canon prose; run before feature code for behavior/public-contract changes and for everyday sync of affected sections; Scout → Expand (show working set + verdict) before deep reads; after Expand, clarify when invent-risk remains (one question at a time, A/B/C options, recommended answer, max 3) or skip when the request is already unambiguous; apply the documentation coverage checklist to authored sections (cover each category or explicitly exclude it in Scope); inventory/`check` only when syncing vs code/tree; after successful substantive writes to `docs/canon/**`, run one-shot `doc-canon index`; **narrowed for `future_plans/**`:** on any create / refine / status-change request for that folder, stop and hand off to `canon-future-plan` — `canon-write` keeps only living-SoT absorb (merge shipped outcomes into root sections), then hands the `absorbed` status / INDEX update back to `canon-future-plan` |
| `canon-future-plan` | Create/refine directional initiatives under `future_plans/` from `FUTURE_PLAN`; own status transitions and `pN` / `pN`+letter numbering; keep `future_plans/INDEX.md` (table row, status, short ordering note) in sync in the same pass; refuse checklists, sprint plans, and coding-agent prompts in initiative bodies; same Scout → Expand → clarify-if-invent-risk protocol as `canon-write`; run `doc-canon validate` before claiming success |
| `canon-audit` | Semantic audit vs inventory; Scout → Expand with visible working set + verdict before deep evidence reads (`validate` then `check` as Scout inputs); keep LLM context on open findings only (`stale_skipped: N`); before merge, discover prior `source: skill` findings via full `doc-canon report` and mark unreproduced ones stale by normalized `(kind, paths)`; resolve dialogue; discrepancy lifecycle |
| `canon-contract` | Propose contract/template diffs; write only after explicit user confirmation; validate |

**Absorb split:** once an initiative ships, `canon-write` merges outcomes into the relevant living sections; `canon-future-plan` then sets the initiative's status to `absorbed` and updates `future_plans/INDEX.md`.

Pointer rule / `AGENTS.md` / `CLAUDE.md`: always-on context priority — try canon search first, then fall back to `docs/canon/INDEX.md` when search fails closed; build a small working set and expand if unsure before deep reads (no mandatory chat ritual); for new/changed behavior use **canon-first** (`canon-write` → optional project-local spec/plan → code → closing `canon-audit`; substantial canon waits for user go-ahead; coding agents do not edit canon themselves); escalate docs↔code divergence; do not silently pick a side. Cursor loads the `.mdc` pointer rule; Claude Code loads the same policy body from `CLAUDE.md` (not `.cursor/rules`).

### Scout retrieval protocol

1. Scout always tries `doc-canon search "<topic>"` first and builds the working-set stub from the returned pack paths and snippets.
2. If search fails closed because the index is missing or corrupt, surface an explicit hint to run `doc-canon index`, then continue with INDEX-first Scout. Do not hard-stop the skill.
3. If search returns `index_stale`, surface the warning, continue using the pack, and Expand when the evidence is thin.
4. Thin or empty results require an alternate query, INDEX section ids, or targeted reads. Search never licenses under-reading.

After any successful substantive write to `docs/canon/**`, the responsible managed skill runs one-shot `doc-canon index`. If a running watch holds the index lock, surface the one-shot failure and rely on the watch, or suggest `doc-canon index --stop` before re-indexing; do not fight the lock or reindex inside `search`.

`canon-bootstrap` may legitimately use a wide inventory/import pass—do not force an artificially tiny working set. `canon-contract` work is naturally narrow (contract + templates + INDEX); full phased skill text for those two can wait until write/audit patterns stabilize.

## Documentation coverage checklist

Canon sections are living behavioral SoT: each section, when authored or revised, must cover the required content categories below, or explicitly exclude a category in its Scope with a reason. This is an authorship discipline in the managed skills (`canon-write`, `canon-bootstrap`) — not validator-enforced structure. The checklist is not a template; sections keep the registered template's required headings and add the coverage as their key details / responsibilities / flows call for.

| Category | Lives where | What a good section documents |
| --- | --- | --- |
| Public interfaces | `Interfaces` / `Interfaces` table in MODULE, SECTION, ENTITY | Public inputs, outputs, and contracts; observable signals (exit codes ≠0, warnings, `--json` shape) |
| Workflows / key flows | `Key flows` in ARCHITECTURE; `Workflows` elsewhere | Order of steps for each main operation; what triggers and consumes it |
| Usage examples | `Usage guide` / `Usage examples` sub-sections | Working command examples with flags and expected results (see `CLI.md` `code-index search`) |
| Operational runbooks | `Runbooks` / `Operational` sub-sections | Startup, configuration, upgrade, rollback, recovery; what to do when things fail |
| Failure modes / error handling | `Error handling` / `Failure modes` | What can break, how failure is signaled, and how to recover |
| Success criteria | `Success signals` in OVERVIEW | Observable signs that the system works as documented |

## Interfaces

- **Inputs:** user intent, inventory/report, existing canon and templates, legacy docs as import sources during bootstrap only
- **Outputs:** edits under `docs/canon/**`; discrepancy entries; skill findings in `.doc-canon/report.json`
- **Subprocess:** must invoke `doc-canon`; if missing on PATH, hard-fail with install hint (`npm install -g doc-canon` or local link/`npx`)

## Dependencies

- Installed `doc-canon` CLI on PATH
- Local `CANON_CONTRACT.md` and templates
- Cursor and Claude Code overlays via dual-write on `init` / `upgrade-skills` (identical skill trees; Cursor `.mdc` + short `AGENTS.md`; full rule body in `CLAUDE.md`)

## Invariants

- Never patch application code; `code_stale` → Open coding task only
- Never bypass contract for new section kinds
- `future_plans/**` holds directional initiatives only; never convert it into a task tracker, checklist, or coding-agent prompt list — execution work belongs in `DISCREPANCIES.md` / project task tools
- Authored canon sections cover the documentation coverage checklist categories (Public interfaces, Workflows, Usage examples, Operational runbooks, Failure modes, Success criteria) or explicitly exclude a category in Scope with a reason
- Always `doc-canon validate` before claiming success on canon edits
- `canon-write` must not invent material facts for substantial edits: clarify (MCQ + recommendation) or skip only when the request already resolves ambiguity
- `check` does not close discrepancies; only audit applies the lifecycle when appropriate

## Open questions

- Claude Code marketplace / plugin packaging remains Future; dual-write overlay is the shipped packaging model.

## Related canon

- [CLI.md](CLI.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [DISCREPANCIES.md](DISCREPANCIES.md)
- [GLOSSARY.md](GLOSSARY.md)
