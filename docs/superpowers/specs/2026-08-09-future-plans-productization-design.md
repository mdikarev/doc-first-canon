# Future plans as a first-class canon feature — Design Spec

**Date:** 2026-08-09  
**Status:** Approved for implementation planning  
**Approach:** Default scaffold + `upgrade-skills` migration; managed rules/skills encode semantics; initiatives remain optional files

## Problem

`docs/canon/future_plans/` exists only in this repository as an ad-hoc structure. Target projects that use `doc-canon` do not get the folder, templates, or agent rules. Maintainers need a **productized** convention: future system shape lives in the canon, stays distinct from development task queues, and is installed/migrated by the tool.

## Goals

1. Make `future_plans` part of the **tool’s** default canon shape (not a one-off for doc-first-canon).
2. Encode agent rules: future_plans hold **initiatives describing the future system**; after implementation, outcomes are absorbed into living canon sections.
3. Explicitly forbid treating future_plans as coding-task / checklist / `coding_agent_prompt` storage (those belong to roadmap/issues/`DISCREPANCIES`).
4. On `init`, always materialize `future_plans/INDEX.md` (`required: true`) with **zero** initiatives allowed.
5. On `upgrade-skills`, idempotently migrate existing canons to that card skeleton without rewriting initiative prose.

## Non-goals

- A separate `doc-canon migrate-future-plans` command (migration rides on `upgrade-skills`)
- Auto-generating initiatives from code or inventory
- Making individual initiative files required
- Changing orphan validation (unregistered `.md` under `docs/canon/` still fails)
- Embedding this repo’s P0–P3 initiatives into the default package scaffold
- Building `docs/roadmap/` as part of this change

## Decisions

| Topic | Choice |
| --- | --- |
| INDEX mandatory | `future_plans/INDEX.md` in default contract with `required: true` |
| Initiatives | Not in default contract; add via `canon-contract` as `required: false` + `FUTURE_PLAN` |
| Semantics | Future system shape only; not execution tasks |
| Migration | `upgrade-skills` scaffolds templates + INDEX section + file if missing |
| Nested paths | `init` must `mkdir` parent dirs when copying `section.path` |
| Current SoT | Root canon sections remain behavioral SoT; future_plans is directional |

## Semantics (agent-facing)

**Future plans** are canon documents that describe how the **system should look in the future** (capabilities, boundaries, absorb targets). They are refined over time and, once built, their outcomes update normal canon sections; the initiative is then marked absorbed or removed.

**Not allowed in future_plans:** development task lists, sprint checklists, executable agent prompts for coding, discrepancy coding tasks. Point elsewhere for execution tracking.

**Status vocabulary (product default):** keep draft / refining / absorbed (and optional project-local statuses). Do not treat the folder as a substitute for a task tracker; an `implementing` label, if used by a project, still must not turn the file into a task dump.

## Architecture

```text
embedded/templates/FUTURE_PLANS_INDEX.md
embedded/templates/FUTURE_PLAN.md
default-contract → section future_plans/INDEX.md (required)
init → mkdir + copy INDEX scaffold (0 initiatives)
upgrade-skills → ensure templates + contract section + INDEX file
managed rule + AGENTS → semantics paragraph
skills → bootstrap/write/contract/audit guidance
```

### CLI / scaffold

| Surface | Behavior |
| --- | --- |
| `defaultContractMarkdown()` | Add required future-plans INDEX section; register `FUTURE_PLANS_INDEX` + `FUTURE_PLAN` templates |
| `init` scaffold | Create nested `future_plans/INDEX.md` from template; fix directory creation for nested `section.path` |
| `upgrade-skills` | After/with managed asset copy: ensure both templates exist under `docs/canon/templates/`; ensure contract YAML lists the INDEX section (`required: true`) if missing; create INDEX file from template if missing; optionally sync INDEX Sections table row; never overwrite existing initiative markdown; bump `skills_stamp`; run validate |
| `validate` | Unchanged rules: required INDEX must exist and match template headings; orphans must be contracted |

### Agent layer

| Asset | Change |
| --- | --- |
| `embedded/rules/doc-canon.mdc` | Paragraph on future_plans role and non-task rule |
| `embedded/agents/AGENTS.block.md` | Same, brief |
| `canon-bootstrap` | Expect INDEX scaffold; do not invent initiatives unless user asks |
| `canon-write` | May edit plans/INDEX; refuse to convert into task trackers |
| `canon-contract` | Workflow to register new `future_plans/<slug>.md` optional sections |
| `canon-audit` | Do not treat future_plans prose as current behavioral SoT when auditing docs↔code |

### This repository’s living canon

Update `GLOSSARY.md`, `OVERVIEW.md`, `ARCHITECTURE.md`, `CLI.md`, `SKILLS.md`, and `future_plans/INDEX.md` wording so the **product** behavior matches this spec. Align local contract: INDEX `required: true` (initiatives stay `required: false`). Remove “build roadmap inside future_plans” wording that blurs task-tracking.

## Data flow

1. New repo: `init` → valid canon including empty-ish `future_plans/INDEX.md`.
2. Existing repo: `upgrade-skills` → card skeleton present → validate passes.
3. New initiative: user/skill → contract optional section → file from `FUTURE_PLAN` → row in future_plans INDEX → validate.
4. After feature ships: absorb into living sections → mark initiative absorbed / delete + drop contract row.

## Error handling

- Missing required INDEX after migration attempt → `validate` fails (fail closed).
- Malformed AGENTS markers → existing `upgrade-skills` preconditions still apply.
- Partial YAML edit failure → do not leave contract unparsable; prefer atomic write of full contract markdown.
- Custom templates already named `FUTURE_PLAN` with different headings → upgrade must not clobber if file exists (document: user reconciles headings or renames).

## Testing

- Unit/integration: `init` on empty root creates `docs/canon/future_plans/INDEX.md` and validates.
- `upgrade-skills` on fixture with pre-future_plans contract ends valid and does not modify a planted initiative file.
- Nested section path mkdir regression test.
- Skill acceptance notes updated for future_plans semantics (doc-level ok if automation still out of MVP).

## Rollout

1. Implement scaffold + upgrade migration + tests.
2. Refresh embedded skills/rules; bump `skills_stamp` as required by package policy.
3. Sync this repo’s canon to describe the product feature; run `doc-canon validate`.
4. Existing adopters run `doc-canon upgrade-skills`.

## Related

- Prior capture: [`2026-08-09-production-path-roadmap-design.md`](2026-08-09-production-path-roadmap-design.md)
- Drafts in this repo: [`docs/canon/future_plans/INDEX.md`](../../canon/future_plans/INDEX.md)
- MVP design: [`2026-08-07-doc-first-canon-design.md`](2026-08-07-doc-first-canon-design.md)
