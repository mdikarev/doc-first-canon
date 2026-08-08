---
name: canon-bootstrap
description: Bootstrap or import a repository's documentation canon.
---

# Canon Bootstrap

## Safety and source of truth

- The source of truth (SoT) is `docs/canon/`; start from `docs/canon/INDEX.md`.
- Never modify application code. Edit only `docs/canon/**`; managed paths may be changed only by CLI upgrade flows.
- Always run `doc-canon validate` before claiming success on canon edits.
- If `doc-canon` is missing on PATH, stop and give an install hint: `npm install -g doc-canon` or use a local npx invocation. Do not continue without validation.

## Workflow

1. If the canon scaffold is missing, call `doc-canon init`.
2. Detect whether the project is empty or non-empty and interview the user before writing.
3. For an empty project, ask for purpose and scope, fill the mandatory files from their registered templates, refresh `INDEX.md`, and validate.
4. For a non-empty project, use extract-then-freeze:
   - Run a fresh inventory.
   - Read README files, existing docs, and agent instructions as import sources, not as authority.
   - Propose extra sections, interview the user, and use the contract workflow for confirmed structural changes.
   - Extract agreed facts into files created from registered templates, then refresh `INDEX.md`.
5. Run `doc-canon validate`. After it succeeds, import sources outside `docs/canon/` are not SoT. Do not delete or silently update those legacy files.
6. Surface docs↔code conflicts for user resolution; never silently merge or choose a side.
