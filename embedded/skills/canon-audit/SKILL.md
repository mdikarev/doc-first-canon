---
name: canon-audit
description: Audit canon semantics, resolve divergence, and maintain discrepancy state.
---

# Canon Audit

## Safety and source of truth

- The source of truth (SoT) is `docs/canon/`; start from `docs/canon/INDEX.md`.
- Never modify application code. Edit only `docs/canon/**`; managed paths may be changed only by CLI upgrade flows.
- Always run `doc-canon validate` before claiming success on canon edits.
- If `doc-canon` is missing on PATH, stop and give an install hint: `npm install -g doc-canon` or use a local npx invocation. Do not continue without validation.

## Audit flow

1. Run `doc-canon validate` first. If it fails, stop the semantic pass and repair structure through canon-write or the contract through canon-contract.
2. Run `doc-canon check` to refresh the language-agnostic inventory and CLI findings.
3. Read the fresh inventory, report, `INDEX.md`, contract, and relevant canon/code files. Do not rely on model memory.
4. Perform the semantic checks:
   - coverage of required contract paths and INDEX entries;
   - orphans, while recognizing the CLI already checks them;
   - glossary terms against inventory/text hits or explicit doc-only evidence;
   - architecture claims against inventory paths;
   - relative and Related-canon links;
   - doc↔doc conflicts only when supported by at least two cited passages.
   - Do not treat `future_plans` prose as the current behavioral SoT when judging docs↔code drift; it is directional canon for future system shape.
5. Every finding must cite canon paths and inventory/code paths, or explicitly say code is missing. Deduplicate normalized kind/path sets and honor all ignores.

## Report ownership

Merge semantic findings into `.doc-canon/report.json` with `source: skill`. Use a read-modify-write update that preserves every `source: cli` finding. Never replace the other source's findings. Mark prior `source: skill` findings that this audit cannot confirm as `status: stale`; do not silently delete or resolve them.

`structure` and `consistency` findings are not filed into `DISCREPANCIES.md`. Repair them through validate, canon-write, or canon-contract. Only grounded `conflict` and `drift` findings enter the discrepancy dialogue.

## Resolve dialogue and discrepancy lifecycle

1. Present evidence and ask the user whether docs or code are stale. Never silently choose.
2. Before adding an Open entry, deduplicate by overlapping canon/code paths. Assign a new `D-NNN` from the greatest existing ID and never reuse IDs. A new unresolved entry has `decision: pending`.
3. Follow this strict order: successful apply → set the decision → then move Open → Resolved when appropriate. If apply is interrupted or validation fails, leave `decision: pending`.
4. For `docs_stale`, edit the canon from its template and run `doc-canon validate`. Only after validation succeeds, set `decision: docs_stale`, then move the entry to Resolved in the same session.
5. For `code_stale`, write or update the Open discrepancy task and its `coding_agent_prompt` first. Include what to study, what diverges, evidence paths, and questions requiring user clarification. Only after that write succeeds, set `decision: code_stale`. It must stay Open until a later audit confirms the code no longer diverges; only that later audit may move it to Resolved.
6. A later audit may also move a linked Open entry to Resolved when its conflict no longer reproduces and docs validate. `doc-canon check` itself never edits `DISCREPANCIES.md`.

Finish by running `doc-canon validate` again after any canon edits and report remaining open decisions.
