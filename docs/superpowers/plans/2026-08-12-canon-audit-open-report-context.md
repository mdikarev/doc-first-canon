# Canon-audit open-report LLM context Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach `canon-audit` to keep Scout / Expand / semantic deep-read on **open** findings only, while still using the full report at merge for stale/`F-NNN` matching—so LLM context stays lean without pruning disk.

**Architecture:** Guidance-only. Add an open-context subsection to managed `canon-audit`, mirror into `.cursor/skills`, sync a short phrase in living `docs/canon/SKILLS.md`, optionally note the discipline in acceptance scenarios, lock phrases in `tests/embedded-assets.test.ts`, bump `skills_stamp`. No CLI, schema, or prune changes.

**Tech Stack:** Markdown skill/canon/acceptance assets, TypeScript `node:test` string assertions, existing `doc-canon validate`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-12-canon-audit-open-report-context-design.md`. On conflict with living canon, escalate—do not silently pick a side.
- **No prune** of `status: stale` on disk; keep “do not delete”.
- **No new CLI** (including `report --status open`) / schema / merge algorithm changes.
- Report ownership merge remains: full `doc-canon report` after semantic pass; match on normalized `(kind, paths)`; preserve `source: cli` on RMW.
- Bump `SKILLS_STAMP` to `"0.10.0"` when managed assets change; leave `MIN_SKILLS_STAMP` at `"0.1.0"`; sync `docs/canon/CANON_CONTRACT.md` `skills_stamp`.
- Mirror every edited embedded skill into `.cursor/skills/`.
- Living `docs/canon/SKILLS.md` updates: prefer `canon-write` (canon-first); if implementing inside this repo’s plan session with an approved plan, apply the exact prose in the task.
- TDD: failing test → implement → pass → commit per task (commit only when the user asks, or when executing this plan with explicit commit steps approved for the session).
- Before claiming done: `npm test` and `node bin/doc-canon.js validate` (repo root).

---

## File Structure

```text
tests/embedded-assets.test.ts                 # Assert open-context + merge phrases
embedded/skills/canon-audit/SKILL.md          # Open findings for LLM context subsection
.cursor/skills/canon-audit/SKILL.md           # Mirror of embedded
docs/canon/SKILLS.md                          # Short open-context phrase on canon-audit row
docs/acceptance/skill-scenarios.md            # Optional checkbox under Canon-audit Scout Expand
src/version.ts                                # SKILLS_STAMP → "0.10.0"
docs/canon/CANON_CONTRACT.md                  # skills_stamp → "0.10.0"
```

No changes to `src/report/*`, CLI commands, or discrepancy lifecycle.

---

### Task 1: Failing asset assertions for open-report context

**Files:**
- Modify: `tests/embedded-assets.test.ts`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: `readEmbedded(...)`, existing `it("documents semantic audit merge and discrepancy lifecycle")`
- Produces: failing assertions that require open-context discipline phrases in `canon-audit`

- [ ] **Step 1: Extend the audit merge test**

In `tests/embedded-assets.test.ts`, inside `it("documents semantic audit merge and discrepancy lifecycle")`, keep all existing asserts and add:

```ts
assert.match(audit, /open findings|status: open/i);
assert.match(audit, /stale_skipped/);
assert.match(audit, /full report|doc-canon report.*merge|merge.*doc-canon report/i);
assert.match(audit, /Scout|Expand|semantic/i);
```

Full updated test body must still include the existing matches for `doc-canon check`, `source: skill`, `source: cli`, `read-modify-write`, `status: stale`, structure/consistency / DISCREPANCIES, apply→decision→Resolved, `docs_stale`, `code_stale`, `doc-canon report`, kind/paths, and unreproduced/no match.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/embedded-assets.test.ts`

Expected: FAIL on `stale_skipped` and/or open-findings assertion because current skill lacks the open-context subsection.

- [ ] **Step 3: Commit the failing test** (when commits are authorized for this session)

```bash
git add tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
test: require canon-audit open-report LLM context discipline

EOF
)"
```

---

### Task 2: Add Open findings for LLM context to canon-audit

**Files:**
- Modify: `embedded/skills/canon-audit/SKILL.md`
- Modify: `.cursor/skills/canon-audit/SKILL.md` (identical mirror)
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: protocol from the design spec
- Produces: skill text that satisfies Task 1 assertions without weakening Report ownership

- [ ] **Step 1: Insert subsection immediately before `## Report ownership`**

In both `embedded/skills/canon-audit/SKILL.md` and `.cursor/skills/canon-audit/SKILL.md`, insert this block **immediately before** the existing `## Report ownership` heading. Do **not** change the Report ownership numbered list or the following `structure` / `consistency` paragraph.

```markdown
## Open findings for LLM context

During Scout → Expand → semantic deep-read, keep report evidence in the model context to **open** findings only (`status: open`, both `source: cli` and `source: skill`). Do not paste or paraphrase `status: stale` finding bodies into the reasoning transcript. A single compact note is allowed: `stale_skipped: N` (count only). Prefer filtering `doc-canon report` / report JSON to an open-only view for judgement; do not `Read` the full `.doc-canon/report.json` just to “understand the picture.”

After write-back, when summarizing to the user, default to open findings; mention stale only as a count or if the user asks.

Full `doc-canon report` (all statuses) is still required at the merge step under **Report ownership**—open filtering must not skip prior skill discovery or stale marking.
```

Leave Audit flow steps 1–8 unchanged (including deep-read of report when approved in the working set—those deep-reads must still apply the open filter above).

- [ ] **Step 2: Run asset tests to verify they pass**

Run: `node --import tsx --test tests/embedded-assets.test.ts`

Expected: PASS (including the new open-context asserts).

- [ ] **Step 3: Commit** (when commits are authorized)

```bash
git add embedded/skills/canon-audit/SKILL.md .cursor/skills/canon-audit/SKILL.md
git commit -m "$(cat <<'EOF'
feat: keep canon-audit LLM context on open findings only

EOF
)"
```

---

### Task 3: Sync living SKILLS.md

**Files:**
- Modify: `docs/canon/SKILLS.md` (Responsibilities table, `canon-audit` row)
- Test: `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: short open-context phrase from the design spec
- Produces: living SoT that mentions open findings for audit context and full report at merge

- [ ] **Step 1: Update the canon-audit responsibility cell**

In `docs/canon/SKILLS.md`, replace the `canon-audit` row with (keep other rows unchanged):

```markdown
| `canon-audit` | Semantic audit vs inventory; Scout → Expand with visible working set + verdict before deep evidence reads (`validate` then `check` as Scout inputs); keep LLM context on open findings only (`stale_skipped: N`); before merge, discover prior `source: skill` findings via full `doc-canon report` and mark unreproduced ones stale by normalized `(kind, paths)`; resolve dialogue; discrepancy lifecycle |
```

Prefer applying this via `canon-write` if that skill is active in the session; otherwise apply the exact row above under this approved plan.

- [ ] **Step 2: Validate canon**

Run: `node bin/doc-canon.js validate`

Expected: exit 0.

- [ ] **Step 3: Commit** (when commits are authorized)

```bash
git add docs/canon/SKILLS.md
git commit -m "$(cat <<'EOF'
docs: note open-report LLM context in SKILLS canon-audit row

EOF
)"
```

---

### Task 4: Acceptance scenario checkbox (optional note from spec)

**Files:**
- Modify: `docs/acceptance/skill-scenarios.md` (section `## Canon-audit Scout Expand Execute before deep reads`)
- Test: `tests/embedded-assets.test.ts` (existing scenario title list unchanged)

**Interfaces:**
- Consumes: open-context discipline from Task 2
- Produces: manual acceptance checkbox that audit must not deep-read stale bodies for the semantic pass

- [ ] **Step 1: Add one checkbox**

Under `## Canon-audit Scout Expand Execute before deep reads`, after the existing bullets, append:

```markdown
- [ ] Confirm report evidence used for Scout / Expand / semantic judgement is open findings only (stale bodies not deep-read; `stale_skipped: N` count is enough).
```

Do not rename the section heading (embedded-assets locks the title string).

- [ ] **Step 2: Run the scenarios title test**

Run: `node --import tsx --test tests/embedded-assets.test.ts`

Expected: PASS (title list unchanged).

- [ ] **Step 3: Commit** (when commits are authorized)

```bash
git add docs/acceptance/skill-scenarios.md
git commit -m "$(cat <<'EOF'
docs: accept open-only report context for canon-audit Scout

EOF
)"
```

---

### Task 5: Bump skills_stamp and full verify

**Files:**
- Modify: `src/version.ts` (`SKILLS_STAMP`)
- Modify: `docs/canon/CANON_CONTRACT.md` (`skills_stamp`)
- Test: `npm test`, `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: managed skill change from Tasks 2–4
- Produces: `SKILLS_STAMP` / contract stamp `"0.10.0"` so `upgrade-skills` delivers the skill

- [ ] **Step 1: Bump stamp constants**

In `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.10.0";
```

Leave `MIN_SKILLS_STAMP = "0.1.0"`.

In `docs/canon/CANON_CONTRACT.md` machine YAML, set:

```yaml
skills_stamp: "0.10.0"
```

- [ ] **Step 2: Full verify**

Run:

```bash
npm test
node bin/doc-canon.js validate
```

Expected: all tests PASS; validate exit 0.

- [ ] **Step 3: Commit** (when commits are authorized)

```bash
git add src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "$(cat <<'EOF'
chore: bump skills_stamp to 0.10.0 for open-report context

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Open-only for Scout / Expand / semantic deep-read | Task 2 |
| `stale_skipped: N` | Task 2 |
| Full report only at merge / Report ownership unchanged | Task 2 |
| Do not delete stale; no CLI/schema | Global Constraints |
| Discourage full `Read` of report.json for “picture” | Task 2 |
| User summary defaults to open | Task 2 |
| Living `SKILLS.md` short phrase | Task 3 |
| Asset phrase test | Task 1–2 |
| Optional acceptance note | Task 4 |
| `skills_stamp` bump | Task 5 |

No placeholders. Exact prose and commands included.
