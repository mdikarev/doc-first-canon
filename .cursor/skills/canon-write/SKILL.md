---
name: canon-write
description: Author, refactor, and synchronize canon documentation.
---

# Canon Write

## Safety and source of truth

- The source of truth (SoT) is `docs/canon/`; start from `docs/canon/INDEX.md`.
- Never modify application code. Edit only `docs/canon/**`; managed paths may be changed only by CLI upgrade flows.
- Always run `doc-canon validate` before claiming success on canon edits.
- If `doc-canon` is missing on PATH, stop and give an install hint: `npm install -g doc-canon` or use a local npx invocation. Do not continue without validation.

## Workflow

1. Read `INDEX.md`, `CANON_CONTRACT.md`, the relevant canon sections, and their registered templates.
2. Author or refactor only from registered templates. Preserve required headings; extra headings are allowed.
3. For a new kind or structural change, stop and invoke the contract workflow. Do not invent files, section kinds, or template structures.
4. During everyday sync, identify sections affected by the user's change, update those sections and `INDEX.md` as needed, and keep cross-links consistent.
5. If canon and code diverge, ask the user which side is stale. Never edit application code. Record code work through `DISCREPANCIES.md`.
6. Validate after edits by running `doc-canon validate`. Claim success only after it passes.
7. A docs-stale discrepancy may move from Open to Resolved in this session only after the canon fix validates. A code-stale entry remains Open until a later audit confirms that code has aligned.
