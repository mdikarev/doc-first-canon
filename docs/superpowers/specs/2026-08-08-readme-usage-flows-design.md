# README usage flows — design

Date: 2026-08-08  
Status: approved for planning  
Related: [`2026-08-07-doc-first-canon-design.md`](2026-08-07-doc-first-canon-design.md), [`../../acceptance/skill-scenarios.md`](../../acceptance/skill-scenarios.md)

## Goal

Make it obvious how to use `doc-canon` by journey, not only by command: empty project, existing repository, and day-to-day sync. Keep the README short; put detailed walkthroughs in a bilingual guide.

## Decisions

| Topic | Choice |
| --- | --- |
| Depth | Hybrid: short recipes in README + long guide under `docs/guides/` |
| Scenarios | Empty start, existing-repo start, day-to-day (write / check / audit) |
| Languages | Bilingual recipes in both README halves; one bilingual guide file |
| Structure | Single guide file with EN then RU (same pattern as README) |
| Out of scope | Dedicated upgrade-skills / canon-contract flows; separate `.ru.md` files; product design-spec edits; UI screenshots |

## README changes

Place a new section **after Install / Установка** and **before Usage / Использование** in both language halves:

- EN heading: `## Quick start flows`
- RU heading: `## Быстрый старт по флоу`

Each half contains three recipe subsections plus a link to the guide.

### Recipe 1 — Empty project

1. Install / ensure `doc-canon` is on `PATH`
2. `doc-canon init --yes` (or interactive `init`)
3. In Cursor, run skill `canon-bootstrap` (purpose/scope interview, fill canon)
4. `doc-canon validate` (must pass)

### Recipe 2 — Existing project

1. `doc-canon init` at repo root (does not overwrite existing canon document content)
2. Run `canon-bootstrap` — extract-then-freeze; treat legacy docs as import sources; do not edit application code
3. Confirm any proposed extra sections / contract changes when prompted
4. `doc-canon validate`

### Recipe 3 — Day-to-day

1. After meaningful code or canon edits, run `canon-write` to sync affected sections
2. `doc-canon check` — inventory + `.doc-canon/report.json`
3. On docs↔code drift, run `canon-audit` (choose `docs_stale` or `code_stale`)
4. Optionally `doc-canon report` to print the last report

End of section: link from README to `docs/guides/usage-flows.md` (repo-root-relative).

Command reference (`init`, `validate`, `check`, `report`, `upgrade-skills`), Agent skills, Spec and acceptance, and Development sections stay as they are.

## Guide: `docs/guides/usage-flows.md`

Create `docs/guides/` and a bilingual file:

1. Language switcher (EN / RU anchors), matching README style
2. English walkthroughs for the three flows
3. Horizontal rule
4. Russian walkthroughs (same content)

### Per-flow walkthrough contents

For each of Empty, Existing, and Day-to-day:

- **When to use** this flow
- **Preconditions** — Node ≥20, `doc-canon` on `PATH`, Cursor for managed skills
- **Steps** with expected outcomes (what appears: `docs/canon/`, managed skills, pointer rule, `AGENTS.md` managed block, inventory/report artifacts)
- **CLI vs skill** — e.g. `init` scaffolds only; interview / extract-then-freeze is `canon-bootstrap`
- **Common mistakes** — missing `PATH` breaks skill subprocesses; re-`init` without `--force-skills` does not refresh managed assets

Flow-specific emphasis:

- **Empty:** short interview → mandatory docs + `INDEX.md` → `validate`
- **Existing:** inventory + import sources → proposed extras → freeze into `docs/canon/` → `validate`; legacy files and application code unchanged
- **Day-to-day:** offer sync after changes → `canon-write` → `check` → `canon-audit`; explicitly state that `check` does not resolve discrepancies — only `canon-audit` moves Open → Resolved when appropriate

Closing links: design spec and `docs/acceptance/skill-scenarios.md`.  
Mention `upgrade-skills` / `canon-contract` only as pointers to README Usage / Agent skills (no dedicated walkthrough).

## Consistency rules

- EN and RU recipes in README must describe the same three flows and step order
- Commands in examples must match the real CLI: `init`, `validate`, `check`, `report`
- Guide must not contradict the product design or skill acceptance scenarios (empty vs non-empty bootstrap; `check` does not edit `DISCREPANCIES.md`)

## Verification

No automated tests for docs. Manual checklist:

- [ ] Both README language halves include Quick start / Быстрый старт with three recipes
- [ ] Guide link from README resolves
- [ ] Guide EN and RU cover the same three flows
- [ ] CLI vs skill and check-vs-audit statements match acceptance scenarios

## Deliverables

1. Update `README.md` (EN + RU quick-start sections)
2. Add `docs/guides/usage-flows.md`
3. This design doc (committed before implementation plan)
