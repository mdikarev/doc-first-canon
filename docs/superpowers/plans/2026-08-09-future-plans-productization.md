# Future Plans Productization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `docs/canon/future_plans/` a first-class part of the `doc-canon` tool: default required INDEX scaffold, `upgrade-skills` migration, and agent rules that treat initiatives as future system shape (not development tasks).

**Architecture:** Extend default contract + embedded templates; fix nested `section.path` mkdir in `init`; add idempotent `ensureFuturePlansSkeleton` used by `upgrade-skills`; refresh managed rules/skills/AGENTS; sync this repo’s living canon. No new CLI command.

**Tech Stack:** TypeScript ESM, Node ≥20, `node:test` + `tsx --test`, `yaml` package, existing `commander` CLI.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-09-future-plans-productization-design.md` — if this plan conflicts, escalate; do not silently diverge.
- `future_plans/INDEX.md` is **required** in the default contract; individual initiatives are **not** in the default contract.
- Future plans = future **system shape**; never coding tasks / checklists / `coding_agent_prompt` (those stay in roadmap/issues/`DISCREPANCIES`).
- `upgrade-skills` migrates skeleton; **never** overwrite existing initiative `.md` prose; **never** clobber existing `FUTURE_*` templates if already present.
- Do not ship this repo’s P0–P3 initiatives inside the package default scaffold.
- Do not add a separate migrate CLI command.
- Orphan validation unchanged: every non-template `.md` under `docs/canon/` must be listed in the contract.
- Bump `SKILLS_STAMP` when managed skills/rules/AGENTS content changes (target `0.2.0`); keep `MIN_SKILLS_STAMP` compatible with policy (raise only if validate must reject older stamps — prefer `SKILLS_STAMP = "0.2.0"` and leave `MIN_SKILLS_STAMP` at `"0.1.0"` unless existing policy requires lockstep).
- TDD: failing test → implement → pass → commit per task.
- Run `npm test` and `node bin/doc-canon.js validate` (from repo root) before claiming done.

---

## File Structure

```text
embedded/templates/FUTURE_PLANS_INDEX.md   # Create (product default scaffold text)
embedded/templates/FUTURE_PLAN.md          # Create (initiative template)
embedded/rules/doc-canon.mdc               # Modify: future_plans semantics
embedded/agents/AGENTS.block.md            # Modify: brief pointer
embedded/skills/canon-*/SKILL.md           # Modify: bootstrap/write/contract/audit guidance

src/version.ts                             # Modify: SKILLS_STAMP 0.2.0
src/scaffold/default-contract.ts           # Modify: section + templates
src/scaffold/ensure-future-plans.ts        # Create: idempotent skeleton helper
src/commands/init.ts                       # Modify: mkdir for nested section paths
src/commands/upgrade-skills.ts             # Modify: call ensure helper before validate

tests/init.test.ts                         # Modify: assert future_plans INDEX + templates
tests/templates-fixture.test.ts            # Modify: new templates/section expectations
tests/upgrade-skills.test.ts               # Modify: migration + no-clobber initiative
tests/ensure-future-plans.test.ts          # Create: unit tests for helper
tests/embedded-assets.test.ts              # Modify: rules/skills/AGENTS assertions

docs/canon/**                              # Sync living canon + contract required flag
docs/acceptance/skill-scenarios.md         # Modify: future_plans semantics scenario note
```

---

### Task 1: Default templates + contract + nested `init` paths

**Files:**
- Create: `embedded/templates/FUTURE_PLANS_INDEX.md`
- Create: `embedded/templates/FUTURE_PLAN.md`
- Modify: `src/scaffold/default-contract.ts`
- Modify: `src/commands/init.ts`
- Modify: `tests/init.test.ts`
- Modify: `tests/templates-fixture.test.ts`

**Interfaces:**
- Consumes: existing `defaultContractMarkdown()`, `initCanon()`, `parseContractMarkdown()`
- Produces: default contract always includes section id `future-plans-index` at path `future_plans/INDEX.md` with `required: true` and template `FUTURE_PLANS_INDEX`; templates list includes `FUTURE_PLANS_INDEX` and `FUTURE_PLAN`; `init` creates nested files via `fs.mkdirSync(path.dirname(dest), { recursive: true })`

- [ ] **Step 1: Write the failing init assertion**

In `tests/init.test.ts`, extend `TEMPLATE_FILES` and add assertions after successful `initCanon`:

```ts
const TEMPLATE_FILES = [
  ...MANDATORY_FILES,
  "SECTION.md",
  "ENTITY.md",
  "MODULE.md",
  "DOMAIN_TOPIC.md",
  "FUTURE_PLANS_INDEX.md",
  "FUTURE_PLAN.md",
] as const;

// inside the empty-repo test, after other asserts:
assert.equal(
  existsSync(join(root, "docs", "canon", "future_plans", "INDEX.md")),
  true,
);
assert.match(
  readFileSync(join(root, "docs", "canon", "CANON_CONTRACT.md"), "utf8"),
  /path:\s*future_plans\/INDEX\.md/,
);
assert.match(
  readFileSync(join(root, "docs", "canon", "INDEX.md"), "utf8"),
  /future_plans\/INDEX\.md/,
);
```

Also update `tests/templates-fixture.test.ts`:
- Add `"FUTURE_PLANS_INDEX"` and `"FUTURE_PLAN"` to `TEMPLATE_IDS` and `TEMPLATE_HEADINGS`:
  - `FUTURE_PLANS_INDEX`: `["Future plans", "How to use", "Status vocabulary", "Initiatives"]`
  - `FUTURE_PLAN`: `["Intent", "In scope", "Out of scope", "Absorbs into", "Open questions"]` (H1 `<Title>` is a placeholder and must not appear in required headings)
- Extend `MANDATORY_SECTIONS` with `["future-plans-index", "future_plans/INDEX.md", "section"]`
- In “scaffold a valid canon” test, when copying section files, use `mkdirSync(dirname(join(canonRoot, sectionPath)), { recursive: true })` before `cpSync`, and map template id → file via contract (copy `FUTURE_PLANS_INDEX.md` template content to `future_plans/INDEX.md`, not by basename equality)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/init.test.ts tests/templates-fixture.test.ts`

Expected: FAIL — missing embedded templates and/or contract section / nested path.

- [ ] **Step 3: Add embedded templates**

Create `embedded/templates/FUTURE_PLANS_INDEX.md`:

```markdown
# Future plans

## How to use
<!-- Draft initiatives for the future shape of the system. Not behavioral SoT.
     Not development tasks, checklists, or coding_agent_prompt storage.
     After implementation, absorb outcomes into living canon sections. -->

## Status vocabulary
<!-- draft | refining | absorbed (projects may add local labels; do not turn this into a task tracker) -->

## Initiatives
<!-- Table of initiative files and statuses. Zero rows is valid. -->
```

Create `embedded/templates/FUTURE_PLAN.md`:

```markdown
# <Title>

## Intent
<!-- Why this initiative exists and what future system shape it describes. -->

## In scope
<!-- Boundaries of the future capability / design. -->

## Out of scope
<!-- Explicit exclusions. Do not put execution task lists here. -->

## Absorbs into
<!-- Living canon sections expected to change when this is realized. -->

## Open questions
<!-- Questions for later design refinement. -->
```

- [ ] **Step 4: Update `default-contract.ts`**

In `SECTIONS`, append:

```ts
["future-plans-index", "future_plans/INDEX.md", "section", "FUTURE_PLANS_INDEX"],
```

In `TEMPLATE_IDS`, append `"FUTURE_PLANS_INDEX"` and `"FUTURE_PLAN"`.

Keep all existing mandatory sections `required: true` (the generator already emits `required: true` for every `SECTIONS` entry).

- [ ] **Step 5: Fix nested paths in `init.ts`**

In `scaffoldCanon`, when copying each section file, replace the flat write with:

```ts
const dest = path.join(canonRoot, section.path);
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(
  path.join(templateRoot, `${section.template}.md`),
  dest,
);
```

(Still skip writing `CANON_CONTRACT.md` from a template copy in that loop — keep existing `continue` for that path.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- tests/init.test.ts tests/templates-fixture.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add embedded/templates/FUTURE_PLANS_INDEX.md embedded/templates/FUTURE_PLAN.md \
  src/scaffold/default-contract.ts src/commands/init.ts \
  tests/init.test.ts tests/templates-fixture.test.ts
git commit -m "$(cat <<'EOF'
feat: scaffold required future_plans INDEX on init

EOF
)"
```

---

### Task 2: `ensureFuturePlansSkeleton` + `upgrade-skills` migration

**Files:**
- Create: `src/scaffold/ensure-future-plans.ts`
- Create: `tests/ensure-future-plans.test.ts`
- Modify: `src/commands/upgrade-skills.ts`
- Modify: `tests/upgrade-skills.test.ts`

**Interfaces:**
- Consumes: `extractYamlBlock`, `parseContractMarkdown` / `yaml`, `embeddedRoot`, `canonDir`, `contractPath`
- Produces:

```ts
export type EnsureFuturePlansResult = {
  contractMarkdown: string;
  createdIndex: boolean;
  createdTemplates: string[];
  contractChanged: boolean;
  indexTableChanged: boolean;
};

export function ensureFuturePlansSkeleton(
  root: string,
  contractMarkdown: string,
): EnsureFuturePlansResult;
```

Behavior (idempotent):
1. Ensure `docs/canon/templates/FUTURE_PLANS_INDEX.md` and `FUTURE_PLAN.md` exist; if missing, copy from `embedded/templates/`; if present, leave untouched.
2. Parse contract YAML; if templates entries missing, append them; if section `path: future_plans/INDEX.md` missing, append section `{ id: future-plans-index, path: future_plans/INDEX.md, role: section, required: true, template: FUTURE_PLANS_INDEX }`. If section exists but `required: false`, set `required: true`.
3. Serialize YAML back into the single fenced block (replace only the YAML body; keep surrounding markdown). Prefer `YAML.stringify` with default options; do not try to preserve exotic key order beyond putting new entries at end of arrays.
4. If `docs/canon/future_plans/INDEX.md` is missing, create dirs and copy from the (now present) template file. If present, do not overwrite.
5. If root `docs/canon/INDEX.md` Sections table lacks a row whose path cell is `future_plans/INDEX.md`, append:

```markdown
| future-plans-index | future_plans/INDEX.md | section | true |
```

before the blank line after the table (or after the last table row). Do not invent other INDEX changes.
6. Return flags + final `contractMarkdown` (caller still responsible for bumping `skills_stamp` and writing the file).

`upgradeSkills` order:
1. `assertUpgradePreconditions` (stamp bump string only, as today)
2. `copyManagedAssets`
3. `ensureFuturePlansSkeleton(root, stampUpdatedMarkdown)`
4. Write resulting contract markdown
5. `validateCanon`

- [ ] **Step 1: Write failing unit tests for the helper**

Create `tests/ensure-future-plans.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { initCanon } from "../src/commands/init.js";
import { ensureFuturePlansSkeleton } from "../src/scaffold/ensure-future-plans.js";
import { parseContractMarkdown } from "../src/contract/parse.js";

it("adds future_plans skeleton to a pre-feature contract without clobbering initiatives", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const initiativePath = join(canon, "future_plans", "demo-initiative.md");
    const planted = "# Planted\n\n## Intent\nx\n\n## In scope\ny\n\n## Out of scope\nz\n\n## Absorbs into\na\n\n## Open questions\nb\n";
    writeFileSync(initiativePath, planted);

    // Strip future_plans from contract + delete INDEX + delete FUTURE_* templates to simulate old repo
    let contract = readFileSync(contractPath, "utf8");
    contract = contract
      .replace(/\n  - id: future-plans-index[\s\S]*?template: FUTURE_PLANS_INDEX\n/, "\n")
      .replace(/\n  - id: FUTURE_PLANS_INDEX\n    path: templates\/FUTURE_PLANS_INDEX\.md\n/, "\n")
      .replace(/\n  - id: FUTURE_PLAN\n    path: templates\/FUTURE_PLAN\.md\n/, "\n");
    writeFileSync(contractPath, contract);
    rmSync(join(canon, "future_plans", "INDEX.md"), { force: true });
    rmSync(join(canon, "templates", "FUTURE_PLANS_INDEX.md"), { force: true });
    rmSync(join(canon, "templates", "FUTURE_PLAN.md"), { force: true });

    // Also remove INDEX table row if present
    const indexPath = join(canon, "INDEX.md");
    writeFileSync(
      indexPath,
      readFileSync(indexPath, "utf8").replace(
        /\| future-plans-index \| future_plans\/INDEX\.md \| section \| true \|\n/,
        "",
      ),
    );

    const result = ensureFuturePlansSkeleton(root, readFileSync(contractPath, "utf8"));
    writeFileSync(contractPath, result.contractMarkdown);

    const parsed = parseContractMarkdown(result.contractMarkdown);
    assert.equal(
      parsed.sections.some((s) => s.path === "future_plans/INDEX.md" && s.required),
      true,
    );
    assert.equal(existsSync(join(canon, "future_plans", "INDEX.md")), true);
    assert.equal(existsSync(join(canon, "templates", "FUTURE_PLAN.md")), true);
    assert.equal(readFileSync(initiativePath, "utf8"), planted);
    assert.match(
      readFileSync(indexPath, "utf8"),
      /future_plans\/INDEX\.md/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Adjust strip regexes if the exact YAML formatting from `defaultContractMarkdown` differs — the test must start from a real `init` output then remove future_plans pieces.

- [ ] **Step 2: Run unit test to verify it fails**

Run: `npm test -- tests/ensure-future-plans.test.ts`

Expected: FAIL — module not found / function missing.

- [ ] **Step 3: Implement `ensure-future-plans.ts`**

Implement `ensureFuturePlansSkeleton` per **Interfaces** above. Use:

```ts
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { extractYamlBlock } from "../contract/parse.js";
import { canonDir, embeddedRoot } from "../paths.js";
```

Do not delete or rewrite files under `future_plans/` other than creating missing `INDEX.md`.

- [ ] **Step 4: Wire `upgrade-skills.ts`**

Replace the write path so stamp-bumped markdown is passed through `ensureFuturePlansSkeleton` before `writeFileSync`. Keep precondition checks unchanged (still compute stamp-bumped markdown first for AGENTS access checks).

- [ ] **Step 5: Add upgrade integration test**

In `tests/upgrade-skills.test.ts`, add a test that:
1. `initCanon`
2. Strips future_plans skeleton the same way as the unit test (helper strip optional)
3. Plants `future_plans/kept.md` with unique prose (even if not in contract yet — after strip, delete INDEX only; for orphan avoidance during intermediate state, either register a temporary optional section or plant the file only after strip and accept that validate fails until upgrade — prefer: plant file **after** upgrade starts is wrong; instead plant file, register optional section in stripped contract so validate isn’t required mid-test)
4. Simpler path: plant initiative file; strip only INDEX file + templates + contract section; leave a dangling initiative file; `upgradeSkills` restores INDEX/templates/section; initiative bytes unchanged; then manually you may still have orphan initiative — so either also register optional section in stripped contract for the planted file, or delete planted file from contract orphans by including:

```yaml
  - id: future-demo
    path: future_plans/demo-initiative.md
    role: section
    required: false
    template: FUTURE_PLAN
```

in the stripped contract when planting. After upgrade, assert planted content unchanged and `upgradeSkills` returns `0`.

- [ ] **Step 6: Run tests**

Run: `npm test -- tests/ensure-future-plans.test.ts tests/upgrade-skills.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/scaffold/ensure-future-plans.ts src/commands/upgrade-skills.ts \
  tests/ensure-future-plans.test.ts tests/upgrade-skills.test.ts
git commit -m "$(cat <<'EOF'
feat: migrate future_plans skeleton on upgrade-skills

EOF
)"
```

---

### Task 3: Managed rules, skills, AGENTS + stamp bump

**Files:**
- Modify: `embedded/rules/doc-canon.mdc`
- Modify: `embedded/agents/AGENTS.block.md`
- Modify: `embedded/skills/canon-bootstrap/SKILL.md`
- Modify: `embedded/skills/canon-write/SKILL.md`
- Modify: `embedded/skills/canon-contract/SKILL.md`
- Modify: `embedded/skills/canon-audit/SKILL.md`
- Modify: `src/version.ts` (`SKILLS_STAMP` → `"0.2.0"`)
- Modify: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: product semantics from the design spec
- Produces: managed assets mentioning `future_plans` role and non-task rule; stamp `0.2.0`

- [ ] **Step 1: Write failing embedded-asset assertions**

Add to `tests/embedded-assets.test.ts`:

```ts
it("documents future_plans as directional canon, not task storage", () => {
  const rule = readEmbedded("rules", "doc-canon.mdc");
  assert.match(rule, /future_plans/i);
  assert.match(rule, /not.*(?:coding tasks|development tasks|task tracker)/i);

  const block = readEmbedded("agents", "AGENTS.block.md");
  assert.match(block, /future_plans/i);

  const write = readEmbedded("skills", "canon-write", "SKILL.md");
  assert.match(write, /future_plans/i);
  assert.match(write, /absorb/i);

  const contract = readEmbedded("skills", "canon-contract", "SKILL.md");
  assert.match(contract, /FUTURE_PLAN/);
  assert.match(contract, /future_plans\//);

  const bootstrap = readEmbedded("skills", "canon-bootstrap", "SKILL.md");
  assert.match(bootstrap, /future_plans/i);

  const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
  assert.match(audit, /future_plans/i);
  assert.match(audit, /not.*(?:behavioral SoT|current SoT)|directional/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/embedded-assets.test.ts`

Expected: FAIL on new assertions.

- [ ] **Step 3: Update managed assets**

`embedded/rules/doc-canon.mdc` — add after the SoT paragraph:

```markdown
`docs/canon/future_plans/` is part of the canon for **future system shape** (initiatives). It is not the behavioral source of truth for current behavior. Do not store development tasks, checklists, or coding-agent prompts there; use roadmap/issues/`DISCREPANCIES.md` for execution work. After an initiative is realized, absorb outcomes into living canon sections.
```

`embedded/agents/AGENTS.block.md` — extend the managed blurb with one sentence on `future_plans/` (directional; not task storage).

Skills (minimal bullets, keep existing safety blocks):
- **bootstrap:** after init, `future_plans/INDEX.md` exists; do not invent initiatives unless the user asks.
- **write:** may edit `future_plans/**`; must not convert plans into task trackers; absorb guidance when user marks done.
- **contract:** to add an initiative — register `future_plans/<slug>.md` with `required: false`, template `FUTURE_PLAN`, create from template, add INDEX row; confirm with user first.
- **audit:** do not treat `future_plans` prose as current behavioral SoT when judging docs↔code drift.

Set in `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.2.0";
```

Leave `MIN_SKILLS_STAMP` at `"0.1.0"` unless a test requires otherwise.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/embedded-assets.test.ts tests/upgrade-skills.test.ts tests/init.test.ts`

Expected: PASS (upgrade still rewrites stamp to current `SKILLS_STAMP`).

- [ ] **Step 5: Commit**

```bash
git add embedded/rules/doc-canon.mdc embedded/agents/AGENTS.block.md \
  embedded/skills src/version.ts tests/embedded-assets.test.ts
git commit -m "$(cat <<'EOF'
feat: document future_plans semantics in managed agent assets

EOF
)"
```

---

### Task 4: Sync this repository’s living canon + acceptance note

**Files:**
- Modify: `docs/canon/CANON_CONTRACT.md` — set `future-plans-index` / `future_plans/INDEX.md` to `required: true`; bump `skills_stamp` to `"0.2.0"` if that is the package stamp
- Modify: `docs/canon/INDEX.md` — ensure Sections table shows `required | true` for future-plans-index
- Modify: `docs/canon/GLOSSARY.md` — add **Future plans** term
- Modify: `docs/canon/OVERVIEW.md` — in scope / future plans pointer as product feature
- Modify: `docs/canon/ARCHITECTURE.md` — building block / flow for scaffold + upgrade ensure
- Modify: `docs/canon/CLI.md` — `init` / `upgrade-skills` responsibilities
- Modify: `docs/canon/SKILLS.md` — skill responsibilities for future_plans
- Modify: `docs/canon/future_plans/INDEX.md` — remove “build docs/roadmap inside this folder” as if it were the purpose; state non-task rule clearly; keep listing P0–P3 as this repo’s initiatives
- Modify: `docs/acceptance/skill-scenarios.md` — short scenario: “Future plans are directional; contract adds optional initiative”

**Interfaces:**
- Consumes: implemented product behavior from Tasks 1–3
- Produces: living canon matching the tool; `doc-canon validate` passes

- [ ] **Step 1: Apply canon + acceptance edits**

Glossary term:

```markdown
### Future plans
Canon subtree `docs/canon/future_plans/` for initiatives describing the **future shape** of the system. Not behavioral SoT for current behavior; not a development task tracker. After realization, absorb into living sections and mark the initiative absorbed or remove it.
```

Update `future_plans/INDEX.md` **How to use** to match product semantics (directional plans; execution tracking elsewhere; absorb lifecycle). Keep status vocabulary; if `implementing` remains, note it must not become a task dump.

- [ ] **Step 2: Validate**

Run: `node bin/doc-canon.js validate`

Expected: `Canon is valid.`

- [ ] **Step 3: Full test suite**

Run: `npm test`

Expected: all tests PASS

- [ ] **Step 4: Refresh local managed assets (optional but recommended)**

Run: `node bin/doc-canon.js upgrade-skills`

Expected: exit 0; local `.cursor` skills/rules match embedded (this repo).

- [ ] **Step 5: Commit**

```bash
git add docs/canon docs/acceptance/skill-scenarios.md
git commit -m "$(cat <<'EOF'
docs: sync canon with first-class future_plans product behavior

EOF
)"
```

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Default required `future_plans/INDEX.md` | Task 1 |
| Templates `FUTURE_*` in package | Task 1 |
| Nested mkdir on init | Task 1 |
| Zero initiatives valid | Task 1 (no initiative sections in default) |
| `upgrade-skills` migration idempotent | Task 2 |
| Do not overwrite initiative prose / existing templates | Task 2 |
| INDEX table row sync | Task 2 |
| Rules/AGENTS/skills semantics + non-task rule | Task 3 |
| Stamp bump | Task 3 |
| Living canon + acceptance | Task 4 |
| No separate migrate command / no shipping P0–P3 defaults | Honored (non-goals) |

## Placeholder scan

No TBD/TODO steps; commands and file paths are explicit.

## Type consistency

`ensureFuturePlansSkeleton(root, contractMarkdown) → EnsureFuturePlansResult` is the single migration API; `upgradeSkills` is the only CLI caller in this plan.
