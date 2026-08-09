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

## Scout → Expand before deep reads

Before deep-reading canon file bodies or drafting substantial SoT changes:

1. **Progressive disclosure:** start at `docs/canon/INDEX.md`; select only relevant INDEX rows; do not preload the entire canon; open `CANON_CONTRACT.md` / templates only when structure, a new kind, or a write template is needed.
2. **Scout:** build a working-set manifest of `path`, `role`, and short free-form `stub` (why-in-set—not a content digest). Do not invent structure. Use `doc-canon check` inventory/report only when syncing against the tree/code.
3. **Expand gate:** briefly show the working set (paths + stubs) and a verdict **sufficient** or **need more** (which paths, why). Free-form brevity is fine. Doubt → expand; multiple expands are fine; silent under-read is not.
4. Only after **sufficient**, deep-read the approved set and continue the Workflow.

## Clarify before substantial writes

After Scout → Expand (and any further expands), before any **substantial** edit under `docs/canon/**` (new meaning, invariant change, behavioral claim, or non-trivial factual sync), apply this gate if invent-risk remains. Do **not** invent material facts to fill gaps. Do **not** run this gate before Scout.

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

1. Run **Scout → Expand before deep reads** (show working set + verdict). Prefer expand over loading the whole canon when affected sections are unclear.
2. After Expand, apply **Clarify before substantial writes** when invent-risk remains. Skip clarify when the request already supplies the needed facts; say briefly that clarify is unnecessary.
3. Deep-read only the approved working set: `INDEX.md`, and as needed `CANON_CONTRACT.md`, affected sections, and their registered templates.
4. Author or refactor only from registered templates. Preserve required headings; extra headings are allowed.
5. For a new kind or structural change, stop and invoke the contract workflow. Do not invent files, section kinds, or template structures.
6. During everyday sync, update affected sections and `INDEX.md` as needed, and keep cross-links consistent.
7. If canon and code diverge, ask the user which side is stale. Never edit application code. Record code work through `DISCREPANCIES.md`.
8. You may edit `future_plans/**` for directional initiatives. Do not convert plans into task trackers, checklists, or coding-agent prompts.
9. When the user marks an initiative done, absorb its outcomes into the relevant living canon sections and update `future_plans/INDEX.md`.
10. Validate after edits by running `doc-canon validate`. Claim success only after it passes.
11. A docs-stale discrepancy may move from Open to Resolved in this session only after the canon fix validates. A code-stale entry remains Open until a later audit confirms that code has aligned.
