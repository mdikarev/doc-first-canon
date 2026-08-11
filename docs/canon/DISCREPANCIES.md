# Discrepancies

## How to use

Record grounded docs↔code (or docs↔docs) conflicts here. Skills own semantic findings and this file; `doc-canon check` never edits it.

Apply order for resolution:

1. Successful apply (canon edit + `validate`, or write coding task)
2. Set `decision` (`docs_stale` or `code_stale`)
3. Move Open → Resolved only when appropriate (`docs_stale` same session after validate; `code_stale` stays Open until a later `canon-audit` no longer reproduces the drift)

Never silently pick a side. Never edit application code from canon skills.

## Open

<!-- No open discrepancies at freeze time. -->

## Resolved

### D-004: P0b future_plans status lags absorbed BM25 index
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/future_plans/INDEX.md`, `docs/canon/future_plans/p0b-bm25-index.md`, `docs/canon/OVERVIEW.md`, `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/cli.ts`, `src/commands/index-cmd.ts`
- **evidence:** Living OVERVIEW/CLI/ARCHITECTURE already document shipped `doc-canon index` / BM25 while `future_plans/INDEX.md` still listed P0b as `refining`. Marked P0b `absorbed` in the initiative file and INDEX (via absorb handoff); `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-004`

### D-003: Working-tree contract stamp reverted below package SKILLS_STAMP
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/CANON_CONTRACT.md`
- **code_paths:** `src/version.ts`
- **evidence:** Uncommitted working tree had `skills_stamp: "0.6.0"` while `SKILLS_STAMP` (and committed HEAD contract) were `"0.7.0"`. Restored contract YAML to `"0.7.0"`; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-003`

### D-002: OVERVIEW CLI scope omits shipped `index`
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/OVERVIEW.md`, `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/cli.ts`, `src/commands/index-cmd.ts`
- **evidence:** After P0b, living `CLI.md`/`ARCHITECTURE.md` and code expose `doc-canon index`, but `OVERVIEW.md` In scope still listed only `init`/`validate`/`check`/`report`/`upgrade-skills`. Updated OVERVIEW In scope (and CLI Purpose) to include `index`/BM25; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-002`

### D-001: OVERVIEW managed skills list lags current canon
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/OVERVIEW.md`, `docs/canon/SKILLS.md`
- **code_paths:** `embedded/skills/canon-future-plan/SKILL.md`
- **evidence:** `OVERVIEW.md` listed only `canon-bootstrap`, `canon-write`, `canon-audit`, and `canon-contract`, while `SKILLS.md` states five managed skills and embedded assets include `canon-future-plan`. `OVERVIEW.md` was updated to include `canon-future-plan`, then `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-001`

<!-- Move resolved discrepancy entries here. -->

## Template for new entries
<!--
  ### D-001: <short title>
- **status:** open | resolved
- **decision:** pending | docs_stale | code_stale
- **canon_paths:** ...
- **code_paths:** ...
- **evidence:** ...
- **finding_ids:** ...
- **coding_agent_prompt:** |
  What to study; what diverges; questions to clarify with the user.
-->
