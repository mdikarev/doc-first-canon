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
