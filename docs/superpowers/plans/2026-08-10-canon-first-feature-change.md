# Canon-First Feature-Change Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the canon-first feature-change order (canon via `canon-write` → optional local spec/plan → code) in managed pointer/`AGENTS`/`canon-write`, living canon, usage flows, and acceptance—without a new CLI or skill.

**Architecture:** Guidance-only change. Always-on pointer and `AGENTS` state the order, exceptions, no self-edit of canon, and substantial wait-gate. `canon-write` gets a short pre-code invocation note. Living canon documents dual cycles (feature change vs post-hoc vs `code_stale`). Usage-flows add a Feature journey; asset tests lock marker phrases; bump `skills_stamp` to `0.5.0`.

**Tech Stack:** Markdown skill/rule/AGENTS assets, living canon markdown, TypeScript `node:test` string assertions, existing `doc-canon validate`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-10-canon-first-feature-change-design.md`. On conflict, escalate—do not silently pick a side.
- **No new CLI** and **no new managed skill**.
- Do **not** mandate `docs/superpowers/specs/` (or any fixed path) in target repos; spec/plan step is optional and project-local.
- Canon skills never patch application code (unchanged).
- Coding agents must not edit `docs/canon/**` themselves; they invoke `canon-write` (or ask the user to run it).
- Bump `SKILLS_STAMP` to `"0.5.0"` when managed assets change; leave `MIN_SKILLS_STAMP` at `"0.1.0"`; sync `docs/canon/CANON_CONTRACT.md` `skills_stamp`.
- Mirror every edited embedded skill/rule into `.cursor/skills/` / `.cursor/rules/`; sync root `AGENTS.md` managed block with `embedded/agents/AGENTS.block.md`.
- TDD: failing test → implement → pass → commit per task.
- Before claiming done: `npm test` and `node bin/doc-canon.js validate` (repo root).

---

## File Structure

```text
tests/embedded-assets.test.ts                 # Assert canon-first markers + acceptance title
embedded/rules/doc-canon.mdc                  # Feature-change order for all agents
.cursor/rules/doc-canon.mdc                   # Mirror of embedded
embedded/agents/AGENTS.block.md               # Same order (concise)
AGENTS.md                                     # Sync managed block from embedded
embedded/skills/canon-write/SKILL.md          # Pre-code invocation cross-link
.cursor/skills/canon-write/SKILL.md           # Mirror of embedded
docs/canon/SKILLS.md                          # Dual cycles + pointer obligations
docs/canon/ARCHITECTURE.md                    # Key flow “Feature change”
docs/canon/GLOSSARY.md                        # Feature-change order / canon-first term
docs/guides/usage-flows.md                    # New EN+RU Feature journey; Day-to-day = post-hoc
docs/acceptance/skill-scenarios.md            # New scenario + pointer bullet
src/version.ts                                # SKILLS_STAMP → "0.5.0"
docs/canon/CANON_CONTRACT.md                  # skills_stamp → "0.5.0"
```

No CLI command or contract schema changes. Bootstrap/audit/contract skill bodies unchanged except via shared stamp.

---

### Task 1: Failing assertions for canon-first order

**Files:**
- Modify: `tests/embedded-assets.test.ts`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: `readEmbedded(...)`, existing `describe("managed agent assets")`
- Produces: failing tests that lock canon-first phrases in rule, AGENTS block, `canon-write`, and a new acceptance scenario title

- [ ] **Step 1: Add canon-first assertion tests**

In `tests/embedded-assets.test.ts`, after `"documents working-set discipline in pointer rule and AGENTS block"`, add:

```ts
it("documents canon-first feature-change order in pointer, AGENTS, and canon-write", () => {
  const rule = readEmbedded("rules", "doc-canon.mdc");
  assert.match(rule, /canon-write/i);
  assert.match(rule, /feature|behavior|functional/i);
  assert.match(
    rule,
    /canon.*(?:first|before).*code|before.*(?:application )?code|then.*code/i,
  );
  assert.match(rule, /optional.*(?:spec|plan)|spec\/plan|design\/plan/i);
  assert.match(rule, /code_stale/i);
  assert.match(rule, /substantial/i);
  assert.match(
    rule,
    /(?:do not|never|must not).*(?:edit|modify).*docs\/canon|invoke.*canon-write|through.*canon-write/i,
  );

  const block = readEmbedded("agents", "AGENTS.block.md");
  assert.match(block, /canon-write/i);
  assert.match(
    block,
    /canon.*(?:first|before).*code|before.*(?:application )?code|then.*code/i,
  );

  const write = readEmbedded("skills", "canon-write", "SKILL.md");
  assert.match(
    write,
    /before.*(?:feature |application )?code|coding agents.*(?:invoke|call)|feature change/i,
  );
});
```

In `it("documents every MVP skill acceptance scenario")`, add this phrase to the list (keep all existing phrases):

```ts
"Feature-change order is canon-first",
```

Also extend `it("Pointer rule and AGENTS block after init")` coverage indirectly: in Step later acceptance file will add a bullet; for this task only the new scenario title is required in the phrase list.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: FAIL on the new `it` block and/or missing scenario phrase (text not present yet).

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
test: require canon-first feature-change order guidance

EOF
)"
```

---

### Task 2: Pointer rule and AGENTS block

**Files:**
- Modify: `embedded/rules/doc-canon.mdc`
- Modify: `.cursor/rules/doc-canon.mdc` (mirror)
- Modify: `embedded/agents/AGENTS.block.md`
- Modify: `AGENTS.md` (managed block only)
- Test: `tests/embedded-assets.test.ts` (partial pass for rule/AGENTS assertions)

**Interfaces:**
- Consumes: marker expectations from Task 1
- Produces: always-on guidance stating feature-change order, exceptions, no self-edit, substantial wait

- [ ] **Step 1: Rewrite embedded pointer rule**

Replace the body of `embedded/rules/doc-canon.mdc` (keep frontmatter) with:

```markdown
---
description: Use the project canon as agent context
alwaysApply: true
---

# doc-canon context rule

For design and development, the context source of truth is `docs/canon/`. Start with `docs/canon/INDEX.md`, select only relevant indexed sections, and build a small **working set** before deep reads. If the working set is doubtful, **expand**; do not silently under-read or invent structure to save tokens. Do not preload the entire canon.

`docs/canon/future_plans/` is part of the canon for **future system shape** (initiatives). It is not the behavioral source of truth for current behavior. Do not store development tasks, checklists, or coding-agent prompts there; use roadmap/issues/`DISCREPANCIES.md` for execution work. After an initiative is realized, absorb outcomes into living canon sections.

## Feature-change order (canon-first)

For **new or changed functionality** (behavior / public contract), do **not** start application code first. Order:

1. Update living canon via **`canon-write`** (invoke the skill, or stop and ask the user to run it). Coding agents must **not** edit `docs/canon/**` themselves.
2. Optionally write or sync a **project-local** design/plan artifact when the change is large (multi-module, non-obvious design, or handoff). Do not assume a fixed path such as `docs/superpowers/specs/`.
3. After a **substantial** canon change, wait for explicit user go-ahead before coding. After a spot section sync, you may proceed.
4. Implement application code against the updated canon (and optional plan).

**Exceptions** (skip canon-first): pure bugfix with intended behavior unchanged; `code_stale` (canon already correct); non-behavioral edits (typos, tests, refactor without contract change).

Post-hoc sync (`canon-write` / `check` / `canon-audit` after drift) remains valid and does not replace this order for intentional feature work. Coding agents follow working-set discipline without a mandatory chat ritual of listing the set every turn.

On docs↔code divergence, do not silently pick a side. Present the evidence and escalate through the canon skills and `docs/canon/DISCREPANCIES.md`. Canon skills never modify application code.

This rule sets context priority; it does not replace other domain rules in the repository.
```

- [ ] **Step 2: Update AGENTS managed block**

Replace `embedded/agents/AGENTS.block.md` with:

```markdown
<!-- doc-canon:start -->
## doc-canon
For design and development, treat `docs/canon/` as the context source of truth. Start at `docs/canon/INDEX.md`, build a small working set, and expand if unsure before deep reads—without inventing structure. `docs/canon/future_plans/` holds directional initiatives for future system shape, not development tasks or checklists. For new or changed behavior, follow **canon-first**: update living canon via `canon-write` (do not edit `docs/canon/**` yourself) → optional project-local spec/plan if large → after substantial canon changes wait for user go-ahead → then application code. Exceptions: pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits. On docs↔code divergence, do not silently pick a side; use canon skills / `DISCREPANCIES.md`.
<!-- doc-canon:end -->
```

Sync the same block into root `AGENTS.md` between the existing markers (preserve any content outside markers).

- [ ] **Step 3: Mirror the rule**

Copy `embedded/rules/doc-canon.mdc` to `.cursor/rules/doc-canon.mdc`.

- [ ] **Step 4: Run tests (expect partial fail on canon-write / acceptance)**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: rule/AGENTS assertions in the new `it` pass; `canon-write` and/or acceptance title assertions may still fail.

- [ ] **Step 5: Commit**

```bash
git add embedded/rules/doc-canon.mdc .cursor/rules/doc-canon.mdc \
  embedded/agents/AGENTS.block.md AGENTS.md
git commit -m "$(cat <<'EOF'
feat: teach canon-first feature-change order in pointer and AGENTS

EOF
)"
```

---

### Task 3: canon-write pre-code cross-link

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`
- Modify: `.cursor/skills/canon-write/SKILL.md` (mirror)
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: Task 1 write-skill regex; existing Scout/Clarify/Workflow sections
- Produces: short note that coding agents invoke this skill before feature code

- [ ] **Step 1: Add cross-link after Safety section**

In `embedded/skills/canon-write/SKILL.md`, immediately after the **Safety and source of truth** bullet list (before **Scout → Expand before deep reads**), insert:

```markdown
## Called before feature code

Coding agents updating **behavior or public contract** must invoke this skill (or ask the user to run it) **before** application-code changes for that feature. They must not edit `docs/canon/**` themselves. After a **substantial** write, the coding agent should wait for explicit user go-ahead before implementing; spot sync may proceed. Pure bugfix / `code_stale` / non-behavioral work are exceptions to that canon-first order (see pointer rule).
```

Do not rewrite Scout/Clarify/Workflow; keep all existing gates.

- [ ] **Step 2: Mirror skill**

Copy `embedded/skills/canon-write/SKILL.md` to `.cursor/skills/canon-write/SKILL.md`.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: the new `it("documents canon-first...")` passes for write/rule/AGENTS; acceptance title phrase may still fail until Task 5.

- [ ] **Step 4: Commit**

```bash
git add embedded/skills/canon-write/SKILL.md .cursor/skills/canon-write/SKILL.md
git commit -m "$(cat <<'EOF'
feat: note canon-write is invoked before feature code

EOF
)"
```

---

### Task 4: Living canon dual cycles

**Files:**
- Modify: `docs/canon/SKILLS.md`
- Modify: `docs/canon/ARCHITECTURE.md`
- Modify: `docs/canon/GLOSSARY.md`
- Test: `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: dual-cycle table and terminology from the design spec
- Produces: SoT prose for feature-change vs post-hoc vs `code_stale`

- [ ] **Step 1: Update SKILLS.md**

In **Current state** or **Responsibilities**, add that coding agents follow feature-change order via the pointer (canon-first through `canon-write`); keep existing Scout/Expand/clarify text.

Update the `canon-write` table row to mention it is also invoked **before feature code** for behavior/contract changes (not only everyday sync).

Update the pointer / `AGENTS.md` bullet to include canon-first feature-change order, exceptions, and no self-edit of canon.

Suggested pointer bullet replacement:

```markdown
Pointer rule / `AGENTS.md`: always-on context priority — start at `docs/canon/INDEX.md`; build a small working set and expand if unsure before deep reads (no mandatory chat ritual); for new/changed behavior use **canon-first** (`canon-write` → optional project-local spec/plan → code; substantial canon waits for user go-ahead; coding agents do not edit canon themselves); escalate docs↔code divergence; do not silently pick a side.
```

- [ ] **Step 2: Update ARCHITECTURE.md Key flows**

Insert a new numbered flow (renumber as needed) after Bootstrap / before or beside Everyday sync:

```markdown
N. **Feature change** — intentional new/changed behavior: coding agents invoke `canon-write` first (they do not edit `docs/canon/**` themselves), optionally sync/write a project-local design/plan when large, wait after substantial canon edits for user go-ahead, then implement application code. Distinct from post-hoc everyday sync and from `code_stale` coding tasks.
```

Keep Everyday sync wording as post-hoc after meaningful changes.

- [ ] **Step 3: Add GLOSSARY term**

After **Expand gate** (or near **code_stale**), add:

```markdown
### Feature-change order (canon-first)
For intentional new or changed behavior: update living canon via `canon-write` first, optionally write/sync a project-local design/plan when the change is large, wait for user go-ahead after substantial canon edits, then implement application code. Exceptions: pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits. Distinct from post-hoc everyday sync.
```

- [ ] **Step 4: Validate**

Run: `node bin/doc-canon.js validate`

Expected: success / exit 0.

- [ ] **Step 5: Commit**

```bash
git add docs/canon/SKILLS.md docs/canon/ARCHITECTURE.md docs/canon/GLOSSARY.md
git commit -m "$(cat <<'EOF'
docs: document canon-first dual cycles in living canon

EOF
)"
```

---

### Task 5: Usage flows and acceptance scenarios

**Files:**
- Modify: `docs/guides/usage-flows.md`
- Modify: `docs/acceptance/skill-scenarios.md`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: acceptance title `"Feature-change order is canon-first"` from Task 1
- Produces: EN+RU Feature journey; Day-to-day clarified as post-hoc; human checklist

- [ ] **Step 1: Add Feature / behavior change journey (EN)**

In `docs/guides/usage-flows.md`, after **Existing project** and before **Day-to-day**, insert an English section:

```markdown
## Feature / behavior change

**When to use:** Intentional new or changed application behavior / public contract in a bootstrapped repo.

**CLI vs skill:** Living canon updates go through **`canon-write`**. Coding agents must not edit `docs/canon/**` themselves. Optional design/plan artifacts live outside the canon at a **project-chosen** path (not mandated by doc-canon).

### Steps

1. Classify exceptions: pure bugfix with intended behavior unchanged; Open `code_stale` task; non-behavioral edits — those skip this order.
2. Run **`canon-write`** so living canon reflects the desired behavior; confirm `doc-canon validate` passes under the skill.
3. If the change is large (multi-module, non-obvious design, or handoff), write or sync a project-local design/plan from the updated canon; otherwise skip.
4. After a **substantial** canon change, wait for explicit user go-ahead before coding; after spot sync, proceed.
5. Implement application code and tests against the canon (and optional plan).
6. If docs↔code drift appears, use **`canon-audit`** / `DISCREPANCIES.md` — do not silently pick a side.

### Common mistakes

- Coding the feature first and treating canon as optional cleanup.
- Editing `docs/canon/**` from a coding agent instead of invoking `canon-write`.
- Skipping the wait-gate after substantial SoT changes.
```

In **Day-to-day**, add one sentence that this journey is **post-hoc sync** after meaningful edits and does not replace **Feature / behavior change** for intentional work.

- [ ] **Step 2: Mirror the same section in RU**

Under `# Usage flows (RU)`, insert the Russian equivalent of the Feature section in the same relative place, and the same Day-to-day clarification.

- [ ] **Step 3: Acceptance scenarios**

In `docs/acceptance/skill-scenarios.md`:

1. Under **Pointer rule and AGENTS block after init**, add:

```markdown
- [ ] Confirm the pointer rule / `AGENTS` block state canon-first feature-change order (`canon-write` before application code; optional project-local spec/plan; substantial wait; coding agents do not edit canon themselves).
```

2. Add a new section (near other agent-discipline scenarios):

```markdown
## Feature-change order is canon-first

- [ ] Request intentional new or changed application behavior in a bootstrapped repo.
- [ ] Confirm the coding agent invokes **`canon-write`** (or asks the user to) and does **not** edit `docs/canon/**` itself before feature code.
- [ ] Confirm optional project-local design/plan is used only when the change is large; small unambiguous changes may go canon → code.
- [ ] Confirm that after a **substantial** canon write the agent waits for explicit user go-ahead before implementing; spot sync may proceed.
- [ ] Confirm exceptions (pure bugfix with intended behavior unchanged, `code_stale`, non-behavioral edits) may skip canon-first.
```

- [ ] **Step 4: Run asset tests**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: PASS (including new `it` and acceptance title).

- [ ] **Step 5: Commit**

```bash
git add docs/guides/usage-flows.md docs/acceptance/skill-scenarios.md
git commit -m "$(cat <<'EOF'
docs: add feature-change journey and acceptance scenario

EOF
)"
```

---

### Task 6: Bump skills_stamp and full verify

**Files:**
- Modify: `src/version.ts`
- Modify: `docs/canon/CANON_CONTRACT.md`
- Test: `npm test`; `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: all prior managed-asset edits
- Produces: `SKILLS_STAMP` / contract stamp `"0.5.0"` so `upgrade-skills` delivers the rule

- [ ] **Step 1: Bump stamp**

In `src/version.ts`, set:

```ts
export const SKILLS_STAMP = "0.5.0";
```

Leave `MIN_SKILLS_STAMP = "0.1.0"`.

In `docs/canon/CANON_CONTRACT.md` machine YAML, set `skills_stamp: "0.5.0"`.

- [ ] **Step 2: Full test + validate**

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
chore: bump skills_stamp to 0.5.0 for canon-first order

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Canon → optional spec/plan → code | Tasks 2–5 |
| Product + this repo (managed assets + living canon) | Tasks 2–5 |
| Coding agents do not edit canon; use `canon-write` | Tasks 2–3 |
| Substantial wait; spot sync may proceed | Tasks 2–3, 5 |
| Dual cycles incl. post-hoc and `code_stale` | Tasks 2, 4–5 |
| Pointer/`AGENTS`/`canon-write`/SKILLS/ARCHITECTURE/GLOSSARY/usage-flows/acceptance | Tasks 2–5 |
| Asset tests + `skills_stamp` bump | Tasks 1, 6 |
| No new CLI/skill; no mandated superpowers path | Global Constraints; Task 2 prose |

## Placeholder / consistency check

- No TBD/TODO steps; full rule/`AGENTS`/skill/usage/acceptance prose included.
- Stamp value `"0.5.0"` consistent across Task 6 and Global Constraints.
- Acceptance title string matches Task 1 phrase list exactly: `Feature-change order is canon-first`.
