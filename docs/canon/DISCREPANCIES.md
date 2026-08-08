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
