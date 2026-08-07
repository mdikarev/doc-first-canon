---
name: canon-contract
description: Change a project's canon contract and registered templates safely.
---

# Canon Contract

## Safety and source of truth

- The source of truth (SoT) is `docs/canon/`; start from `docs/canon/INDEX.md`.
- Never modify application code. Edit only `docs/canon/**`; managed paths may be changed only by CLI upgrade flows.
- Always run `doc-canon validate` before claiming success on canon edits.
- If `doc-canon` is missing on PATH, stop and give an install hint: `npm install -g doc-canon` or use a local npx invocation. Do not continue without validation.

## Workflow

1. Read `INDEX.md`, `CANON_CONTRACT.md`, and every template and section affected by the request.
2. Interview the user about the structural need and draft the intended diff for the contract, templates, section files, and index.
3. Show the intended diff and require explicit user confirmation before writing anything.
4. After confirmation, edit this repository's `docs/canon/CANON_CONTRACT.md` and registered files under `docs/canon/templates/`; create or refactor canon sections only as agreed.
5. For a new template kind, agree its headings, save its template, register it in the local contract, validate, and only then create documents from it.
6. Run `doc-canon validate`. If it fails, repair only the confirmed local contract/template change or report the blocker.
7. Never change other repositories' defaults. Project-specific structure belongs only to this repository's contract and templates.
