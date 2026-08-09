# Canon-write Clarify-Before-Invent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach `canon-write` to clarify ambiguous substantial SoT writes with up to three one-at-a-time MCQs (options + recommended answer), skipping when the request is already unambiguous.

**Architecture:** Skill-only change. Encode the clarify protocol in `embedded/skills/canon-write/SKILL.md`, mirror into `.cursor/skills/`, bump `SKILLS_STAMP`, assert content via `tests/embedded-assets.test.ts`, and sync living canon `SKILLS.md` plus human acceptance scenarios. No CLI behavior, contract schema, or template changes.

**Tech Stack:** Markdown skill assets, TypeScript `node:test` assertions, existing `doc-canon validate` for living canon.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-canon-write-clarify-design.md` — if this plan conflicts, escalate; do not silently diverge.
- Skill-only: do **not** change CLI commands, `CANON_CONTRACT` section kinds, or templates for this feature.
- Clarify is for **substantial** writes; skip when the user request already resolves ambiguity.
- Questions: **one at a time**, **A/B/C** (+ optional D), **recommended** option + one-sentence why, **cap 3**.
- Docs↔code “which side stale?” stays; use the same MCQ+recommendation format; counts toward the 3 in the same pre-write gate.
- On “just pick” / no choice: take the recommendation, state that, write.
- Clarify does **not** replace `canon-contract` handoff for structural changes.
- Bump `SKILLS_STAMP` when managed skill content changes (target `"0.3.0"`); leave `MIN_SKILLS_STAMP` at `"0.1.0"`.
- Sync this repo’s living `docs/canon/CANON_CONTRACT.md` `skills_stamp` to match the package stamp after the bump.
- TDD: failing test → implement → pass → commit per task.
- Run `npm test` and `node bin/doc-canon.js validate` (from repo root) before claiming done.
- Everyday sync / prose-quality expansions are **out of scope** (separate specs).

---

## File Structure

```text
embedded/skills/canon-write/SKILL.md          # Modify: Clarify protocol + Workflow step
.cursor/skills/canon-write/SKILL.md           # Modify: keep identical to embedded
src/version.ts                                # Modify: SKILLS_STAMP → "0.3.0"
docs/canon/CANON_CONTRACT.md                  # Modify: skills_stamp → "0.3.0"
docs/canon/SKILLS.md                          # Modify: canon-write responsibility row / invariants
docs/acceptance/skill-scenarios.md            # Modify: clarify scenarios
tests/embedded-assets.test.ts                 # Modify: assert clarify protocol + scenario titles
```

---

### Task 1: Failing assertions for clarify protocol

**Files:**
- Modify: `tests/embedded-assets.test.ts`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: `readEmbedded("skills", "canon-write", "SKILL.md")`, existing `describe("managed agent assets")`
- Produces: failing tests that require clarify protocol phrases in `canon-write` and a new acceptance-scenario heading in `docs/acceptance/skill-scenarios.md`

- [ ] **Step 1: Extend embedded-assets tests**

In `tests/embedded-assets.test.ts`, add a new `it` block after `"documents bootstrap and writing workflows"`:

```ts
it("documents canon-write clarify-before-invent protocol", () => {
  const write = readEmbedded("skills", "canon-write", "SKILL.md");
  assert.match(write, /Clarify before substantial writes/i);
  assert.match(write, /substantial/i);
  assert.match(write, /skip/i);
  assert.match(write, /one (?:question )?at a time|one at a time/i);
  assert.match(write, /recommend/i);
  assert.match(write, /A\/B\/C|multiple-choice|options/i);
  assert.match(write, /three|at most 3|cap of 3|up to 3/i);
  assert.match(write, /do not invent|without inventing|not invent/i);
});
```

Do **not** add the acceptance-scenario phrase here — that lands in Task 3 with the checklist heading.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: FAIL on `documents canon-write clarify-before-invent protocol` (skill text missing).

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
test: require canon-write clarify-before-invent guidance

Lock the MCQ clarify protocol phrases before skill text lands.
EOF
)"
```

---

### Task 2: Encode clarify protocol in managed `canon-write` skill + stamp bump

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`
- Modify: `.cursor/skills/canon-write/SKILL.md` (must match embedded byte-for-byte for this file’s body, or copy after edit)
- Modify: `src/version.ts` (`SKILLS_STAMP` → `"0.3.0"`)
- Modify: `docs/canon/CANON_CONTRACT.md` (`skills_stamp: "0.3.0"`)
- Test: `tests/embedded-assets.test.ts`, `tests/upgrade-skills.test.ts`, `tests/init.test.ts` (stamp consumers)

**Interfaces:**
- Consumes: protocol rules from the design spec
- Produces: skill text satisfying Task 1 regexes; package stamp `"0.3.0"` so `upgrade-skills` rewrites contracts to the new stamp

- [ ] **Step 1: Insert Clarify section into embedded skill**

Edit `embedded/skills/canon-write/SKILL.md` so that after the **Safety and source of truth** section and before **Workflow**, add:

```markdown
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
```

- [ ] **Step 2: Add an early Workflow step**

In the same file, renumber Workflow so the first step is:

```markdown
1. Apply **Clarify before substantial writes** before drafting substantial SoT changes. Do not invent facts to fill gaps.
```

Shift existing steps 1–9 to 2–10. Keep their wording; only renumber. Ensure step that mentions docs↔code still says to ask which side is stale (clarify section already governs format/cap).

Final Workflow should still include: read INDEX/contract/templates; author from templates; handoff to contract for new kinds; everyday sync; never edit application code / use `DISCREPANCIES.md`; `future_plans` directional rules; absorb when done; `doc-canon validate`; docs_stale vs code_stale resolution rules.

- [ ] **Step 3: Mirror into `.cursor/skills/canon-write/SKILL.md`**

Copy the full contents of `embedded/skills/canon-write/SKILL.md` over `.cursor/skills/canon-write/SKILL.md` so they match.

- [ ] **Step 4: Bump skills stamp**

In `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.3.0";
```

Leave `MIN_SKILLS_STAMP` as `"0.1.0"`.

In `docs/canon/CANON_CONTRACT.md` machine YAML, set:

```yaml
skills_stamp: "0.3.0"
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/embedded-assets.test.ts tests/upgrade-skills.test.ts tests/init.test.ts`

Expected: PASS (clarify protocol `it` green; stamp consumers green).

- [ ] **Step 6: Commit skill + stamp**

```bash
git add embedded/skills/canon-write/SKILL.md .cursor/skills/canon-write/SKILL.md \
  src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "$(cat <<'EOF'
feat: add clarify-before-invent protocol to canon-write

Gate substantial SoT edits behind short MCQ clarify with recommendations; bump skills_stamp to 0.3.0.
EOF
)"
```

---

### Task 3: Living canon + acceptance scenarios

**Files:**
- Modify: `docs/canon/SKILLS.md`
- Modify: `docs/acceptance/skill-scenarios.md`
- Test: `tests/embedded-assets.test.ts` (scenario phrase list), `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: clarify protocol already in skill
- Produces: SoT description of write clarify behavior; human checklist covering ask + skip paths; scenario title locked in tests; green full test + validate

- [ ] **Step 1: Add failing scenario-title assertion**

In `tests/embedded-assets.test.ts`, inside `it("documents every MVP skill acceptance scenario")`, add this phrase to the list (keep existing phrases):

```ts
"Canon-write clarifies before substantial writes",
```

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: FAIL — heading missing from `docs/acceptance/skill-scenarios.md`.

- [ ] **Step 2: Update `docs/canon/SKILLS.md`**

Change the `canon-write` table row to:

```markdown
| `canon-write` | Author/refactor canon prose and everyday sync of affected sections; before substantial SoT writes, clarify when ambiguous (one question at a time, A/B/C options, recommended answer, max 3) or skip when the request is already unambiguous; when writing `future_plans/**`, keep initiatives directional (not a task list) and follow the draft → refining → implementing → absorbed lifecycle |
```

Add under **Invariants** (after the existing validate bullet):

```markdown
- `canon-write` must not invent material facts for substantial edits: clarify (MCQ + recommendation) or skip only when the request already resolves ambiguity
```

Do not remove other responsibilities or open questions.

- [ ] **Step 3: Add acceptance scenarios**

In `docs/acceptance/skill-scenarios.md`, add a new section before **Check preserves skill findings**:

```markdown
## Canon-write clarifies before substantial writes

- [ ] Ask `canon-write` to make a substantial but ambiguous canon change (missing a material decision).
- [ ] Confirm it asks **one** clarifying question with **A/B/C** options and an explicit **recommended** answer before editing `docs/canon/**`.
- [ ] Answer the question; confirm it may ask at most two more (three total), still one at a time, then edits and runs `doc-canon validate` before claiming success.
- [ ] Ask `canon-write` for a substantial change that already includes the concrete facts/decision.
- [ ] Confirm it **skips** clarify (states briefly that it is unnecessary) and writes + validates without ritual questions.
```

Exact H2 title must be: `## Canon-write clarifies before substantial writes` so the Task 1 regex/phrase match succeeds.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test
node bin/doc-canon.js validate
```

Expected: all tests PASS; validate exits 0.

- [ ] **Step 5: Commit docs + scenario assertion**

```bash
git add docs/canon/SKILLS.md docs/acceptance/skill-scenarios.md tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
docs: document canon-write clarify gate in canon and acceptance

Describe MCQ clarify-before-invent for substantial writes and add human-run ask/skip scenarios.
EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Substantial-write clarify gate | Task 2 skill section + Workflow step |
| Skip when unambiguous | Task 2 Skip paragraph; Task 3 acceptance skip bullets |
| One-at-a-time, A/B/C, recommendation + why | Task 2 ask loop; Task 1 regexes; Task 3 checklist |
| Cap of 3 | Task 2; Task 1; Task 3 |
| Docs↔code ask format + counts toward 3 | Task 2 clarify section |
| “Just pick” → recommendation | Task 2 |
| No replace contract handoff | Task 2 last paragraph |
| Update embedded skill + cursor mirror | Task 2 |
| Update `SKILLS.md` | Task 3 |
| Acceptance scenarios ask + skip | Task 3 |
| No CLI/contract/template feature churn | Global Constraints; only `skills_stamp` bump in contract YAML |
| Stamp bump on managed skill change | Task 2 `0.3.0` |

No TBD/placeholder steps. Regexes in Task 1 align with headings/phrases written in Task 2; scenario title assertion is Task 3.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-09-canon-write-clarify.md`.
