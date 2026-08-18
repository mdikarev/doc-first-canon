# P2c — Code Analysis Rules for Agents & Skills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship agent-facing rules that make code-index-first analysis the default (with miss reporting and expand-when-thin preserved), add the same index-first discipline to `canon-bootstrap`/`canon-audit`, and lock the payoff in with a token-cost guard test.

**Architecture:** All production changes live in managed content — the `AGENTS.md` block, the Cursor pointer rule / `CLAUDE.md` body, and the `canon-bootstrap`/`canon-audit` skill sources under `embedded/` — plus tests. There is no new runtime code path in `doc-canon`; `code-index build`/`search` (P2a/P2b) are already shipped and unchanged. Canon sections (`SKILLS.md`, `GLOSSARY.md`, `OVERVIEW.md`) and the initiative are updated first via the canon skills (`canon-write`, `canon-future-plan`), then managed content, then tests, then a closing `canon-audit`.

**Tech Stack:** TypeScript (Node ≥20, ESM, `node:test`, tsx). Commands: `npm test` (`tsx --test tests/**/*.test.ts`), `npm run build` (`tsc -p tsconfig.json`).

**Spec:** [`docs/superpowers/specs/2026-08-18-p2c-code-analysis-rules-design.md`](../specs/2026-08-18-p2c-code-analysis-rules-design.md) — the plan argues from the spec; executors read both.

## Global Constraints

- **Canon-first (from AGENTS.md / pointer rule):** never edit `docs/canon/**` directly. Canon edits go through the `canon-write` skill; `future_plans/**` edits go through the `canon-future-plan` skill. Managed paths (`AGENTS.md`, `CLAUDE.md`, `.cursor/skills/**`, `.claude/skills/**`) are regenerated via `copyManagedAssets`, never hand-edited.
- **Canonical rule text (verbatim from spec):** miss format is `code_miss: <query> -> source:<path>`; covered languages are TypeScript/JavaScript, Go, C#, Rust, Python (extensions `.ts`, `.tsx`, `.js`, `.jsx`, `.go`, `.cs`, `.rs`, `.py`); uncovered languages go straight to source.
- **Rule is guidance, not a CLI gate:** no changes to `code-index build`/`search`, `searchCodeIndex`, `CodePack`, or any `doc-canon` CLI surface.
- **Quality over thrift:** expand-when-thin is preserved; a thin probe never licenses under-reading.
- **Test conventions:** `node:test` + `node:assert/strict`; fixtures in temp dirs cleaned in `afterEach`; follow the existing `tests/code-search.test.ts` and `tests/copy-managed.test.ts` patterns.
- **Gate after canon changes:** the spec requires an explicit user go-ahead after the substantial canon updates (Tasks 1–2) before implementation begins (Tasks 3+). Stop and wait.

---

### Task 1: Canon-first — update living canon via `canon-write`

**Files:**
- Modify: `docs/canon/SKILLS.md` (line ~17 paragraph)
- Modify: `docs/canon/GLOSSARY.md` (new term after `code_index_missing`, ~line 109)
- Modify: `docs/canon/OVERVIEW.md` (Scope → In scope, after the code pack bullet ~line 29)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: updated living canon that Tasks 3–4's managed content must match (rule text, miss format, covered-language list).

- [ ] **Step 1: Invoke the `canon-write` skill**

Load the `canon-write` skill (skill tool). It owns `docs/canon/**`; do not edit those files directly. Follow its Scout → Expand protocol with the working set `{SKILLS.md, GLOSSARY.md, OVERVIEW.md}` (verdict: sufficient), then apply the three edits below.

- [ ] **Step 2: `SKILLS.md` — extend the shared dual-audience recipe paragraph**

In the paragraph beginning "Agents that use the canon follow a shared dual-audience recipe…" (ends with "**Quality over thrift:** expand when doubtful; never silently under-read or invent facts to save tokens."), append this sentence:

> For **code analysis** in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), agents apply the same discipline through the code index first: try `doc-canon code-index search` before whole-file source reads, then read source as evidence when the probe is empty or thin and note the miss (`code_miss: <query> -> source:<path>`). `canon-bootstrap` and `canon-audit` build the indexes first (`doc-canon index`, `doc-canon code-index build` when covered source exists) and prefer index search for their goals when the indexes exist.

- [ ] **Step 3: `GLOSSARY.md` — add the `code_miss` term**

Insert a new term directly after the `code_index_missing` entry (before `### Code pack`):

```markdown
### code_miss
An agent-facing miss report when a code-index probe returns nothing or a thin set: the agent reads source as evidence and notes `code_miss: <query> -> source:<path>`, mirroring the canon's visible Expand gate. Code-index-first analysis applies to the five covered languages (TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages go straight to source.
```

- [ ] **Step 4: `OVERVIEW.md` — add the code-index-first discipline bullet**

In **Scope → In scope**, directly after the bullet beginning "Bounded code packs via public `searchCodeIndex`…", add:

```markdown
- Code-index-first analysis discipline for covered languages: the pointer rule, `AGENTS.md` block, and canon skills require trying `code-index search` before whole-file source reads; empty/thin results fall back to source with a `code_miss` note (quality over thrift)
```

- [ ] **Step 5: Validate and index**

Run `doc-canon validate` (must pass). Per the `canon-write` recipe, after the substantive write run the one-shot `doc-canon index` (if a watch holds the lock, surface it and rely on the watch). Commit the three canon files.

```bash
git add docs/canon/SKILLS.md docs/canon/GLOSSARY.md docs/canon/OVERVIEW.md
git commit -m "docs(canon): add code-index-first analysis discipline for P2c"
```

---

### Task 2: Mark P2c implementing + Design link via `canon-future-plan`

**Files:**
- Modify: `docs/canon/future_plans/p2c-code-analysis-rules.md`
- Modify: `docs/canon/future_plans/INDEX.md` (row 36, P2c status)

**Interfaces:**
- Consumes: Task 1's living canon (P2c is now reflected in `SKILLS.md`/`GLOSSARY.md`/`OVERVIEW.md`).
- Produces: P2c initiative at `implementing` with the Design link and resolved open questions, so the closing absorb (Task 8) only flips status to `absorbed`.

- [ ] **Step 1: Invoke the `canon-future-plan` skill**

Load the `canon-future-plan` skill. It owns `docs/canon/future_plans/**`; do not edit those files directly. This is a refine + status change, so Scout → Expand with the working set `{future_plans/INDEX.md, p2c-code-analysis-rules.md, templates/FUTURE_PLAN.md}` (verdict: sufficient).

- [ ] **Step 2: Update the initiative header**

Set the Status bullet to `implementing` and add a Design line after it:

```markdown
- **Status:** implementing
- **Design:** [`docs/superpowers/specs/2026-08-18-p2c-code-analysis-rules-design.md`](../../superpowers/specs/2026-08-18-p2c-code-analysis-rules-design.md) — SoT for the agent-facing code-analysis rules and the index-first skill discipline
```

- [ ] **Step 3: Resolve the Open questions section**

Replace the three `- ` bullets under `## Open questions` with the resolved decisions (keep the heading):

```markdown
- Rule strength: **miss reporting** — agent reads source but must note the miss (`code_miss: <query> -> source:<path>`), mirroring the canon's visible Expand gate (resolved in design)
- Token-cost guard: **bounded pack vs full files** on a fixture repo — structural comparison of snippet bytes vs full source bytes (resolved in design)
- Language scope: **global for the five covered languages**; uncovered languages go straight to source (resolved in design)
```

- [ ] **Step 4: Update the `future_plans/INDEX.md` table row**

Change row `2c | Code analysis rules for agents & skills | draft` to status `implementing`. No ordering change is needed (P2c stays above P4/P5).

- [ ] **Step 5: Validate and commit**

Run `doc-canon validate` (must pass). Commit:

```bash
git add docs/canon/future_plans/p2c-code-analysis-rules.md docs/canon/future_plans/INDEX.md
git commit -m "docs(canon): mark P2c implementing with design link"
```

- [ ] **Step 6: STOP — wait for user go-ahead**

Per the spec's implementation order, present the canon changes and wait for the user's explicit go-ahead before proceeding to Task 3. Do not continue automatically.

---

### Task 3: Managed content — AGENTS block + pointer rule

**Files:**
- Modify: `embedded/agents/AGENTS.block.md`
- Modify: `embedded/rules/doc-canon.mdc`

**Interfaces:**
- Consumes: Task 1's canonical rule text (the embedded content must match the canon wording).
- Produces: the two embedded sources that `copyManagedAssets` copies into target repos; Task 7 asserts on them.

- [ ] **Step 1: Write the failing test first**

Add to the new rule-scenario test file (create it now; Task 7 completes it):

```ts
// tests/code-analysis-rules.test.ts
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { embeddedRoot } from "../src/paths.js";
import { copyManagedAssets } from "../src/scaffold/copy-managed.js";

function readEmbedded(...parts: string[]): string {
  const p = join(embeddedRoot(), ...parts);
  assert.equal(existsSync(p), true, `missing embedded asset: ${parts.join("/")}`);
  return readFileSync(p, "utf8");
}

describe("code analysis rules", () => {
  it("ships code-index-first rule in AGENTS block and pointer rule", () => {
    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /code-index search/);
    assert.match(block, /code_miss/);

    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /## Code analysis order/);
    assert.match(rule, /code-index search/);
    assert.match(rule, /code_miss/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/code-analysis-rules.test.ts`
Expected: FAIL — `code-index search` and `code_miss` not present in the embedded assets.

- [ ] **Step 3: Update `embedded/agents/AGENTS.block.md`**

Append one sentence to the existing managed block (the block currently ends with "…use canon skills / `DISCREPANCIES.md`."), keeping it short:

> During code analysis in a covered language, try `doc-canon code-index search` first; on empty/thin results, read source and note the miss (`code_miss`).

- [ ] **Step 4: Update `embedded/rules/doc-canon.mdc`**

Add a new section after the "Feature-change order (canon-first)" block (after the "Post-hoc sync…" paragraph, before "On docs↔code divergence…"):

```markdown
## Code analysis order

For code analysis in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), try `doc-canon code-index search <symbol> --root <repo>` before reading whole source files. Use the bounded snippet windows as the first probe. When the probe returns nothing or a thin set — or the code index is missing/stale (see CLI warnings) — read the source files as evidence and note the miss (`code_miss: <query> -> source:<path>`). Quality over thrift: never let a thin probe license under-reading. Languages outside the covered set go straight to source. `canon-bootstrap` and `canon-audit` build the indexes first (`doc-canon index`, `doc-canon code-index build` when covered source exists) and prefer index search for their goals when the indexes exist.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/code-analysis-rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add embedded/agents/AGENTS.block.md embedded/rules/doc-canon.mdc tests/code-analysis-rules.test.ts
git commit -m "feat: add code-index-first rule to AGENTS block and pointer rule"
```

---

### Task 4: Skill sources — index-first discipline in canon-bootstrap and canon-audit

**Files:**
- Modify: `embedded/skills/canon-bootstrap/SKILL.md`
- Modify: `embedded/skills/canon-audit/SKILL.md`

**Interfaces:**
- Consumes: Task 1's canonical rule text (index-first skill discipline wording).
- Produces: the two skill sources that `copyManagedAssets` dual-writes to `.cursor/skills/` and `.claude/skills/`; Task 7 asserts on them.

- [ ] **Step 1: Extend the rule-scenario test**

Append this test to `tests/code-analysis-rules.test.ts`:

```ts
it("canon-bootstrap and canon-audit build indexes first and search-first", () => {
  for (const skill of ["canon-bootstrap", "canon-audit"]) {
    const s = readEmbedded("skills", skill, "SKILL.md");
    assert.match(s, /doc-canon index/);
    assert.match(s, /code-index build/);
    assert.match(s, /code-index search|doc-canon search/);
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/code-analysis-rules.test.ts`
Expected: FAIL — `doc-canon index` / `code-index build` not present in both skills.

- [ ] **Step 3: Update `embedded/skills/canon-bootstrap/SKILL.md`**

In the **Workflow** numbered list, insert a new step **after step 5** (`Run doc-canon validate. After it succeeds, import sources outside docs/canon/ are not SoT. Do not delete or silently update those legacy files.`) and renumber subsequent steps:

```markdown
6. Build the retrieval indexes: run `doc-canon index` (canon BM25) and, when covered source exists, `doc-canon code-index build`. Later goal steps prefer `doc-canon search` / `code-index search` when the indexes exist; on empty/thin probe results, read source as evidence and note the miss (`code_miss: <query> -> source:<path>`).
```

- [ ] **Step 4: Update `embedded/skills/canon-audit/SKILL.md`**

In the **Audit flow**, extend step 3 ("Try search first…") with the build-first prerequisite:

```markdown
3. **Try search first:** ensure the indexes are built — hint `doc-canon index` when the canon index is missing, and when covered source is in scope for code-divergence evidence, `doc-canon code-index build`. Then run `doc-canon search "<topic>"` (and `code-index search` for code evidence) and seed the working set from pack paths and snippet stubs. If search fails closed, hint `doc-canon index` and fall back to INDEX-first Scout. If `index_stale`, surface the warning and continue; Expand when thin.
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- tests/code-analysis-rules.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add embedded/skills/canon-bootstrap/SKILL.md embedded/skills/canon-audit/SKILL.md tests/code-analysis-rules.test.ts
git commit -m "feat: index-first discipline in canon-bootstrap and canon-audit skills"
```

---

### Task 5: Regenerate this repo's managed copies

**Files:**
- Modify (regenerated): `AGENTS.md`, `CLAUDE.md`, `.cursor/skills/**`, `.claude/skills/**`

**Interfaces:**
- Consumes: Tasks 3–4 embedded sources.
- Produces: this repo's own pointer block, `CLAUDE.md` body, and dual-written skill trees in sync with `embedded/`; Task 7 verifies the copies match.

- [ ] **Step 1: Regenerate via `copyManagedAssets`**

Run the repo's own managed-asset copy so `AGENTS.md`, `CLAUDE.md`, `.cursor/skills/**`, and `.claude/skills/**` reflect the new embedded content:

```bash
npx tsx -e "import { copyManagedAssets } from './src/scaffold/copy-managed.ts'; copyManagedAssets(process.cwd());"
```

- [ ] **Step 2: Verify the copies picked up the rule**

```bash
grep -n "code-index search" AGENTS.md CLAUDE.md
ls .claude/skills .cursor/skills
grep -rn "doc-canon index" .claude/skills/canon-bootstrap/SKILL.md .claude/skills/canon-audit/SKILL.md
```

Expected: `code-index search` appears in `AGENTS.md` and `CLAUDE.md`; both `.claude` and `.cursor` skill trees exist; `doc-canon index` appears in the regenerated bootstrap/audit skills.

- [ ] **Step 3: Confirm embedded ↔ copies match**

```bash
diff -r embedded/skills .claude/skills && echo CLAUDE-SAME
diff -r embedded/skills .cursor/skills && echo CURSOR-SAME
```

Expected: `CLAUDE-SAME` and `CURSOR-SAME` (`.DS_Store` differences in embedded are acceptable).

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including `tests/embedded-assets.test.ts` and the new `tests/code-analysis-rules.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md .cursor/skills .claude/skills
git commit -m "feat: regenerate managed copies with code-analysis rules"
```

---

### Task 6: Token-cost guard test

**Files:**
- Create: `tests/code-analysis-token-guard.test.ts`

**Interfaces:**
- Consumes: `syncCodeIndex(root)` from `src/code-index/sync.js` (returns `{ status, indexed, changed }`), `searchCodeIndex(root, query)` from `src/code-search/search.js` (returns `CodePack` with `hits[].snippets[].text`).
- Produces: the guard proving the bounded pack reads fewer bytes than full source files.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-analysis-token-guard.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex } from "../src/code-search/search.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "token-guard-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function bigFile(prefix: string, lines: number): string {
  const body: string[] = [`export class ${prefix} {`];
  for (let i = 0; i < lines; i++) body.push(`  field${i} = ${i};`);
  body.push("}");
  return body.join("\n");
}

describe("code-analysis token-cost guard", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/a.ts", bigFile("Alpha", 200));
    write(repo, "src/b.ts", bigFile("Beta", 200));
    write(repo, "src/c.ts", bigFile("Gamma", 200));
    write(repo, "src/d.ts", bigFile("Delta", 200));
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("bounded code pack reads fewer bytes than full source files", () => {
    const pack = searchCodeIndex(repo, "Alpha");
    assert.ok(pack.hits.length >= 1);
    const packBytes = pack.hits.reduce(
      (sum, h) => sum + h.snippets.reduce((s, w) => s + Buffer.byteLength(w.text, "utf8"), 0),
      0,
    );
    let fullBytes = 0;
    for (const rel of ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"]) {
      fullBytes += Buffer.byteLength(fs.readFileSync(path.join(repo, rel), "utf8"));
    }
    assert.ok(packBytes > 0, "pack must contain snippet bytes");
    assert.ok(
      packBytes < fullBytes,
      `pack ${packBytes}B should be < full source ${fullBytes}B`,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it passes**

Run: `npm test -- tests/code-analysis-token-guard.test.ts`
Expected: PASS — symbol snippet is capped at 4 lines (declaration window), files are 202 lines, so `packBytes` ≪ `fullBytes`.

- [ ] **Step 3: Commit**

```bash
git add tests/code-analysis-token-guard.test.ts
git commit -m "test: token-cost guard for code-index-first analysis"
```

---

### Task 7: Complete the rule-scenario tests

**Files:**
- Modify: `tests/code-analysis-rules.test.ts`

**Interfaces:**
- Consumes: Task 3–4 embedded content and `copyManagedAssets`.
- Produces: full rule-scenario coverage — embedded rule text, `copyManagedAssets` propagation, and skill-source discipline.

- [ ] **Step 1: Add the propagation test**

Append to `tests/code-analysis-rules.test.ts`:

```ts
it("propagates the rule to a target repo via copyManagedAssets", () => {
  const root = mkdtempSync(join(tmpdir(), "code-analysis-rules-"));
  try {
    copyManagedAssets(root);
    const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
    assert.match(agents, /code-index search/);
    assert.match(agents, /code_miss/);
    const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
    assert.match(claude, /## Code analysis order/);
    assert.match(claude, /code-index search/);
    assert.match(claude, /code_miss/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: PASS across the suite.

- [ ] **Step 3: Typecheck**

Run: `npm run build`
Expected: tsc emits with no errors.

- [ ] **Step 4: Commit**

```bash
git add tests/code-analysis-rules.test.ts
git commit -m "test: rule-scenario coverage for code-analysis rules"
```

---

### Task 8: Close with `canon-audit` and mark P2c absorbed

**Files:**
- Audit: `docs/canon/**` (via `canon-audit` skill)
- Modify (via `canon-future-plan`): `docs/canon/future_plans/p2c-code-analysis-rules.md`, `docs/canon/future_plans/INDEX.md`

**Interfaces:**
- Consumes: all prior tasks (living canon + managed content + tests in sync).
- Produces: verified canon↔code agreement and P2c at `absorbed`.

- [ ] **Step 1: Run `doc-canon validate` and `doc-canon check`**

Expected: validate passes; check refreshes the inventory and CLI findings.

- [ ] **Step 2: Invoke the `canon-audit` skill**

Load `canon-audit`. Run its semantic pass on the affected topic (skills, retrieval, code analysis rules): verify `SKILLS.md`/`GLOSSARY.md`/`OVERVIEW.md` agree with the embedded managed content and skill sources, no orphaned sections, no docs↔code divergence introduced. Resolve any open findings via the discrepancy dialogue. Run `doc-canon validate` again after any edits.

- [ ] **Step 3: Mark P2c absorbed via `canon-future-plan`**

Invoke `canon-future-plan`; set `p2c-code-analysis-rules.md` Status to `absorbed`, update `future_plans/INDEX.md` row 36 to `absorbed`. Run `doc-canon validate`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs(canon): absorb P2c code analysis rules; mark absorbed"
```

---

## Self-Review Notes

- **Spec coverage:** Goals 1–3 (rule text + miss reporting + global scope) → Tasks 3, 4; Goal 4 (skill discipline) → Task 4; Goal 5 (token-cost guard) → Task 6; Goal 6 (rule-scenario tests) → Tasks 3, 7; canon absorption → Tasks 1, 2, 8; `copyManagedAssets` regeneration → Task 5.
- **Placeholders:** none — every content step carries the exact prose or code.
- **Type consistency:** uses only existing APIs (`syncCodeIndex`, `searchCodeIndex`, `copyManagedAssets`, `embeddedRoot`); no new runtime symbols are introduced, so no signature drift across tasks.
