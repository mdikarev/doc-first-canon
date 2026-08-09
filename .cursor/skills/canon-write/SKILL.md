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

## Clarify before substantial writes

Before any **substantial** edit under `docs/canon/**` (new meaning, invariant change, behavioral claim, or non-trivial factual sync), apply this gate. Do **not** invent material facts to fill gaps.

**Skip** when the user request already supplies the facts or decisions needed to write honestly. Say briefly that clarify is unnecessary, then continue the Workflow.

**Otherwise**, ask at most **three** clarifying questions, **one at a time**:

1. Ask a single decision-axis question.
2. Offer options **A/B/C** (optional **D** = other / freeform).
3. State the **recommended** option and one sentence why.
4. Wait for the answer before asking another question.
5. Ask another only if writing would still require inventing a material fact.

If the user declines to choose or says to proceed without answering, take the **recommended** option, say so briefly, and write.

The existing docs↔code “which side is stale?” question uses this same options+recommendation format and **counts toward the three** when it runs in the same pre-write gate.

Clarify does **not** replace the contract workflow: for a new kind or structural change, stop and invoke `canon-contract` after intent is clear.

## Workflow

1. Apply **Clarify before substantial writes** before drafting substantial SoT changes. Do not invent facts to fill gaps.
2. Read `INDEX.md`, `CANON_CONTRACT.md`, the relevant canon sections, and their registered templates.
3. Author or refactor only from registered templates. Preserve required headings; extra headings are allowed.
4. For a new kind or structural change, stop and invoke the contract workflow. Do not invent files, section kinds, or template structures.
5. During everyday sync, identify sections affected by the user's change, update those sections and `INDEX.md` as needed, and keep cross-links consistent.
6. If canon and code diverge, ask the user which side is stale. Never edit application code. Record code work through `DISCREPANCIES.md`.
7. You may edit `future_plans/**` for directional initiatives. Do not convert plans into task trackers, checklists, or coding-agent prompts.
8. When the user marks an initiative done, absorb its outcomes into the relevant living canon sections and update `future_plans/INDEX.md`.
9. Validate after edits by running `doc-canon validate`. Claim success only after it passes.
10. A docs-stale discrepancy may move from Open to Resolved in this session only after the canon fix validates. A code-stale entry remains Open until a later audit confirms that code has aligned.
