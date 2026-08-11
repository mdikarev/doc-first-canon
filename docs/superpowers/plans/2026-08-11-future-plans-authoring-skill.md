# P0c Future Plans Authoring Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `canon-future-plan` plus INDEX-driven validation for `future_plans/*.md` so initiatives no longer need per-file contract registration.

**Architecture:** Living canon is updated first (canon-first). CLI treats `future_plans/` (except `INDEX.md`) as an INDEX↔disk zone with `FUTURE_PLAN` heading checks and orphan exemption. `upgrade-skills` / `ensureFuturePlansSkeleton` strips leftover optional initiative section rows. A fifth managed skill owns create/refine/status/INDEX; `canon-write` and `canon-contract` hand off.

**Tech Stack:** TypeScript (Node ≥20, `node:test` via `tsx`), existing `doc-canon validate` / scaffold, Cursor managed skills under `embedded/skills/`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-11-future-plans-authoring-skill-design.md`. On conflict, escalate—do not silently pick a side.
- **Canon-first:** Task 1 must complete and receive explicit user go-ahead before Tasks 2+ change CLI/skills behavior in a shippable way. Do not start Task 2 until the user says go.
- Coding agents must not edit `docs/canon/**` themselves; Task 1 invokes **`canon-write`** (and `canon-contract` only if structural kinds change—which they should not).
- Initiatives stay directional: no checklists, sprint plans, or coding-agent prompts in `future_plans/**`.
- Status vocabulary remains `draft` → `refining` → `implementing` → `absorbed`.
- Numbering: `pN` + optional letter; priority = Initiatives table order + short note under the table.
- Bump `SKILLS_STAMP` to `"0.6.0"` when managed skills ship; leave `MIN_SKILLS_STAMP` at `"0.1.0"`; sync repo `docs/canon/CANON_CONTRACT.md` stamp.
- Mirror every edited embedded skill into `.cursor/skills/`.
- TDD for CLI: failing test → implement → pass → commit per task.
- Before claiming done: `npm test` and `node bin/doc-canon.js validate` at repo root.

---

## File Structure

```text
# Living canon (via canon-write only — Task 1)
docs/canon/SKILLS.md
docs/canon/ARCHITECTURE.md
docs/canon/CLI.md
docs/canon/GLOSSARY.md                    # optional short term if needed
docs/canon/future_plans/INDEX.md          # How to use + pointer to skill
docs/canon/future_plans/p0c-….md          # status → refining; Design link

# Validate zone
src/validate/future-plans-index.ts        # NEW: parse Initiatives + zone errors
src/validate/index-agreement.ts           # export tableCellPath (or keep local copy)
src/validate/validate.ts                  # orphan exemption + call zone validator
tests/validate-future-plans.test.ts       # NEW

# Migration
src/scaffold/ensure-future-plans.ts       # strip optional future_plans/* sections (≠ INDEX)
tests/ensure-future-plans.test.ts
tests/upgrade-skills.test.ts

# This repo contract migration (after zone works)
docs/canon/CANON_CONTRACT.md              # remove future-p* sections; stamp later
docs/canon/INDEX.md                       # remove future-p* Sections rows

# Managed skills
embedded/skills/canon-future-plan/SKILL.md   # NEW
.cursor/skills/canon-future-plan/SKILL.md    # mirror
embedded/skills/canon-write/SKILL.md
.cursor/skills/canon-write/SKILL.md
embedded/skills/canon-contract/SKILL.md
.cursor/skills/canon-contract/SKILL.md
tests/embedded-assets.test.ts
docs/acceptance/skill-scenarios.md
src/version.ts                            # SKILLS_STAMP → 0.6.0
```

---

### Task 1: Living canon via `canon-write` (canon-first gate)

**Files:**
- Modify (via skill only): `docs/canon/SKILLS.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/CLI.md`, `docs/canon/future_plans/INDEX.md`, `docs/canon/future_plans/p0c-future-plans-authoring-skill.md`
- Optionally: `docs/canon/GLOSSARY.md`
- Do **not** strip `future-p*` contract rows in this task (validate would orphan-fail until Task 3).

**Interfaces:**
- Consumes: design spec `docs/superpowers/specs/2026-08-11-future-plans-authoring-skill-design.md`
- Produces: living SoT that describes target behavior before code ships

- [ ] **Step 1: Invoke `canon-write`**

Ask the user to run `/canon-write` (or invoke the skill) with this intent. Do not edit `docs/canon/**` from a coding agent.

Content the skill must land:

1. **`SKILLS.md`**
   - Add `canon-future-plan` to Covers + Responsibilities table: create/refine initiatives, status, INDEX sync, validate; directional-only guardrails; Scout→Expand→clarify protocol.
   - Narrow `canon-write`: on create/refine/status for `future_plans/**`, stop and hand off to `canon-future-plan`; keep living-SoT absorb, then hand off status `absorbed` / INDEX update.
   - Note absorb split explicitly.

2. **`ARCHITECTURE.md`**
   - Document INDEX-driven `future_plans/` validate zone (orphan exemption, INDEX↔disk, `FUTURE_PLAN` headings).
   - Note initiatives are not per-file contract sections.

3. **`CLI.md`**
   - Under validate responsibilities: INDEX-driven checks for `future_plans/*.md` (except INDEX).
   - Under `upgrade-skills`: strip obsolete optional initiative section rows under `future_plans/` (keep INDEX section + files on disk).

4. **`future_plans/INDEX.md`**
   - “How to use”: author via `canon-future-plan`, not ad-hoc / not `canon-write` create.
   - Set P0c status cell to `refining` if still `draft`.

5. **`p0c-future-plans-authoring-skill.md`**
   - Status `refining`.
   - Add Design bullet linking to `docs/superpowers/specs/2026-08-11-future-plans-authoring-skill-design.md`.
   - Resolve open questions in prose to match the approved decisions (dedicated skill; no per-file registration; INDEX-driven validate; write handoff; numbering `pN`+letter).

6. Run `doc-canon validate` under the skill before claiming success.

- [ ] **Step 2: Commit canon edits** (after skill succeeds)

```bash
git add docs/canon/SKILLS.md docs/canon/ARCHITECTURE.md docs/canon/CLI.md \
  docs/canon/future_plans/INDEX.md docs/canon/future_plans/p0c-future-plans-authoring-skill.md \
  docs/canon/GLOSSARY.md
git commit -m "$(cat <<'EOF'
docs: describe canon-future-plan and INDEX-driven future_plans zone

Update living SoT ahead of CLI/skill implementation (canon-first).
EOF
)"
```

- [ ] **Step 3: Stop for user go-ahead**

Message the user: living canon is updated; ask explicitly whether to proceed with CLI/skill implementation (Tasks 2+). **Do not start Task 2 until they confirm.**

---

### Task 2: Failing tests for INDEX-driven `future_plans` validate zone

**Files:**
- Create: `tests/validate-future-plans.test.ts`
- Test: `tests/validate-future-plans.test.ts`

**Interfaces:**
- Consumes: `validateCanon(root: string): ValidateResult` from `src/validate/validate.ts`
- Produces: failing tests that lock orphan exemption, INDEX↔disk, and heading failures

- [ ] **Step 1: Write the failing test file**

Create `tests/validate-future-plans.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { validateCanon } from "../src/validate/validate.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const fixture = (name: string): string => join(testsDir, "fixtures", name);

function temporaryInitLikeCanon(): { root: string; cleanup: () => void } {
  // Prefer copying an init'd tree: use repo's ability via fixture or build minimal.
  // Practical approach: copy happy-canon then graft future_plans skeleton from embedded templates.
  const root = mkdtempSync(join(tmpdir(), "doc-canon-fp-"));
  cpSync(fixture("happy-canon"), root, { recursive: true });
  const canon = join(root, "docs", "canon");
  const embeddedTemplates = join(repoRoot, "embedded", "templates");
  mkdirSync(join(canon, "templates"), { recursive: true });
  for (const id of ["FUTURE_PLANS_INDEX", "FUTURE_PLAN"] as const) {
    writeFileSync(
      join(canon, "templates", `${id}.md`),
      readFileSync(join(embeddedTemplates, `${id}.md`), "utf8"),
    );
  }
  mkdirSync(join(canon, "future_plans"), { recursive: true });
  writeFileSync(
    join(canon, "future_plans", "INDEX.md"),
    `# Future plans

## How to use
Use the skill.

## Status vocabulary
draft / refining / implementing / absorbed

## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
`,
  );

  const contractFile = join(canon, "CANON_CONTRACT.md");
  let contract = readFileSync(contractFile, "utf8");
  contract = contract.replace(
    "templates:\n",
    `  - id: future-plans-index
    path: future_plans/INDEX.md
    role: section
    required: true
    template: FUTURE_PLANS_INDEX
templates:
  - id: FUTURE_PLANS_INDEX
    path: templates/FUTURE_PLANS_INDEX.md
  - id: FUTURE_PLAN
    path: templates/FUTURE_PLAN.md
`,
  );
  writeFileSync(contractFile, contract);

  const indexFile = join(canon, "INDEX.md");
  let index = readFileSync(indexFile, "utf8");
  if (!index.includes("future_plans/INDEX.md")) {
    // happy-canon uses markdown links in the path column
    index = index.replace(
      /\| contract \| \[CANON_CONTRACT\.md\]\(CANON_CONTRACT\.md\) \| contract \| true \|\n/,
      `| contract | [CANON_CONTRACT.md](CANON_CONTRACT.md) | contract | true |\n| future-plans-index | future_plans/INDEX.md | section | true |\n`,
    );
    writeFileSync(indexFile, index);
  }

  return { root, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

const COMPLETE_INITIATIVE = `# Demo

## Intent
x

## In scope
y

## Out of scope
z

## Absorbs into
a

## Open questions
b
`;

describe("validateCanon future_plans zone", () => {
  it("accepts an initiative file listed only in future_plans INDEX (not in contract)", () => {
    const { root, cleanup } = temporaryInitLikeCanon();
    try {
      const canon = join(root, "docs", "canon");
      writeFileSync(join(canon, "future_plans", "p9-demo.md"), COMPLETE_INITIATIVE);
      writeFileSync(
        join(canon, "future_plans", "INDEX.md"),
        `# Future plans

## How to use
x

## Status vocabulary
y

## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 9 | Demo | draft | [p9-demo.md](p9-demo.md) |
`,
      );
      const result = validateCanon(root);
      assert.equal(result.ok, true, result.errors.join("\n"));
    } finally {
      cleanup();
    }
  });

  it("rejects an orphan initiative file missing from future_plans INDEX", () => {
    const { root, cleanup } = temporaryInitLikeCanon();
    try {
      writeFileSync(
        join(root, "docs", "canon", "future_plans", "orphan.md"),
        COMPLETE_INITIATIVE,
      );
      const result = validateCanon(root);
      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /orphan\.md|not listed|Initiatives/i);
    } finally {
      cleanup();
    }
  });

  it("rejects a broken Initiatives link to a missing file", () => {
    const { root, cleanup } = temporaryInitLikeCanon();
    try {
      writeFileSync(
        join(root, "docs", "canon", "future_plans", "INDEX.md"),
        `# Future plans

## How to use
x

## Status vocabulary
y

## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 9 | Demo | draft | [missing.md](missing.md) |
`,
      );
      const result = validateCanon(root);
      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /missing\.md/i);
    } finally {
      cleanup();
    }
  });

  it("rejects an initiative missing FUTURE_PLAN headings", () => {
    const { root, cleanup } = temporaryInitLikeCanon();
    try {
      const canon = join(root, "docs", "canon");
      writeFileSync(join(canon, "future_plans", "p9-demo.md"), "# Demo\n\n## Intent\nonly\n");
      writeFileSync(
        join(canon, "future_plans", "INDEX.md"),
        `# Future plans

## How to use
x

## Status vocabulary
y

## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 9 | Demo | draft | [p9-demo.md](p9-demo.md) |
`,
      );
      const result = validateCanon(root);
      assert.equal(result.ok, false);
      assert.match(result.errors.join("\n"), /missing required headings/i);
    } finally {
      cleanup();
    }
  });
});
```

Fix the happy-canon INDEX splice if the fixture’s Sections table shape differs—open `tests/fixtures/happy-canon/docs/canon/INDEX.md` and append the `future-plans-index` row in a way that matches its columns.

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test -- tests/validate-future-plans.test.ts
```

Expected: FAIL (orphan errors and/or missing zone logic).

- [ ] **Step 3: Commit failing tests**

```bash
git add tests/validate-future-plans.test.ts
git commit -m "test: require INDEX-driven future_plans validate zone"
```

---

### Task 3: Implement INDEX-driven validate zone

**Files:**
- Create: `src/validate/future-plans-index.ts`
- Modify: `src/validate/validate.ts`
- Optionally modify: `src/validate/index-agreement.ts` (export shared `tableCellPath`)

**Interfaces:**
- Produces:
  - `initiativePathsFromFuturePlansIndex(indexMarkdown: string): string[]` — paths normalized to `future_plans/<file>.md`
  - `validateFuturePlansZone(canonRoot: string, contract: Contract): string[]` — mismatch + heading errors
- Consumes: `requiredHeadingsFromTemplate`, `assertRequiredHeadings`, contract templates map, `fs`

- [ ] **Step 1: Add `src/validate/future-plans-index.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import type { Contract } from "../contract/types.js";
import {
  assertRequiredHeadings,
  requiredHeadingsFromTemplate,
} from "./headings.js";

const FUTURE_PLANS_DIR = "future_plans";
const FUTURE_PLANS_INDEX = "future_plans/INDEX.md";

function tableCellPath(cell: string): string | undefined {
  const value = cell.trim().replace(/^`|`$/g, "");
  const link = /\[[^\]]*]\(([^)]+)\)/.exec(value);
  const candidate = (link?.[1] ?? value).split("#", 1)[0]?.trim();
  return candidate?.endsWith(".md") ? candidate : undefined;
}

export function isFuturePlansInitiativePath(relativePosix: string): boolean {
  const normalized = relativePosix.replaceAll("\\", "/");
  return (
    normalized.startsWith(`${FUTURE_PLANS_DIR}/`) &&
    normalized !== FUTURE_PLANS_INDEX &&
    !normalized.startsWith(`${FUTURE_PLANS_DIR}/templates/`)
  );
}

export function initiativePathsFromFuturePlansIndex(
  indexMarkdown: string,
): string[] {
  const section =
    /^##\s+Initiatives\s*$(.*?)(?=^##\s|(?![\s\S]))/ims.exec(indexMarkdown);
  if (!section) return [];

  const paths: string[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 4 || /^[-:\s]+$/.test(cells[1] ?? "")) continue;
    const raw = tableCellPath(cells[3] ?? "");
    if (!raw) continue;
    const normalized = raw.replaceAll("\\", "/");
    const withPrefix = normalized.startsWith(`${FUTURE_PLANS_DIR}/`)
      ? normalized
      : `${FUTURE_PLANS_DIR}/${normalized}`;
    paths.push(withPrefix);
  }
  return paths;
}

export function validateFuturePlansZone(
  canonRoot: string,
  contract: Contract,
): string[] {
  const errors: string[] = [];
  const indexAbs = path.join(canonRoot, FUTURE_PLANS_INDEX);
  if (!fs.existsSync(indexAbs)) return errors;

  const indexMarkdown = fs.readFileSync(indexAbs, "utf8");
  const indexed = new Set(
    initiativePathsFromFuturePlansIndex(indexMarkdown).map((p) =>
      path.normalize(p),
    ),
  );

  const diskInitiatives: string[] = [];
  const dir = path.join(canonRoot, FUTURE_PLANS_DIR);
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".md") || name === "INDEX.md") continue;
      diskInitiatives.push(path.normalize(`${FUTURE_PLANS_DIR}/${name}`));
    }
  }

  for (const indexedPath of indexed) {
    const abs = path.join(canonRoot, indexedPath);
    if (!fs.existsSync(abs)) {
      errors.push(
        `future_plans Initiatives table links to missing file ${indexedPath}`,
      );
    }
  }

  for (const diskPath of diskInitiatives) {
    if (!indexed.has(diskPath)) {
      errors.push(
        `Orphan future_plans file ${diskPath} is not listed in future_plans/INDEX.md Initiatives`,
      );
    }
  }

  const templateEntry = contract.templates.find((t) => t.id === "FUTURE_PLAN");
  if (!templateEntry) {
    if (indexed.size > 0) {
      errors.push(
        `Initiatives require template FUTURE_PLAN but it is not registered`,
      );
    }
    return errors;
  }

  const templateAbs = path.join(canonRoot, templateEntry.path);
  if (!fs.existsSync(templateAbs)) {
    errors.push(`Template FUTURE_PLAN does not exist at ${templateEntry.path}`);
    return errors;
  }

  const required = requiredHeadingsFromTemplate(
    fs.readFileSync(templateAbs, "utf8"),
  );

  for (const indexedPath of indexed) {
    const abs = path.join(canonRoot, indexedPath);
    if (!fs.existsSync(abs)) continue;
    const missing = assertRequiredHeadings(
      fs.readFileSync(abs, "utf8"),
      required,
    );
    if (missing.length > 0) {
      errors.push(
        `${indexedPath} is missing required headings: ${missing.join(", ")}`,
      );
    }
  }

  return errors;
}
```

- [ ] **Step 2: Wire into `validate.ts`**

1. Import `isFuturePlansInitiativePath` and `validateFuturePlansZone`.
2. In the orphan loop, skip when `isFuturePlansInitiativePath(relative.replaceAll("\\", "/"))` (normalize separators).
3. After INDEX agreement (or after orphan loop), `errors.push(...validateFuturePlansZone(canonRoot, contract))`.

Keep broken-link checks for initiative files (still read markdown in the general loop).

- [ ] **Step 3: Run tests — expect PASS**

```bash
npm test -- tests/validate-future-plans.test.ts
npm test
```

Expected: new tests PASS; full suite green (fix any fixture assumptions if not).

- [ ] **Step 4: Commit**

```bash
git add src/validate/future-plans-index.ts src/validate/validate.ts tests/validate-future-plans.test.ts
git commit -m "feat: validate future_plans via INDEX and FUTURE_PLAN headings"
```

---

### Task 4: Strip obsolete initiative contract rows on ensure/upgrade

**Files:**
- Modify: `src/scaffold/ensure-future-plans.ts`
- Modify: `tests/ensure-future-plans.test.ts`
- Modify: `tests/upgrade-skills.test.ts`

**Interfaces:**
- Extends `ensureFuturePlansSkeleton` / `ensureContractYaml` to remove any `sections[]` entry whose `path` starts with `future_plans/` and is not `future_plans/INDEX.md`
- Also remove matching rows from root `INDEX.md` Sections table when present
- Produces: `contractChanged: true` when strips occur

- [ ] **Step 1: Write failing test in `tests/ensure-future-plans.test.ts`**

```ts
it("strips optional initiative section rows but keeps initiative files", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-strip-fp-"));
  try {
    // initCanon or copy from previous pattern used in this file
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const initiativePath = join(canon, "future_plans", "demo-initiative.md");
    writeFileSync(
      initiativePath,
      "# Demo\n\n## Intent\nx\n\n## In scope\ny\n\n## Out of scope\nz\n\n## Absorbs into\na\n\n## Open questions\nb\n",
    );
    // Append INDEX Initiatives row for demo-initiative.md
    const fpIndex = join(canon, "future_plans", "INDEX.md");
    writeFileSync(
      fpIndex,
      readFileSync(fpIndex, "utf8").replace(
        /## Initiatives[\s\S]*$/,
        `## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 9 | Demo | draft | [demo-initiative.md](demo-initiative.md) |
`,
      ),
    );

    const contractPath = join(canon, "CANON_CONTRACT.md");
    writeFileSync(
      contractPath,
      readFileSync(contractPath, "utf8").replace(
        "templates:\n",
        `  - id: future-demo
    path: future_plans/demo-initiative.md
    role: section
    required: false
    template: FUTURE_PLAN
templates:
`,
      ),
    );
    const rootIndex = join(canon, "INDEX.md");
    writeFileSync(
      rootIndex,
      readFileSync(rootIndex, "utf8").replace(
        /\| future-plans-index \| future_plans\/INDEX\.md \| section \| true \|\n/,
        `| future-plans-index | future_plans/INDEX.md | section | true |
| future-demo | future_plans/demo-initiative.md | section | false |
`,
      ),
    );

    const before = readFileSync(contractPath, "utf8");
    const result = ensureFuturePlansSkeleton(root, before);
    writeFileSync(contractPath, result.contractMarkdown);

    assert.equal(result.contractChanged, true);
    assert.doesNotMatch(
      result.contractMarkdown,
      /future_plans\/demo-initiative\.md/,
    );
    assert.doesNotMatch(
      readFileSync(rootIndex, "utf8"),
      /future_plans\/demo-initiative\.md/,
    );
    assert.equal(existsSync(initiativePath), true);
    assert.equal(validateCanon(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

Import `ensureFuturePlansSkeleton`, `initCanon`, `validateCanon`, `existsSync` as in sibling tests.

- [ ] **Step 2: Run test — expect FAIL**

```bash
npm test -- tests/ensure-future-plans.test.ts
```

- [ ] **Step 3: Implement strip in `ensure-future-plans.ts`**

In `ensureContractYaml`, after ensuring INDEX section/templates:

```ts
const beforeLen = contract.sections.length;
contract.sections = contract.sections.filter(
  (section) =>
    !(
      section.path.startsWith("future_plans/") &&
      section.path !== FUTURE_PLANS_INDEX_PATH
    ),
);
if (contract.sections.length !== beforeLen) changed = true;
```

Add `stripInitiativeRowsFromRootIndex(root: string): boolean` that removes Sections table rows whose path cell is under `future_plans/` but not `future_plans/INDEX.md`. Call it from `ensureFuturePlansSkeleton` and fold into `indexTableChanged` or a dedicated flag (extending the result type is OK; if you extend, update callers—`upgrade-skills` can ignore new fields).

- [ ] **Step 4: Update upgrade test**

In `tests/upgrade-skills.test.ts` `"restores a stripped future_plans skeleton..."`, after upgrade assert:

```ts
assert.doesNotMatch(
  readFileSync(contractPath, "utf8"),
  /future_plans\/demo-initiative\.md/,
);
```

Ensure the planted file still exists and add an Initiatives row for it before upgrade **or** delete the planted file before upgrade if INDEX is recreated empty—prefer: after upgrade, rewrite INDEX with a row for the planted file and `validateCanon` OK. Simplest path consistent with the new zone: after planting the file, also ensure the restored INDEX lists it (upgrade recreates INDEX from template without rows—so either don’t plant an unlisted file across upgrade, or append the row after upgrade in the test). **Recommended:** remove the planted-file-without-INDEX assertion path: plant file + after upgrade append Initiatives row, then validate; and assert contract no longer contains `future-demo`.

- [ ] **Step 5: Run tests — expect PASS**

```bash
npm test
```

- [ ] **Step 6: Commit**

```bash
git add src/scaffold/ensure-future-plans.ts tests/ensure-future-plans.test.ts tests/upgrade-skills.test.ts
git commit -m "feat: strip per-initiative future_plans contract rows on ensure"
```

---

### Task 5: Migrate this repository’s contract + root INDEX

**Files:**
- Modify: `docs/canon/CANON_CONTRACT.md` (remove all `future-p*` section entries; keep `future-plans-index` + templates)
- Modify: `docs/canon/INDEX.md` (remove matching Sections rows)

**Interfaces:**
- After Task 3–4, `node bin/doc-canon.js validate` must pass with initiatives only in `future_plans/INDEX.md`

- [ ] **Step 1: Strip rows**

Remove every section block like:

```yaml
  - id: future-p0-…
    path: future_plans/….md
    role: section
    required: false
    template: FUTURE_PLAN
```

from `CANON_CONTRACT.md`, and matching `| future-p… | future_plans/… |` rows from root `INDEX.md`. Leave initiative markdown files and `future_plans/INDEX.md` Initiatives table intact.

Alternatively run a one-off Node snippet that calls `ensureFuturePlansSkeleton` and writes the returned contract + index strip—then hand-check the diff.

- [ ] **Step 2: Validate**

```bash
npm run build && node bin/doc-canon.js validate
```

Expected: ok, exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/canon/CANON_CONTRACT.md docs/canon/INDEX.md
git commit -m "chore: drop per-initiative future_plans contract sections"
```

---

### Task 6: Managed skills — `canon-future-plan` + handoffs

**Files:**
- Create: `embedded/skills/canon-future-plan/SKILL.md`
- Create/mirror: `.cursor/skills/canon-future-plan/SKILL.md`
- Modify: `embedded/skills/canon-write/SKILL.md`, `.cursor/skills/canon-write/SKILL.md`
- Modify: `embedded/skills/canon-contract/SKILL.md`, `.cursor/skills/canon-contract/SKILL.md`
- Modify: `tests/embedded-assets.test.ts`
- Modify: `docs/acceptance/skill-scenarios.md`

**Interfaces:**
- `copyManagedAssets` already copies all directories under `embedded/skills/` — no CLI change required for discovery.

- [ ] **Step 1: Add failing embedded-asset assertions**

In `tests/embedded-assets.test.ts`:

1. Extend `SKILLS` to include `"canon-future-plan"`.
2. Change the “ships four canon skills” title/count wording to five.
3. Add:

```ts
it("documents canon-future-plan ownership and write handoff", () => {
  const future = readEmbedded("skills", "canon-future-plan", "SKILL.md");
  assert.match(future, /future_plans/i);
  assert.match(future, /FUTURE_PLAN/);
  assert.match(future, /INDEX\.md/);
  assert.match(future, /Scout/i);
  assert.match(future, /draft|refining|absorbed/i);
  assert.match(future, /checklist|task tracker|coding-agent prompt/i);

  const write = readEmbedded("skills", "canon-write", "SKILL.md");
  assert.match(write, /canon-future-plan/);
  assert.match(write, /handoff|stop|invoke/i);

  const contract = readEmbedded("skills", "canon-contract", "SKILL.md");
  assert.match(contract, /canon-future-plan/);
  assert.doesNotMatch(
    contract,
    /register `?future_plans\/<slug>\.md`? with `?required: false`?/,
  );
});
```

4. In acceptance phrase list, replace or add:

```ts
"Future plans authoring uses canon-future-plan",
```

(Keep other phrases; update the old scenario title in the markdown file in Step 3.)

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/embedded-assets.test.ts
```

- [ ] **Step 3: Write `embedded/skills/canon-future-plan/SKILL.md`**

Include at minimum (mirror safety block from other skills):

- Frontmatter `name: canon-future-plan`, description about authoring directional initiatives.
- Safety: SoT `docs/canon/`, never application code, `doc-canon validate`, PATH install hint.
- Scout → Expand before deep reads (narrow set: `future_plans/INDEX.md`, target file, `templates/FUTURE_PLAN.md`).
- Clarify-before-invent (same protocol shape as write: max 3, A/B/C, recommend).
- Workflow: propose `pN`/`pN`+letter + slug + table order; write from `FUTURE_PLAN`; allow Status/Focus/Depends/Unblocks/Design bullets; sync INDEX row/status/priority note; refuse task dumps; validate.
- Absorb: when asked only for status after living absorb, set `absorbed` / update INDEX; do not rewrite living SoT (that is `canon-write`).
- Do not edit `CANON_CONTRACT.md` section list for new initiatives.

Copy the same file to `.cursor/skills/canon-future-plan/SKILL.md`.

- [ ] **Step 4: Update `canon-write`**

Replace workflow items 8–9 with:

- Do **not** create/refine initiatives or edit `future_plans/**` for status/INDEX sync—stop and tell the user to run `canon-future-plan`.
- When absorbing a finished initiative: update living SoT sections only, validate, then instruct `canon-future-plan` to mark `absorbed` / sync INDEX.

Mirror to `.cursor/skills/canon-write/SKILL.md`.

- [ ] **Step 5: Update `canon-contract`**

Replace step 6 (“To add an initiative, … register `required: false`…”) with: initiative files are not registered per-file; stop and hand off to `canon-future-plan`. Keep registration of new **template kinds** and other structural changes.

Mirror to `.cursor/skills/canon-contract/SKILL.md`.

- [ ] **Step 6: Rewrite acceptance scenario**

Replace section title/body currently:

`## Future plans are directional; contract adds optional initiative`

with:

```markdown
## Future plans authoring uses canon-future-plan

- [ ] Confirm `future_plans/INDEX.md` is required and scaffolded by `doc-canon init`, and migrated onto pre-existing canons by `doc-canon upgrade-skills`.
- [ ] Ask `canon-future-plan` to add a new post-MVP initiative; confirm it creates `future_plans/<slug>.md` from `FUTURE_PLAN`, adds an Initiatives INDEX row, does **not** add a per-file contract section, and writes directional prose (no checklists, sprint plans, or `coding_agent_prompt` entries).
- [ ] Ask `canon-write` to add an initiative; confirm it stops and hands off to `canon-future-plan`.
- [ ] Confirm the initiative stays out of behavioral SoT: `canon-audit` does not treat its prose as current-behavior ground truth when judging docs↔code drift.
- [ ] After implementation, confirm `canon-write` absorbs outcomes into living sections, then `canon-future-plan` marks the initiative `absorbed` (INDEX status).
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npm test -- tests/embedded-assets.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add embedded/skills/canon-future-plan .cursor/skills/canon-future-plan \
  embedded/skills/canon-write/SKILL.md .cursor/skills/canon-write/SKILL.md \
  embedded/skills/canon-contract/SKILL.md .cursor/skills/canon-contract/SKILL.md \
  tests/embedded-assets.test.ts docs/acceptance/skill-scenarios.md
git commit -m "feat: add canon-future-plan skill and handoffs from write/contract"
```

---

### Task 7: Bump `skills_stamp` to `0.6.0` and final verify

**Files:**
- Modify: `src/version.ts` (`SKILLS_STAMP = "0.6.0"`)
- Modify: `docs/canon/CANON_CONTRACT.md` (`skills_stamp: "0.6.0"`) — via coding only for stamp sync is historically done in-repo alongside version; if policy requires skill, use `canon-write`/`upgrade-skills` on self after stamp constant change.

- [ ] **Step 1: Bump stamp**

```ts
export const SKILLS_STAMP = "0.6.0";
```

Sync YAML in `docs/canon/CANON_CONTRACT.md`.

- [ ] **Step 2: Full verify**

```bash
npm run build
npm test
node bin/doc-canon.js validate
```

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add src/version.ts docs/canon/CANON_CONTRACT.md
git commit -m "chore: bump skills_stamp to 0.6.0 for canon-future-plan"
```

- [ ] **Step 4: Absorb note (post-ship, may be same session)**

After verify, invoke `canon-write` then `canon-future-plan` (or ask user): confirm living canon matches shipped behavior; mark P0c `absorbed` in `future_plans/INDEX.md` and the initiative file. Separate commit:

```bash
git commit -m "docs: absorb P0c future-plans authoring skill into living canon"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
| --- | --- |
| Dedicated `canon-future-plan` | 6 |
| INDEX-driven validate + orphan exemption + headings | 2–3 |
| No per-file registration / strip migration | 4–5 |
| `canon-write` hard handoff; absorb split | 1, 6 |
| `canon-contract` not registering initiatives | 6 |
| Numbering / directional rules in skill | 6 |
| Acceptance + stamp | 6–7 |
| Canon-first before code | 1 + go-ahead gate |

No declarative `managed_subdir` (non-goal). No P0b/P1/P2/P3 content.
