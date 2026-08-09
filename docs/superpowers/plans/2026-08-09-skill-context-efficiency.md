# Skill Context Efficiency (P0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encode the dual-audience Scout → Expand → Execute recipe (quality-over-thrift) in managed `canon-write` / `canon-audit`, pointer rule / `AGENTS`, and living canon—without new CLI or packs.

**Architecture:** Guidance-only change. No new commands. Skills get explicit phases; write runs clarify-before-invent **after** Expand when invent-risk remains; skills briefly show working set + verdict in chat; coding agents get the same discipline via pointer/`AGENTS` without mandatory chatter. Assert via `tests/embedded-assets.test.ts`; human acceptance scenarios for write/audit gates.

**Tech Stack:** Markdown skill/rule/AGENTS assets, living canon markdown, TypeScript `node:test` string assertions, existing `doc-canon validate`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-09-skill-context-efficiency-design.md` aligned with `docs/canon/future_plans/p0-skill-context-efficiency.md`. On conflict, escalate—do not silently pick a side.
- **Quality over thrift:** expand when doubtful; never silently under-read or invent facts to save tokens.
- **No new CLI** / scout helpers / BM25 packs / AST / smart cache (P0b stays separate).
- **Clarify order (`canon-write`):** Scout → Expand first; clarify-before-invent only if invent-risk remains before substantial write.
- **Expand visibility:** managed skills briefly show path+stub working set + `sufficient`/`need more` (free-form); coding agents: no mandatory chat ritual.
- **Stub style:** free-form brevity; not a content digest; not a rigid one-line template.
- Canon skills never patch application code (unchanged).
- Bump `SKILLS_STAMP` to `"0.4.0"` when managed assets change; leave `MIN_SKILLS_STAMP` at `"0.1.0"`; sync `docs/canon/CANON_CONTRACT.md` `skills_stamp`.
- Mirror every edited embedded skill/rule into `.cursor/skills/` / `.cursor/rules/`; sync root `AGENTS.md` managed block with `embedded/agents/AGENTS.block.md`.
- TDD: failing test → implement → pass → commit per task.
- Before claiming done: `npm test` and `node bin/doc-canon.js validate` (repo root).

---

## File Structure

```text
tests/embedded-assets.test.ts                 # Assert recipe phrases + acceptance titles
embedded/skills/canon-write/SKILL.md          # Scout → Expand → [clarify] → Execute
.cursor/skills/canon-write/SKILL.md           # Mirror of embedded
embedded/skills/canon-audit/SKILL.md          # Phases + visible expand gate
.cursor/skills/canon-audit/SKILL.md           # Mirror of embedded
embedded/rules/doc-canon.mdc                  # Working-set / expand discipline for all agents
.cursor/rules/doc-canon.mdc                   # Mirror of embedded
embedded/agents/AGENTS.block.md               # Same discipline (guidance only)
AGENTS.md                                     # Sync managed block from embedded
src/version.ts                                # SKILLS_STAMP → "0.4.0"
docs/canon/CANON_CONTRACT.md                  # skills_stamp → "0.4.0"
docs/canon/SKILLS.md                          # Dual-audience recipe + write/audit phases
docs/canon/GLOSSARY.md                        # Working set, Scout, Expand gate
docs/canon/ARCHITECTURE.md                    # Short agent-layer progressive-disclosure note
docs/acceptance/skill-scenarios.md            # Write/audit gate scenarios; pointer bullets
docs/canon/future_plans/p0-skill-context-efficiency.md  # Status implementing → absorbed
docs/canon/future_plans/INDEX.md              # Status column sync
```

`CLI.md` unchanged. Bootstrap/contract skills: short note in `SKILLS.md` only (no full phased rewrite).

---

### Task 1: Failing assertions for Scout / Expand recipe

**Files:**
- Modify: `tests/embedded-assets.test.ts`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: `readEmbedded(...)`, existing `describe("managed agent assets")`
- Produces: failing tests that lock recipe phrases in write, audit, rule, AGENTS block, and two new acceptance scenario titles

- [ ] **Step 1: Add recipe assertion tests**

In `tests/embedded-assets.test.ts`, after `"documents canon-write clarify-before-invent protocol"`, add:

```ts
it("documents Scout Expand Execute recipe in write and audit skills", () => {
  const write = readEmbedded("skills", "canon-write", "SKILL.md");
  assert.match(write, /Scout/i);
  assert.match(write, /Expand/i);
  assert.match(write, /working set/i);
  assert.match(write, /sufficient|need more/i);
  assert.match(write, /after Expand|after.*Expand|following Expand/i);
  assert.match(write, /clarif/i);

  const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
  assert.match(audit, /Scout/i);
  assert.match(audit, /Expand/i);
  assert.match(audit, /working set/i);
  assert.match(audit, /sufficient|need more/i);
  assert.match(audit, /show|briefly|in chat/i);
});

it("documents working-set discipline in pointer rule and AGENTS block", () => {
  const rule = readEmbedded("rules", "doc-canon.mdc");
  assert.match(rule, /working set/i);
  assert.match(rule, /expand/i);
  assert.match(rule, /INDEX\.md/);

  const block = readEmbedded("agents", "AGENTS.block.md");
  assert.match(block, /working set/i);
  assert.match(block, /expand/i);
});
```

In `it("documents every MVP skill acceptance scenario")`, add these phrases to the list (keep all existing phrases):

```ts
"Canon-write Scout Expand Execute before deep reads",
"Canon-audit Scout Expand Execute before deep reads",
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: FAIL on the new `it` blocks and/or missing scenario phrases (recipe text and headings not present yet).

- [ ] **Step 3: Mark P0 implementing + commit failing tests**

In `docs/canon/future_plans/p0-skill-context-efficiency.md`, set `**Status:** implementing`.  
In `docs/canon/future_plans/INDEX.md` initiatives table, set Skill context efficiency status to `implementing`. Update the footer note if it still says “active design refinement”.

```bash
git add tests/embedded-assets.test.ts \
  docs/canon/future_plans/p0-skill-context-efficiency.md \
  docs/canon/future_plans/INDEX.md
git commit -m "$(cat <<'EOF'
test: require Scout Expand Execute skill and pointer guidance

Lock P0 recipe phrases and acceptance titles before asset text lands; mark P0 implementing.
EOF
)"
```

---

### Task 2: Encode Scout → Expand → [clarify] → Execute in `canon-write`

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`
- Modify: `.cursor/skills/canon-write/SKILL.md` (must match embedded)
- Test: `tests/embedded-assets.test.ts` (partial green for write phrases)

**Interfaces:**
- Consumes: clarify protocol already in skill; Task 1 write regexes
- Produces: skill body where Scout/Expand precede deep reads and clarify runs after Expand when invent-risk remains

- [ ] **Step 1: Rewrite Workflow and add Scout/Expand section**

Edit `embedded/skills/canon-write/SKILL.md` so that **after Safety** and **before Clarify**, insert:

```markdown
## Scout → Expand before deep reads

Before deep-reading canon file bodies or drafting substantial SoT changes:

1. **Progressive disclosure:** start at `docs/canon/INDEX.md`; select only relevant INDEX rows; do not preload the entire canon; open `CANON_CONTRACT.md` / templates only when structure, a new kind, or a write template is needed.
2. **Scout:** build a working-set manifest of `path`, `role`, and short free-form `stub` (why-in-set—not a content digest). Do not invent structure. Use `doc-canon check` inventory/report only when syncing against the tree/code.
3. **Expand gate:** briefly show the working set (paths + stubs) and a verdict **sufficient** or **need more** (which paths, why). Free-form brevity is fine. Doubt → expand; multiple expands are fine; silent under-read is not.
4. Only after **sufficient**, deep-read the approved set and continue the Workflow.
```

Keep the existing **Clarify before substantial writes** section body, but change its opening so order is explicit. Replace the first paragraph with:

```markdown
After Scout → Expand (and any further expands), before any **substantial** edit under `docs/canon/**` (new meaning, invariant change, behavioral claim, or non-trivial factual sync), apply this gate if invent-risk remains. Do **not** invent material facts to fill gaps. Do **not** run this gate before Scout.
```

Replace the entire **Workflow** section with:

```markdown
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
```

Preserve the YAML frontmatter and Safety section unchanged.

- [ ] **Step 2: Mirror into `.cursor/skills/canon-write/SKILL.md`**

Copy full contents of `embedded/skills/canon-write/SKILL.md` over `.cursor/skills/canon-write/SKILL.md`.

- [ ] **Step 3: Run write-focused checks**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: write-related matches in `documents Scout Expand Execute recipe…` pass; audit/rule/AGENTS/scenario assertions may still fail.

- [ ] **Step 4: Commit**

```bash
git add embedded/skills/canon-write/SKILL.md .cursor/skills/canon-write/SKILL.md
git commit -m "$(cat <<'EOF'
feat: add Scout Expand Execute phases to canon-write

Discover a working set and expand before deep reads; clarify only after Expand when invent-risk remains.
EOF
)"
```

---

### Task 3: Encode Scout → Expand → Execute in `canon-audit`

**Files:**
- Modify: `embedded/skills/canon-audit/SKILL.md`
- Modify: `.cursor/skills/canon-audit/SKILL.md`
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: Task 1 audit regexes; existing validate/check/report lifecycle text
- Produces: phased audit flow with visible expand gate before deep evidence reads

- [ ] **Step 1: Rewrite Audit flow with Scout/Expand**

Replace the **Audit flow** section in `embedded/skills/canon-audit/SKILL.md` with:

```markdown
## Audit flow

1. Run `doc-canon validate` first. If it fails, stop the semantic pass and repair structure through canon-write or the contract through canon-contract.
2. Run `doc-canon check` to refresh the language-agnostic inventory and CLI findings (Scout inputs).
3. **Scout:** from `INDEX.md`, contract, fresh inventory/report, and user intent, build a working-set manifest (`path`, `role`, short free-form `stub`). Include likely evidence paths for claims you will make. Do not preload every markdown file.
4. **Expand gate:** briefly show the working set (paths + stubs) and verdict **sufficient** or **need more** (which paths, why). Doubt → expand until claims can be evidence-backed. Free-form brevity; multiple expands are fine; silent under-read is not.
5. Only after **sufficient**, deep-read the approved set (inventory, report, canon, and code evidence paths). Do not rely on model memory.
6. Perform the semantic checks:
   - coverage of required contract paths and INDEX entries;
   - orphans, while recognizing the CLI already checks them;
   - glossary terms against inventory/text hits or explicit doc-only evidence;
   - architecture claims against inventory paths;
   - relative and Related-canon links;
   - doc↔doc conflicts only when supported by at least two cited passages.
   - Do not treat `future_plans` prose as the current behavioral SoT when judging docs↔code drift; it is directional canon for future system shape.
7. Every finding must cite canon paths and inventory/code paths, or explicitly say code is missing. Deduplicate normalized kind/path sets and honor all ignores.
```

Keep **Report ownership** and **Resolve dialogue and discrepancy lifecycle** sections unchanged (including the final validate sentence).

- [ ] **Step 2: Mirror into `.cursor/skills/canon-audit/SKILL.md`**

Copy full contents of embedded audit skill over the `.cursor` mirror.

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: write+audit recipe `it` passes; rule/AGENTS/scenario titles may still fail.

- [ ] **Step 4: Commit**

```bash
git add embedded/skills/canon-audit/SKILL.md .cursor/skills/canon-audit/SKILL.md
git commit -m "$(cat <<'EOF'
feat: add Scout Expand Execute phases to canon-audit

Require a visible working-set expand gate before deep evidence reads.
EOF
)"
```

---

### Task 4: Pointer rule + AGENTS working-set guidance

**Files:**
- Modify: `embedded/rules/doc-canon.mdc`
- Modify: `.cursor/rules/doc-canon.mdc`
- Modify: `embedded/agents/AGENTS.block.md`
- Modify: `AGENTS.md` (managed block only)
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: Task 1 pointer/AGENTS regexes
- Produces: dual-audience reading discipline without mandatory expand-gate chatter for coding agents

- [ ] **Step 1: Update embedded pointer rule**

Replace the body of `embedded/rules/doc-canon.mdc` (keep frontmatter `description` / `alwaysApply: true`) with:

```markdown
# doc-canon context rule

For design and development, the context source of truth is `docs/canon/`. Start with `docs/canon/INDEX.md`, select only relevant indexed sections, and build a small **working set** before deep reads. If the working set is doubtful, **expand**; do not silently under-read or invent structure to save tokens. Do not preload the entire canon.

`docs/canon/future_plans/` is part of the canon for **future system shape** (initiatives). It is not the behavioral source of truth for current behavior. Do not store development tasks, checklists, or coding-agent prompts there; use roadmap/issues/`DISCREPANCIES.md` for execution work. After an initiative is realized, absorb outcomes into living canon sections.

Before architectural or behavioral changes, consult the relevant canon sections. Coding agents may implement application changes, but must lean on the canon. Coding agents follow this reading discipline without a mandatory chat ritual of listing the working set every turn.

On docs↔code divergence, do not silently pick a side. Present the evidence and escalate through the canon skills and `docs/canon/DISCREPANCIES.md`. Canon skills never modify application code.

This rule sets context priority; it does not replace other domain rules in the repository.
```

- [ ] **Step 2: Update AGENTS block**

Replace `embedded/agents/AGENTS.block.md` with:

```markdown
<!-- doc-canon:start -->
## doc-canon
For design and development, treat `docs/canon/` as the context source of truth. Start at `docs/canon/INDEX.md`, build a small working set, and expand if unsure before deep reads—without inventing structure. `docs/canon/future_plans/` holds directional initiatives for future system shape, not development tasks or checklists. On docs↔code divergence, do not silently pick a side; use canon skills / `DISCREPANCIES.md`.
<!-- doc-canon:end -->
```

Sync root `AGENTS.md` so the managed block matches `embedded/agents/AGENTS.block.md` exactly (preserve any content outside markers if present; currently the file is markers-only).

- [ ] **Step 3: Mirror rule into `.cursor/rules/doc-canon.mdc`**

Copy embedded rule over `.cursor/rules/doc-canon.mdc`.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: recipe + pointer/AGENTS `it` blocks PASS; scenario-title assertion still FAIL until Task 5.

- [ ] **Step 5: Commit**

```bash
git add embedded/rules/doc-canon.mdc .cursor/rules/doc-canon.mdc \
  embedded/agents/AGENTS.block.md AGENTS.md
git commit -m "$(cat <<'EOF'
feat: teach working-set expand discipline in pointer and AGENTS

Same progressive-disclosure habit for coding agents without a mandatory chat ritual.
EOF
)"
```

---

### Task 5: Living canon + acceptance scenarios

**Files:**
- Modify: `docs/canon/SKILLS.md`
- Modify: `docs/canon/GLOSSARY.md`
- Modify: `docs/canon/ARCHITECTURE.md`
- Modify: `docs/acceptance/skill-scenarios.md`
- Test: `tests/embedded-assets.test.ts`, `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: recipe already in skills/pointer
- Produces: living SoT + human checklists; scenario titles locked by Task 1

- [ ] **Step 1: Update `docs/canon/SKILLS.md`**

Under **Current state**, after the acceptance-scenarios sentence, add:

```markdown
Agents that use the canon follow a shared dual-audience recipe: progressive disclosure from `INDEX.md` → Scout a working-set manifest → Expand gate (`sufficient` / `need more`) → Execute with targeted deep reads. **Quality over thrift:** expand when doubtful; never silently under-read or invent facts to save tokens.
```

Update the `canon-write` and `canon-audit` rows in **Responsibilities**:

```markdown
| `canon-write` | Author/refactor canon prose and everyday sync of affected sections; Scout → Expand (show working set + verdict) before deep reads; after Expand, clarify when invent-risk remains (one question at a time, A/B/C options, recommended answer, max 3) or skip when the request is already unambiguous; inventory/`check` only when syncing vs code/tree; when writing `future_plans/**`, keep initiatives directional (not a task list) and follow the draft → refining → implementing → absorbed lifecycle |
| `canon-audit` | Semantic audit vs inventory; Scout → Expand with visible working set + verdict before deep evidence reads (`validate` then `check` as Scout inputs); resolve dialogue; discrepancy lifecycle; mark unconfirmed skill findings stale |
```

Update the Pointer rule bullet under Responsibilities to:

```markdown
Pointer rule / `AGENTS.md`: always-on context priority — start at `docs/canon/INDEX.md`; build a small working set and expand if unsure before deep reads (no mandatory chat ritual); escalate docs↔code divergence; do not silently pick a side.
```

Add a short note after the responsibilities table (or under Current state):

```markdown
`canon-bootstrap` may legitimately use a wide inventory/import pass—do not force an artificially tiny working set. `canon-contract` work is naturally narrow (contract + templates + INDEX); full phased skill text for those two can wait until write/audit patterns stabilize.
```

Keep existing clarify and other invariants; do not remove them.

- [ ] **Step 2: Add glossary terms**

In `docs/canon/GLOSSARY.md` **Terms**, after **Managed assets** (or similarly near agent concepts), add:

```markdown
### Working set
The small list of canon/artifact paths an agent intends to use for the current task, discovered via INDEX (and CLI inventory/report when needed) before deep-reading file bodies.

### Scout
Phase that builds a working-set manifest (`path`, `role`, short why-in-set stub) without loading full file bodies or inventing structure.

### Expand gate
Check that the working set is **sufficient** or **need more** before deep reads. Doubt → expand. Managed canon skills briefly show the set and verdict in chat; coding agents apply the same discipline without a mandatory chat ritual.
```

- [ ] **Step 3: Light architecture note**

In `docs/canon/ARCHITECTURE.md` **Summary**, append one sentence:

```markdown
Agents discover a small working set from `INDEX.md` (Scout → Expand) before deep reads—quality over thrift; no pack/search CLI in MVP.
```

Do not add a new CLI building block.

- [ ] **Step 4: Acceptance scenarios**

In `docs/acceptance/skill-scenarios.md`, extend **Pointer rule and AGENTS block after init** with:

```markdown
- [ ] Confirm the pointer rule / `AGENTS` block mention starting at `INDEX.md`, building a small working set, and expanding when unsure (guidance only—not a required chat ritual for coding agents).
```

Add these two sections (exact H2 titles) before **Check preserves skill findings**:

```markdown
## Canon-write Scout Expand Execute before deep reads

- [ ] Ask `canon-write` for a substantial canon change.
- [ ] Confirm it briefly shows a working set (paths + stubs) and an expand verdict (`sufficient` or `need more`) before deep-reading section bodies.
- [ ] If invent-risk remains, confirm clarify runs **after** that expand gate (not before Scout).
- [ ] Confirm a legitimate expand (`need more` then more paths) is treated as success, not failure.
- [ ] Confirm it runs `doc-canon validate` before claiming success.

## Canon-audit Scout Expand Execute before deep reads

- [ ] Run `canon-audit` on a repo with inventory available.
- [ ] Confirm it runs `validate` then `check` as Scout inputs.
- [ ] Confirm it briefly shows a working set + expand verdict before deep-reading evidence paths.
- [ ] Confirm it expands until claims are evidence-backed rather than under-reading silently.
```

- [ ] **Step 5: Validate living canon + tests**

Run:

```bash
npm test -- tests/embedded-assets.test.ts
node bin/doc-canon.js validate
```

Expected: embedded-assets PASS (including scenario titles); validate exits 0.

- [ ] **Step 6: Commit**

```bash
git add docs/canon/SKILLS.md docs/canon/GLOSSARY.md docs/canon/ARCHITECTURE.md \
  docs/acceptance/skill-scenarios.md
git commit -m "$(cat <<'EOF'
docs: absorb P0 Scout Expand recipe into living canon

Document dual-audience working-set discipline and add human-run acceptance scenarios.
EOF
)"
```

---

### Task 6: Skills stamp bump + full verification + absorb P0

**Files:**
- Modify: `src/version.ts`
- Modify: `docs/canon/CANON_CONTRACT.md`
- Modify: `docs/canon/future_plans/p0-skill-context-efficiency.md`
- Modify: `docs/canon/future_plans/INDEX.md`
- Test: full `npm test`, `node bin/doc-canon.js validate`

**Interfaces:**
- Consumes: all managed asset edits from Tasks 2–4
- Produces: `SKILLS_STAMP` `"0.4.0"`; P0 marked `absorbed`

- [ ] **Step 1: Bump stamp**

In `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.4.0";
```

Leave `MIN_SKILLS_STAMP` as `"0.1.0"`.

In `docs/canon/CANON_CONTRACT.md` machine YAML:

```yaml
skills_stamp: "0.4.0"
```

- [ ] **Step 2: Mark P0 absorbed**

In `docs/canon/future_plans/p0-skill-context-efficiency.md`, set `**Status:** absorbed` and add a one-line note at the top that outcomes live in `SKILLS.md`, glossary, architecture, write/audit skills, pointer/`AGENTS`, and acceptance scenarios.

In `docs/canon/future_plans/INDEX.md`, set Skill context efficiency status to `absorbed` and adjust the footer note accordingly.

- [ ] **Step 3: Full verification**

Run:

```bash
npm test
node bin/doc-canon.js validate
```

Expected: all tests PASS; validate exits 0.

- [ ] **Step 4: Commit**

```bash
git add src/version.ts docs/canon/CANON_CONTRACT.md \
  docs/canon/future_plans/p0-skill-context-efficiency.md \
  docs/canon/future_plans/INDEX.md
git commit -m "$(cat <<'EOF'
chore: bump skills_stamp to 0.4.0 and absorb P0

Ship managed-asset stamp for Scout Expand Execute guidance; mark skill context efficiency absorbed.
EOF
)"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Dual-audience recipe Progressive → Scout → Expand → Execute | Tasks 2–5 |
| Quality over thrift | Global Constraints; skill Expand rules; pointer; SKILLS.md |
| Full phases in `canon-write` | Task 2 |
| Clarify after Expand if invent-risk | Task 2; acceptance Task 5 |
| Full phases in `canon-audit` + visible gate | Task 3 |
| Coding agents via pointer/`AGENTS`, no pack, no mandatory chatter | Task 4; SKILLS pointer bullet; acceptance pointer bullet |
| Living canon SKILLS / glossary / light ARCHITECTURE | Task 5 |
| Acceptance scenarios write + audit (+ pointer mention) | Task 5 |
| No new CLI / no CLI.md churn | Global Constraints; File Structure |
| Smart cache stays P0b | Global Constraints; not in File Structure as work |
| Bootstrap/contract note only | Task 5 SKILLS note |
| Stamp bump on managed asset change | Task 6 `0.4.0` |
| P0 status implementing → absorbed | Tasks 1 and 6 |

No TBD placeholders. Regexes in Task 1 match headings/phrases written in Tasks 2–5. Scenario H2 titles match the phrase list exactly.

---

## Execution handoff

Plan saved to `docs/superpowers/plans/2026-08-09-skill-context-efficiency.md`.
