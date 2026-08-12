# Claude Code Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `doc-canon init` / `upgrade-skills` always install Cursor and Claude Code overlays (dual skill trees + full-body `CLAUDE.md`) with no agent flags, and document the model.

**Architecture:** Extend `copyManagedAssets` to dual-write `embedded/skills/**` into `.cursor/skills/` and `.claude/skills/`, keep Cursor `.mdc` as today, upsert the short block into `AGENTS.md`, and upsert the pointer-rule body (YAML frontmatter stripped) into `CLAUDE.md` using the same `doc-canon` markers. `validate` stays stamp-only for managed-asset currency.

**Tech Stack:** TypeScript (Node ≥20, ESM), `node:test` via `tsx`, existing `src/scaffold/copy-managed.ts` helpers.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-12-claude-code-overlay-design.md`.
- **Canon-first:** Tasks 1–2 must complete; Task 2 needs explicit user go-ahead before Task 3+ changes shippable CLI behavior.
- Coding agents must not edit `docs/canon/**` themselves; use **`canon-future-plan`** (Task 1) and **`canon-write`** (Task 2).
- No new CLI flags (`--claude`, `--agent`, etc.).
- No `validate` checks for presence of `.cursor/**`, `.claude/**`, `AGENTS.md`, or `CLAUDE.md`.
- Skills bodies are identical across hosts (no Claude-specific SKILL forks).
- `CLAUDE.md` managed content = full body of `embedded/rules/doc-canon.mdc` without frontmatter; `AGENTS.md` stays the short `AGENTS.block.md`.
- TDD: failing test → implement → pass → commit per task where code changes.
- Before claiming done: `npm test` and `npm run build`.
- Bump `SKILLS_STAMP` when managed overlay copy behavior / CLAUDE content wiring ships (Task 5).

---

## File Structure

```text
# Future plans (via canon-future-plan — Task 1)
docs/canon/future_plans/p3-production-hardening.md
docs/canon/future_plans/INDEX.md                    # only if status/note needs it

# Living canon (via canon-write — Task 2)
docs/canon/CLI.md
docs/canon/SKILLS.md
docs/canon/ARCHITECTURE.md
docs/canon/OVERVIEW.md
docs/canon/GLOSSARY.md

# Implementation
src/scaffold/copy-managed.ts                        # dual skills, CLAUDE upsert, shared markers
src/commands/upgrade-skills.ts                      # precheck CLAUDE.md markers
src/version.ts                                      # SKILLS_STAMP bump (Task 5)

# Tests
tests/copy-managed.test.ts                          # Create: unit helpers + dual-write
tests/init.test.ts                                  # Claude paths + all skills
tests/upgrade-skills.test.ts                        # Claude migration + malformed CLAUDE.md

# Human docs (not living canon)
README.md                                           # EN + RU
docs/acceptance/skill-scenarios.md
docs/acceptance/mvp-gate.md                         # checklist wording only if still used as template

# This repo as consumer (after stamp / upgrade)
.claude/skills/**                                   # via upgrade-skills or copyManagedAssets
CLAUDE.md
```

---

### Task 1: Align P3 Claude-pack slice via `canon-future-plan`

**Files:**
- Modify (via skill only): `docs/canon/future_plans/p3-production-hardening.md` (and `future_plans/INDEX.md` only if status/ordering note needs it)
- Do not edit living root SoT in this task

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-12-claude-code-overlay-design.md`
- Produces: P3 initiative prose that records dual-write Claude overlay as the approved packaging approach (remaining P3 items stay open)

- [ ] **Step 1: Invoke `canon-future-plan`**

Ask the user to run `/canon-future-plan` (or invoke the skill) with this intent. Do not edit `docs/canon/**` from a coding agent.

Content the skill must land:

1. **Design** link (or related design note) → `docs/superpowers/specs/2026-08-12-claude-code-overlay-design.md` for the Claude overlay slice.
2. **In scope / Intent:** clarify that Claude support for this slice is **universal dual-write** on `init`/`upgrade-skills` (skills → `.cursor` + `.claude`; full rule body → `CLAUDE.md`; short block → `AGENTS.md`; Cursor `.mdc` unchanged) — **not** a separate flag or marketplace plugin.
3. **Open questions:** resolve or drop “Order: publish first vs Claude pack first” for the overlay slice; leave publish/CI/schema-migrate questions as remaining P3.
4. Do **not** mark whole P3 `absorbed` unless the skill and user agree only the Claude slice is done after later absorb — prefer noting the Claude pack approach as decided / in progress while other P3 bullets remain.
5. Run `doc-canon validate` under the skill before claiming success.

- [ ] **Step 2: Commit future_plans edits** (after skill succeeds)

```bash
git add docs/canon/future_plans/
git commit -m "docs: align P3 with Claude dual-write overlay design"
```

---

### Task 2: Living canon via `canon-write` (then STOP)

**Files:**
- Modify (via skill only): `docs/canon/CLI.md`, `docs/canon/SKILLS.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/OVERVIEW.md`, `docs/canon/GLOSSARY.md`

**Interfaces:**
- Consumes: approved design + Task 1 initiative prose
- Produces: living SoT describing dual overlays before code ships

- [ ] **Step 1: Invoke `canon-write`**

Intent for the skill (do not edit canon from a coding agent):

1. **`CLI.md`**
   - Responsibilities / Interfaces: `init` and `upgrade-skills` materialize **Cursor and Claude** managed assets (dual skill trees, Cursor rule, `AGENTS.md` short block, `CLAUDE.md` full pointer-rule body).
   - Open questions: remove “Claude Code overlay deferred” (or replace with “marketplace plugin still out of scope”).
2. **`SKILLS.md`**
   - Scope/Dependencies: managed skills for Cursor **and** Claude Code; packaging is dual-write, not deferred.
   - Note: Claude does not load `.cursor/rules`; always-on for Claude is `CLAUDE.md`.
3. **`ARCHITECTURE.md`**
   - System context: coding agents include Cursor and Claude Code; target repo holds `.cursor/**`, `.claude/skills/**`, `AGENTS.md`, `CLAUDE.md`.
4. **`OVERVIEW.md`**
   - Audience / out of scope: Claude dual-write overlay in scope for packaging; IDE UI / marketplace plugin still out.
5. **`GLOSSARY.md` — Managed assets**
   - Include `.claude/skills/`, `CLAUDE.md` (full rule body), keep short `AGENTS.md` block + Cursor rule.
6. Run `doc-canon validate` (and one-shot `doc-canon index` after substantive writes) before claiming success.

- [ ] **Step 2: Commit living canon** (after skill succeeds)

```bash
git add docs/canon/CLI.md docs/canon/SKILLS.md docs/canon/ARCHITECTURE.md \
  docs/canon/OVERVIEW.md docs/canon/GLOSSARY.md
git commit -m "docs: describe Claude Code dual-write managed overlays"
```

- [ ] **Step 3: STOP — wait for explicit user go-ahead**

Substantial public-contract change. Do not start Task 3 until the user says to implement.

---

### Task 3: Dual-write + `CLAUDE.md` upsert in `copy-managed`

**Files:**
- Create: `tests/copy-managed.test.ts`
- Modify: `src/scaffold/copy-managed.ts`

**Interfaces:**
- Consumes: `embedded/skills/**`, `embedded/rules/doc-canon.mdc`, `embedded/agents/AGENTS.block.md`
- Produces:
  - `export function stripYamlFrontmatter(source: string): string`
  - `export function assertManagedMarkersWellFormed(existing: string, fileLabel: string): void`
  - `export function upsertMarkedBlock(root: string, fileName: string, managedBlock: string): void`
  - `export function copyManagedAssets(root: string): void` — dual skills + rule + `AGENTS.md` + `CLAUDE.md`
  - Keep `upsertAgentsBlock` as a thin wrapper calling `upsertMarkedBlock` with the AGENTS block, **or** inline callers; if removing `assertAgentsMarkersWellFormed`, update `upgrade-skills.ts` import in Task 4 (may temporarily re-export alias for compile)

- [ ] **Step 1: Write the failing unit tests**

Create `tests/copy-managed.test.ts`:

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
import { describe, it } from "node:test";
import {
  copyManagedAssets,
  stripYamlFrontmatter,
  assertManagedMarkersWellFormed,
} from "../src/scaffold/copy-managed.js";
import { embeddedRoot } from "../src/paths.js";

describe("stripYamlFrontmatter", () => {
  it("removes leading YAML frontmatter and keeps the markdown body", () => {
    const source = `---
description: Use the project canon as agent context
alwaysApply: true
---

# doc-canon context rule

Body line.
`;
    assert.equal(
      stripYamlFrontmatter(source),
      "# doc-canon context rule\n\nBody line.\n",
    );
  });

  it("throws when frontmatter is missing", () => {
    assert.throws(
      () => stripYamlFrontmatter("# no frontmatter\n"),
      /frontmatter/i,
    );
  });
});

describe("assertManagedMarkersWellFormed", () => {
  it("names the file in the error", () => {
    assert.throws(
      () =>
        assertManagedMarkersWellFormed(
          "<!-- doc-canon:start -->\nonly start\n",
          "CLAUDE.md",
        ),
      /CLAUDE\.md.*exactly one.*doc-canon:start.*doc-canon:end/i,
    );
  });
});

describe("copyManagedAssets", () => {
  it("dual-writes skills and upserts short AGENTS + full-body CLAUDE", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-copy-managed-"));
    try {
      copyManagedAssets(root);

      const embeddedSkill = readFileSync(
        join(embeddedRoot(), "skills", "canon-write", "SKILL.md"),
        "utf8",
      );
      assert.equal(
        readFileSync(
          join(root, ".cursor", "skills", "canon-write", "SKILL.md"),
          "utf8",
        ),
        embeddedSkill,
      );
      assert.equal(
        readFileSync(
          join(root, ".claude", "skills", "canon-write", "SKILL.md"),
          "utf8",
        ),
        embeddedSkill,
      );

      const rule = readFileSync(
        join(embeddedRoot(), "rules", "doc-canon.mdc"),
        "utf8",
      );
      assert.equal(
        readFileSync(join(root, ".cursor", "rules", "doc-canon.mdc"), "utf8"),
        rule,
      );

      const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
      assert.match(agents, /<!-- doc-canon:start -->/);
      assert.match(agents, /For design and development, treat `docs\/canon\/`/);

      const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
      assert.match(claude, /<!-- doc-canon:start -->/);
      assert.match(claude, /# doc-canon context rule/);
      assert.match(claude, /Feature-change order \(canon-first\)/);
      assert.doesNotMatch(claude, /^---$/m);
      assert.doesNotMatch(claude, /alwaysApply/);

      const body = stripYamlFrontmatter(rule).trim();
      assert.match(claude, new RegExp(body.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves CLAUDE.md prose outside markers on re-upsert", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-claude-upsert-"));
    try {
      writeFileSync(
        join(root, "CLAUDE.md"),
        `User preface.\n\n<!-- doc-canon:start -->\nstale\n<!-- doc-canon:end -->\n\nUser epilogue.\n`,
      );
      copyManagedAssets(root);
      const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
      assert.match(claude, /^User preface\./);
      assert.match(claude, /User epilogue\./);
      assert.match(claude, /# doc-canon context rule/);
      assert.doesNotMatch(claude, /\nstale\n/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx tsx --test tests/copy-managed.test.ts`  
Expected: FAIL — `stripYamlFrontmatter` / `assertManagedMarkersWellFormed` not exported or CLAUDE / `.claude/skills` missing.

- [ ] **Step 3: Implement minimal `copy-managed.ts`**

Replace / extend `src/scaffold/copy-managed.ts` to match this shape (preserve `copyDirectoryFiles` behavior):

```ts
import fs from "node:fs";
import path from "node:path";
import { embeddedRoot } from "../paths.js";

const START_MARKER = "<!-- doc-canon:start -->";
const END_MARKER = "<!-- doc-canon:end -->";

export function stripYamlFrontmatter(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) {
    throw new Error(
      "embedded pointer rule is missing YAML frontmatter to strip for CLAUDE.md",
    );
  }
  return match[1].replace(/^\r?\n/, "");
}

export function assertManagedMarkersWellFormed(
  existing: string,
  fileLabel: string,
): void {
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  const startCount = existing.split(START_MARKER).length - 1;
  const endCount = existing.split(END_MARKER).length - 1;
  const hasNoMarkers = startCount === 0 && endCount === 0;
  const hasValidManagedBlock =
    startCount === 1 && endCount === 1 && start < end;
  if (!hasNoMarkers && !hasValidManagedBlock) {
    throw new Error(
      `${fileLabel} has malformed doc-canon markers: expected exactly one ` +
        "doc-canon:start and one doc-canon:end marker, with start before end. " +
        "Fix the markers and retry.",
    );
  }
}

/** @deprecated Prefer assertManagedMarkersWellFormed(existing, "AGENTS.md") */
export function assertAgentsMarkersWellFormed(existing: string): void {
  assertManagedMarkersWellFormed(existing, "AGENTS.md");
}

function copyDirectoryFiles(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectoryFiles(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

export function upsertMarkedBlock(
  root: string,
  fileName: string,
  managedBlock: string,
): void {
  const filePath = path.join(root, fileName);
  const block = managedBlock.trim();
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  assertManagedMarkersWellFormed(existing, fileName);
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  const startCount = existing.split(START_MARKER).length - 1;

  let next: string;
  if (startCount === 0) {
    next = `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${block}\n`;
  } else {
    next =
      existing.slice(0, start) + block + existing.slice(end + END_MARKER.length);
  }
  fs.writeFileSync(filePath, next);
}

export function upsertAgentsBlock(root: string): void {
  const managedBlock = fs
    .readFileSync(path.join(embeddedRoot(), "agents", "AGENTS.block.md"), "utf8")
    .trim();
  upsertMarkedBlock(root, "AGENTS.md", managedBlock);
}

export function upsertClaudeBlock(root: string): void {
  const ruleSource = fs.readFileSync(
    path.join(embeddedRoot(), "rules", "doc-canon.mdc"),
    "utf8",
  );
  const body = stripYamlFrontmatter(ruleSource).trim();
  const managedBlock = `${START_MARKER}\n${body}\n${END_MARKER}`;
  upsertMarkedBlock(root, "CLAUDE.md", managedBlock);
}

export function copyManagedAssets(root: string): void {
  for (const name of ["AGENTS.md", "CLAUDE.md"] as const) {
    const filePath = path.join(root, name);
    if (fs.existsSync(filePath)) {
      assertManagedMarkersWellFormed(fs.readFileSync(filePath, "utf8"), name);
    }
  }

  const skillsSource = path.join(embeddedRoot(), "skills");
  copyDirectoryFiles(skillsSource, path.join(root, ".cursor", "skills"));
  copyDirectoryFiles(skillsSource, path.join(root, ".claude", "skills"));

  const rulesRoot = path.join(root, ".cursor", "rules");
  fs.mkdirSync(rulesRoot, { recursive: true });
  fs.copyFileSync(
    path.join(embeddedRoot(), "rules", "doc-canon.mdc"),
    path.join(rulesRoot, "doc-canon.mdc"),
  );

  upsertAgentsBlock(root);
  upsertClaudeBlock(root);
}
```

Adjust the first unit test’s exact `stripYamlFrontmatter` expectation if the embedded rule’s trailing newline differs — prefer asserting with `stripYamlFrontmatter(rule)` equality against the CLAUDE managed span rather than a hard-coded miniature fixture when comparing full install.

- [ ] **Step 4: Run unit tests to verify they pass**

Run: `npx tsx --test tests/copy-managed.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/scaffold/copy-managed.ts tests/copy-managed.test.ts
git commit -m "feat: dual-write Cursor and Claude managed overlays"
```

---

### Task 4: Init / upgrade integration tests + CLAUDE precheck

**Files:**
- Modify: `src/commands/upgrade-skills.ts`
- Modify: `tests/init.test.ts`
- Modify: `tests/upgrade-skills.test.ts`

**Interfaces:**
- Consumes: `copyManagedAssets`, `assertManagedMarkersWellFormed` from Task 3
- Produces: `upgradeSkills` prechecks both `AGENTS.md` and `CLAUDE.md` when present; init/upgrade tests cover `.claude/skills` and `CLAUDE.md`

- [ ] **Step 1: Write failing init/upgrade assertions**

In `tests/init.test.ts`:

1. Extend `SKILLS` to include `"canon-future-plan"`.
2. After Cursor skill asserts, also assert each skill exists under `.claude/skills/<name>/SKILL.md`.
3. Assert `CLAUDE.md` exists with markers and contains `# doc-canon context rule` (and does not contain `alwaysApply`).

In `tests/upgrade-skills.test.ts`:

1. In “refreshes managed assets…”, after upgrade assert `.claude/skills/canon-write/SKILL.md` matches embedded and `CLAUDE.md` has full rule body (not short AGENTS wording only — e.g. match `Feature-change order`).
2. Add a migration case: after init, `rmSync` `.claude` and rewrite `CLAUDE.md` away; `upgradeSkills` restores both.
3. Duplicate the malformed-marker loop for `CLAUDE.md` (error must mention `CLAUDE.md`; stale `.claude` skill must remain unchanged on reject — mirror AGENTS tests). Update `assertUpgradePreconditions` so CLAUDE is checked **before** `copyManagedAssets` (same as AGENTS).

Example migration test body:

```ts
it("restores Claude overlay on upgrade for Cursor-only trees", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-claude-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    rmSync(join(root, ".claude"), { recursive: true, force: true });
    rmSync(join(root, "CLAUDE.md"), { force: true });
    assert.equal(await upgradeSkills(root), 0);
    assert.equal(
      existsSync(join(root, ".claude", "skills", "canon-write", "SKILL.md")),
      true,
    );
    assert.match(
      readFileSync(join(root, "CLAUDE.md"), "utf8"),
      /# doc-canon context rule/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the new/updated tests — expect fail on precheck / missing asserts until wired**

Run: `npx tsx --test tests/init.test.ts tests/upgrade-skills.test.ts`  
Expected: FAIL on Claude assertions and/or malformed CLAUDE if precheck missing.

- [ ] **Step 3: Update `assertUpgradePreconditions` in `upgrade-skills.ts`**

```ts
function assertUpgradePreconditions(root: string): string {
  const updatedContract = upgradedContractMarkdown(root);
  for (const name of ["AGENTS.md", "CLAUDE.md"] as const) {
    const filePath = path.join(root, name);
    if (fs.existsSync(filePath)) {
      fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
      assertManagedMarkersWellFormed(fs.readFileSync(filePath, "utf8"), name);
    }
  }
  return updatedContract;
}
```

Import `assertManagedMarkersWellFormed` (keep or drop `assertAgentsMarkersWellFormed`).

Also update the “rejects a missing contract…” test expectations if it asserts Claude paths absent — still fine (`CLAUDE.md` false).

- [ ] **Step 4: Re-run tests**

Run: `npx tsx --test tests/init.test.ts tests/upgrade-skills.test.ts tests/copy-managed.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/upgrade-skills.ts tests/init.test.ts tests/upgrade-skills.test.ts
git commit -m "test: cover Claude overlay init and upgrade paths"
```

---

### Task 5: Docs (README/acceptance), stamp bump, refresh this repo

**Files:**
- Modify: `README.md` (EN + RU sections)
- Modify: `docs/acceptance/skill-scenarios.md`
- Modify: `docs/acceptance/mvp-gate.md` (checklist item 1 wording for future runs)
- Modify: `src/version.ts` (`SKILLS_STAMP`)
- Modify: `docs/canon/CANON_CONTRACT.md` — **only** via `upgrade-skills` / stamp write path, not hand-edit if avoidable; running upgrade on this repo updates stamp in contract
- Create/update via upgrade: `.claude/skills/**`, `CLAUDE.md` in this repository
- Optionally update `tests/embedded-assets.test.ts` only if acceptance string checks mention Cursor-only Claude deferral

**Interfaces:**
- Consumes: Task 3–4 behavior
- Produces: `SKILLS_STAMP` bumped (e.g. `"0.10.1"` → `"0.11.0"`); human docs describe dual overlay; this repo has Claude assets

- [ ] **Step 1: Bump stamp**

In `src/version.ts`:

```ts
export const SKILLS_STAMP = "0.11.0";
```

- [ ] **Step 2: Update README EN + RU**

Replace Cursor-only / “Claude later” lines with:

- `init` installs `.cursor/skills`, `.claude/skills`, `.cursor/rules/doc-canon.mdc`, short `AGENTS.md` block, and full-body managed `CLAUDE.md`.
- Claude Code loads skills from `.claude/skills/` and always-on from `CLAUDE.md`; it does **not** read `.cursor/rules/`.
- `upgrade-skills` refreshes both overlays.

Mirror the same in the Russian section (~lines 216 / 254 / 288).

- [ ] **Step 3: Update acceptance checklists**

In `docs/acceptance/skill-scenarios.md` under “Pointer rule and AGENTS block after init”, add bullets:

- Confirm `.claude/skills/` mirrors managed skills (same names as `.cursor/skills/`).
- Confirm `CLAUDE.md` has exactly one `doc-canon` marker pair and includes the full pointer-rule body (e.g. Feature-change order), not only the short AGENTS sentence.
- Confirm `.cursor/rules/doc-canon.mdc` remains Cursor-only guidance.

In `docs/acceptance/mvp-gate.md` item 1, change wording to expect five skills (include `canon-future-plan`), both skill trees, rule, `AGENTS.md`, and `CLAUDE.md`.

- [ ] **Step 4: Refresh this repository’s managed assets**

```bash
npm run build
node bin/doc-canon.js upgrade-skills --root .
```

Expected: exit 0; `.claude/skills/**` present; `CLAUDE.md` created/updated; contract `skills_stamp: "0.11.0"`.

- [ ] **Step 5: Full verify**

```bash
npm test
npm run build
node bin/doc-canon.js validate --root .
```

Expected: all PASS / Canon is valid.

- [ ] **Step 6: Commit**

```bash
git add src/version.ts README.md docs/acceptance/skill-scenarios.md \
  docs/acceptance/mvp-gate.md docs/canon/CANON_CONTRACT.md \
  CLAUDE.md .claude/skills AGENTS.md .cursor/skills .cursor/rules
git commit -m "feat: ship Claude Code overlay docs and skills_stamp 0.11.0"
```

Only stage paths that actually changed; do not add `.DS_Store`.

---

### Task 6: Closing canon-audit (optional but recommended)

**Files:**
- Via skill only: any drift fixes under `docs/canon/**` / `DISCREPANCIES.md`

**Interfaces:**
- Consumes: implemented overlay + living canon from Task 2
- Produces: audit confirmation or recorded discrepancies

- [ ] **Step 1: Invoke `canon-audit`** on topic “Claude Code managed overlay / dual-write init”

- [ ] **Step 2: Commit any audit-owned canon fixes** if the skill made them

```bash
git add docs/canon/
git commit -m "docs: close Claude overlay audit findings"
```

Skip empty commit if nothing changed.

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Dual skill copy always | 3, 4 |
| Full rule body in `CLAUDE.md` | 3 |
| Short `AGENTS.md` block | 3 (regression) |
| Cursor `.mdc` unchanged | 3 |
| No agent flags | Global + no CLI task |
| No validate overlay presence | Global + no validate changes |
| upgrade migrates Cursor-only | 4 |
| Malformed CLAUDE markers fail closed | 3 assert + 4 upgrade |
| Living canon + README + acceptance | 2, 5 |
| Stamp bump | 5 |
| P3 initiative alignment | 1 |
| Closing audit | 6 |

## Placeholder / consistency check

- Signatures `stripYamlFrontmatter`, `assertManagedMarkersWellFormed`, `upsertMarkedBlock`, `upsertClaudeBlock`, `copyManagedAssets` are consistent across Tasks 3–4.
- Stamp value `0.11.0` used in Task 5 only; adjust if `SKILLS_STAMP` moved before execution — set to next minor above whatever is current in `src/version.ts`.
