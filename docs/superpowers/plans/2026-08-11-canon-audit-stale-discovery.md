# Canon-audit stale discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `canon-audit` discover prior `source: skill` findings via `doc-canon report` and mark unreproduced ones `stale` by normalized `(kind, paths)`.

**Architecture:** Guidance-only. Expand **Report ownership** in managed `canon-audit`, mirror into `.cursor/skills`, sync a short phrase in living `docs/canon/SKILLS.md`, lock phrases in `tests/embedded-assets.test.ts`, bump `skills_stamp`. No CLI or `report.json` schema changes.

**Tech Stack:** Markdown skill/canon assets, TypeScript `node:test` string assertions, existing `doc-canon validate`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-11-canon-audit-stale-discovery-design.md`. On conflict with living canon, escalate—do not silently pick a side.
- **No new CLI** / merge helpers / schema changes.
- Stale criterion: prior `source: skill` not reproduced by this audit → `status: stale` (do not delete or resolve via this step alone).
- Reproduction key: normalized `(kind, paths)`.
- Preserve every `source: cli` finding on read-modify-write.
- Bump `SKILLS_STAMP` to `"0.7.0"` when managed assets change; leave `MIN_SKILLS_STAMP` at `"0.1.0"`; sync `docs/canon/CANON_CONTRACT.md` `skills_stamp`.
- Mirror every edited embedded skill into `.cursor/skills/`.
- Living `docs/canon/SKILLS.md` updates: prefer `canon-write` (canon-first); if implementing inside this repo’s plan session with an approved plan, apply the exact prose in the task.
- TDD: failing test → implement → pass → commit per task.
- Before claiming done: `npm test` and `node bin/doc-canon.js validate` (repo root).

---

## File Structure

```text
tests/embedded-assets.test.ts                 # Assert doc-canon report + stale match phrases
embedded/skills/canon-audit/SKILL.md          # Report ownership algorithm
.cursor/skills/canon-audit/SKILL.md           # Mirror of embedded
docs/canon/SKILLS.md                          # Short discovery phrase on canon-audit row
src/version.ts                                # SKILLS_STAMP → "0.7.0"
docs/canon/CANON_CONTRACT.md                  # skills_stamp → "0.7.0"
```

No changes to `src/report/*`, CLI commands, or discrepancy lifecycle prose beyond what already exists.

---

### Task 1: Failing asset assertions for report discovery

**Files:**
- Modify: `tests/embedded-assets.test.ts`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: `readEmbedded(...)`, existing `it("documents semantic audit merge and discrepancy lifecycle")`
- Produces: failing assertions that require `doc-canon report` and match/stale phrasing in `canon-audit`

- [ ] **Step 1: Extend the audit merge test**

In `tests/embedded-assets.test.ts`, inside `it("documents semantic audit merge and discrepancy lifecycle")`, keep all existing asserts and add:

```ts
assert.match(audit, /doc-canon report/);
assert.match(audit, /kind.*paths|normalized.*kind/i);
assert.match(audit, /cannot confirm|not reproduce|unreproduced|no match/i);
```

Full updated test body should still include the existing matches for `doc-canon check`, `source: skill`, `source: cli`, `read-modify-write`, `status: stale`, structure/consistency / DISCREPANCIES, apply→decision→Resolved, `docs_stale`, and `code_stale`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/embedded-assets.test.ts`

Expected: FAIL on the new `doc-canon report` (and/or kind/paths) assertion because current **Report ownership** lacks that discovery step.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
test: require canon-audit report discovery before stale merge

EOF
)"
```

---

### Task 2: Expand Report ownership in canon-audit

**Files:**
- Modify: `embedded/skills/canon-audit/SKILL.md` (Report ownership section)
- Modify: `.cursor/skills/canon-audit/SKILL.md` (identical mirror)
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: algorithm from the design spec
- Produces: skill text that satisfies Task 1 assertions

- [ ] **Step 1: Replace the Report ownership section**

In both `embedded/skills/canon-audit/SKILL.md` and `.cursor/skills/canon-audit/SKILL.md`, replace the **Report ownership** section (keep the following `structure` / `consistency` paragraph) with:

```markdown
## Report ownership

After the semantic pass, before writing `.doc-canon/report.json`:

1. Run `doc-canon report` and collect every finding with `source: skill` as **prior**.
2. Match this audit’s confirmed findings to prior by normalized `(kind, paths)`.
3. On match: keep the same `F-NNN`, set `status: open`, update summary/evidence as needed.
4. Prior with no match (this audit did not reproduce it): set `status: stale`; do not delete or resolve them.
5. Confirmed with no prior: assign a new `F-NNN` from the greatest existing id.
6. Read-modify-write the report: emit updated skill findings plus every `source: cli` finding unchanged. Never replace the other source’s findings.

`structure` and `consistency` findings are not filed into `DISCREPANCIES.md`. Repair them through validate, canon-write, or canon-contract. Only grounded `conflict` and `drift` findings enter the discrepancy dialogue.
```

Do not weaken Audit flow step 7 (dedupe / ignores) or the resolve-dialogue sections.

- [ ] **Step 2: Run asset tests to verify they pass**

Run: `node --import tsx --test tests/embedded-assets.test.ts`

Expected: PASS (including the new `doc-canon report` / kind-paths asserts).

- [ ] **Step 3: Commit**

```bash
git add embedded/skills/canon-audit/SKILL.md .cursor/skills/canon-audit/SKILL.md
git commit -m "$(cat <<'EOF'
fix: document canon-audit prior finding discovery via report

EOF
)"
```

---

### Task 3: Sync living SKILLS.md

**Files:**
- Modify: `docs/canon/SKILLS.md` (Responsibilities table, `canon-audit` row)
- Test: `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: short discovery phrase from the design spec
- Produces: living SoT that mentions `doc-canon report` before merge for audit

- [ ] **Step 1: Update the canon-audit responsibility cell**

In `docs/canon/SKILLS.md`, change the `canon-audit` row responsibility text to (keep other rows unchanged):

```markdown
| `canon-audit` | Semantic audit vs inventory; Scout → Expand with visible working set + verdict before deep evidence reads (`validate` then `check` as Scout inputs); before merge, discover prior `source: skill` findings via `doc-canon report` and mark unreproduced ones stale by normalized `(kind, paths)`; resolve dialogue; discrepancy lifecycle |
```

Prefer applying this via `canon-write` if that skill is active in the session; otherwise apply the exact row above under this approved plan.

- [ ] **Step 2: Validate canon**

Run: `node bin/doc-canon.js validate`

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/canon/SKILLS.md
git commit -m "$(cat <<'EOF'
docs: note canon-audit report discovery in SKILLS

EOF
)"
```

---

### Task 4: Bump skills_stamp and full verify

**Files:**
- Modify: `src/version.ts` (`SKILLS_STAMP`)
- Modify: `docs/canon/CANON_CONTRACT.md` (`skills_stamp`)
- Test: `npm test`, `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: managed skill change from Tasks 2–3
- Produces: `SKILLS_STAMP` / contract stamp `"0.7.0"` so `upgrade-skills` delivers the skill

- [ ] **Step 1: Bump stamp constants**

In `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.7.0";
```

Leave `MIN_SKILLS_STAMP = "0.1.0"`.

In `docs/canon/CANON_CONTRACT.md` machine YAML, set:

```yaml
skills_stamp: "0.7.0"
```

- [ ] **Step 2: Full verify**

Run:

```bash
npm test
node bin/doc-canon.js validate
```

Expected: all tests PASS; validate exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "$(cat <<'EOF'
chore: bump skills_stamp to 0.7.0 for audit stale discovery

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| `doc-canon report` before merge | Task 2 |
| Stale when unreproduced | Task 2 |
| Match on `(kind, paths)` | Task 2 |
| Preserve `source: cli` RMW | Task 2 |
| Keep `F-NNN` on match / new id otherwise | Task 2 |
| Living `SKILLS.md` short phrase | Task 3 |
| Asset phrase test | Task 1–2 |
| `skills_stamp` bump | Task 4 |
| No CLI / schema | Global Constraints |

No placeholders. Exact prose and commands included.
