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
2. Run `doc-canon check` to refresh the language-agnostic inventory and CLI findings (Scout inputs).
3. **Try search first:** run `doc-canon search "<topic>"` from user intent and seed the working set from pack paths and snippet stubs. If search fails closed, hint `doc-canon index` and fall back to INDEX-first Scout. If `index_stale`, surface the warning and continue; Expand when thin.
4. **Scout:** from search results (or `INDEX.md` fallback), contract, fresh inventory/report, build a working-set manifest (`path`, `role`, short free-form `stub`). Include likely evidence paths for claims you will make. Do not preload every markdown file.
5. **Expand gate:** briefly show the working set (paths + stubs) and verdict **sufficient** or **need more** (which paths, why). Doubt → expand until claims can be evidence-backed. Free-form brevity; multiple expands are fine; silent under-read is not.
6. Only after **sufficient**, deep-read the approved set (inventory, report, canon, and code evidence paths). Do not rely on model memory.
7. Perform the semantic checks:
   - coverage of required contract paths and INDEX entries;
   - orphans, while recognizing the CLI already checks them;
   - glossary terms against inventory/text hits or explicit doc-only evidence;
   - architecture claims against inventory paths;
   - relative and Related-canon links;
   - doc↔doc conflicts only when supported by at least two cited passages.
   - Do not treat `future_plans` prose as the current behavioral SoT when judging docs↔code drift; it is directional canon for future system shape.
8. Every finding must cite canon paths and inventory/code paths, or explicitly say code is missing. Deduplicate normalized kind/path sets and honor all ignores.

## Report ownership

After the semantic pass, before writing `.doc-canon/report.json`:

1. Run `doc-canon report` and collect every finding with `source: skill` as **prior**.
2. Match this audit's confirmed findings to prior by normalized `(kind, paths)`.
3. On match: keep the same `F-NNN`, set `status: open`, update summary/evidence as needed.
4. Prior with no match (this audit did not reproduce it): set `status: stale`; do not delete or resolve them.
5. Confirmed with no prior: assign a new `F-NNN` from the greatest existing id.
6. Read-modify-write the report: emit updated skill findings (each with `source: skill`) plus every `source: cli` finding unchanged. Never replace the other source's findings.

`structure` and `consistency` findings are not filed into `DISCREPANCIES.md`. Repair them through validate, canon-write, or canon-contract. Only grounded `conflict` and `drift` findings enter the discrepancy dialogue.

## Resolve dialogue and discrepancy lifecycle

1. Present evidence and ask the user whether docs or code are stale. Never silently choose.
2. Before adding an Open entry, deduplicate by overlapping canon/code paths. Assign a new `D-NNN` from the greatest existing ID and never reuse IDs. A new unresolved entry has `decision: pending`.
3. Follow this strict order: successful apply → set the decision → then move Open → Resolved when appropriate. If apply is interrupted or validation fails, leave `decision: pending`.
4. For `docs_stale`, edit the canon from its template and run `doc-canon validate`. Only after validation succeeds, set `decision: docs_stale`, then move the entry to Resolved in the same session.
5. For `code_stale`, write or update the Open discrepancy task and its `coding_agent_prompt` first. Include what to study, what diverges, evidence paths, and questions requiring user clarification. Only after that write succeeds, set `decision: code_stale`. It must stay Open until a later audit confirms the code no longer diverges; only that later audit may move it to Resolved.
6. A later audit may also move a linked Open entry to Resolved when its conflict no longer reproduces and docs validate. `doc-canon check` itself never edits `DISCREPANCIES.md`.

Finish by running `doc-canon validate` again after any canon edits and report remaining open decisions.
