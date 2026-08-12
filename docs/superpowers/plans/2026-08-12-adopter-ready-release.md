# Adopter-ready first public release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first public `doc-canon@0.1.x` (npm + MIT + local `npm run release`) and a `doc-canon migrate` command that fills gaps against the **target repo’s existing contract**, then runs `upgrade-skills`.

**Architecture:** `migrate` is a thin orchestrator: fail-closed schema/precheck → `ensureRequiredGaps` (create missing **required** files/templates and missing INDEX Sections rows only) → public `upgradeSkills()` (overlays, future_plans skeleton, stamp, trailing `validate`). No schema rewriter, no default-kit injection, no dogfood GitHub Actions.

**Tech Stack:** TypeScript (Node ≥20, ESM), `commander`, `yaml`, `node:test` via `tsx`, bash `scripts/release.sh`.

## Global Constraints

- Spec SoT: `docs/superpowers/specs/2026-08-12-adopter-ready-release-design.md`.
- **Canon-first:** Tasks 1–2 must complete; Task 2 is a substantial new command surface — **wait for explicit user go-ahead** before Task 4+ application code.
- Coding agents must not edit `docs/canon/**` themselves; use **`canon-future-plan`** (Task 1) and **`canon-write`** (Task 2).
- `migrate` v1 flags: `--root` only (no `--yes`, no command `--dry-run`).
- `schema_version` other than `1`: non-zero **before any scaffold writes**; do not rewrite YAML.
- Gap-fill vs **target contract only**: do not inject `default-contract.ts` sections (including this repo’s extra `CLI.md` / `SKILLS.md`).
- Do not call public `upgrade-skills` before missing required files exist (its trailing validate would abort migrate).
- Do not add `.github/workflows` in this checkpoint.
- Git tag/push is **not** part of `scripts/release.sh`.
- License: MIT.
- TDD: failing test → implement → pass → commit per task where code changes.
- Before claiming done: `npm test` and `npm run build`.
- Do not bump `SKILLS_STAMP` unless an embedded skill/rule file actually changes (this plan does not require that).

---

## File Structure

```text
# Future plans (via canon-future-plan — Task 1)
docs/canon/future_plans/p3-production-hardening.md
docs/canon/future_plans/INDEX.md                    # status/blurb only if the skill updates it

# Living canon (via canon-write — Task 2)
docs/canon/CLI.md
docs/canon/OVERVIEW.md
docs/canon/ARCHITECTURE.md
docs/canon/GLOSSARY.md
docs/canon/SKILLS.md                                # only if command list / upgrade guidance belongs there

# Implementation
src/scaffold/ensure-required-gaps.ts                # Create: target-contract gap-fill
src/commands/migrate.ts                             # Create: orchestrator
src/cli.ts                                          # wire `migrate`
src/contract/schema.ts                              # fail-closed schema message (no “migrate the YAML” promise)

# Tests
tests/ensure-required-gaps.test.ts                  # Create
tests/migrate.test.ts                               # Create
tests/cli-commands.test.ts                          # add migrate
tests/cli-stub.test.ts                              # add migrate --help
tests/release-script.test.ts                        # Create
tests/contract.test.ts                              # still matches /schema_version/i

# Package / release
LICENSE                                             # Create: MIT
CHANGELOG.md                                        # Create
package.json                                        # license, files, release script
scripts/release.sh                                  # Create

# Human docs (not living canon)
README.md                                           # EN + RU: npm/npx, migrate vs upgrade-skills, adopter CI, release
docs/guides/usage-flows.md                          # upgrade + adopter CI journeys (EN + RU)
docs/acceptance/skill-scenarios.md                  # migrate + npm install path
```

---

### Task 1: Rewrite P3 via `canon-future-plan`

**Files:**
- Modify (via skill only): `docs/canon/future_plans/p3-production-hardening.md`
- Modify (via skill only, if needed): `docs/canon/future_plans/INDEX.md` Initiatives blurb / status note
- Do not edit living root SoT in this task

**Interfaces:**
- Consumes: `docs/superpowers/specs/2026-08-12-adopter-ready-release-design.md` (P3 rewrite section)
- Produces: P3 initiative whose focus is the adopter-ready checkpoint; Claude dual-write marked shipped; prior three open questions removed/resolved; status `implementing`; no task dump

- [ ] **Step 1: Invoke `canon-future-plan`**

Ask the user to run `/canon-future-plan` (or invoke the skill) with this intent. Do not edit `docs/canon/**` from a coding agent.

Content the skill must land:

1. **Focus:** Adopter-ready first public release (distribution, upgrade/migrate, adopter CI guidance).
2. **In scope:** public npm `0.1.x`; `doc-canon migrate`; soft semver↔`skills_stamp`; adopter CI recipe (`validate` gate, `check` optional, no Open-discrepancies fail); MIT/`CHANGELOG`/pack hygiene; local `npm run release` (no dogfood GHA).
3. **Out of scope:** dogfood GitHub Actions in this repo; failing CI on open discrepancies; prose rewrite in CLI; schema-version rewriter; marketplace plugin; P2; IDE UI; skills editing application code.
4. **Open questions:** delete the three prior items. Record them as decided: cadence/stamp → soft couple; CI vs discrepancies → validate-only recommended gate; migrate vs first publish → migrate ships in this checkpoint with fail-closed unsupported schema.
5. **Claude slice:** already shipped (universal dual-write). Absorb into living OVERVIEW/CLI/SKILLS/README when those already match; remaining P3 is done when publish + migrate + docs land, then absorb the initiative.
6. **Status:** `implementing` (single marker, not a checklist).
7. **Design link:** `docs/superpowers/specs/2026-08-12-adopter-ready-release-design.md`.
8. INDEX note (if present): replace “Claude dual-write overlay slice (other P3 bullets still open)” with this checkpoint.

- [ ] **Step 2: Verify**

Confirm `p3-production-hardening.md` has no task dump, no leftover “publish cadence vs skills_stamp” / “CI fails on discrepancies” / “schema migrate timing” as open questions, and INDEX status is `implementing`.

- [ ] **Step 3: Commit** (only files the skill changed under `docs/canon/future_plans/`)

```bash
git add docs/canon/future_plans/p3-production-hardening.md docs/canon/future_plans/INDEX.md
git commit -m "$(cat <<'EOF'
docs: rewrite P3 as adopter-ready public release checkpoint

EOF
)"
```

---

### Task 2: Living canon via `canon-write`

**Files:**
- Modify (via skill only): `docs/canon/CLI.md`, `docs/canon/OVERVIEW.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/GLOSSARY.md`
- Modify (via skill only) `docs/canon/SKILLS.md` only if it currently lists CLI commands or upgrade steps that would otherwise drift

**Interfaces:**
- Consumes: Task 1 P3 direction; spec Architecture / Versioning / Adopter CI
- Produces: living SoT that names `migrate`, gap-fill rules, soft versioning, and adopter CI guidance — **before** application code

- [ ] **Step 1: Invoke `canon-write`**

Ask the user to run `/canon-write` (or invoke the skill). Do not edit `docs/canon/**` from a coding agent.

Land all of the following (spot-sync siblings in the same write):

**`CLI.md`**
- Add `migrate` to Covers, Current-state command list, and the Interfaces table.
- Table row (exact behavior): `migrate` — require existing canon + parseable `CANON_CONTRACT.md` (else fail closed; that path is `init`); reject `schema_version` other than `1` before writes (no YAML rewrite); create missing **required** section files and listed templates from the **target contract** (never overwrite; never inject default-kit sections); add missing INDEX Sections rows for contract sections; then run `upgrade-skills`. Flags: `--root` only.
- Responsibilities: `migrate` does not rewrite section prose, initiative files, or `DISCREPANCIES.md`; `future_plans` contract-skeleton ensure stays on `upgrade-skills`.
- Keep existing fail-closed `schema_version` / stamp policy.

**`OVERVIEW.md`**
- In scope CLI list: add `migrate`.
- Success: an adopter can install from npm (`npx` / global) and bring an existing canon current with `migrate`.
- Out of scope stays: no dogfood CI in this product repo as everyday sync; adopter CI is documented `validate`, not a required MVP hook.

**`ARCHITECTURE.md`**
- Building blocks CLI commands: add `migrate`.
- New bullet: **Required-gap ensure** (`src/scaffold/ensure-required-gaps.ts`) — creates missing required files/templates and INDEX rows vs the target contract only.
- Key flows: add **Migrate** — precheck schema `1` → gap-fill → `upgrade-skills` (overlays + future_plans skeleton + stamp + validate).

**`GLOSSARY.md`**
- Add **migrate**: CLI command that brings an existing canon up to the installed CLI by filling missing required scaffold from the target contract, then `upgrade-skills`. Not a schema-version rewriter; not `init`.
- Under **skills_stamp**: note soft coupling — managed-asset changes bump npm version and stamp; a CLI-only bugfix may bump npm patch only.

- [ ] **Step 2: Validate**

```bash
npx tsx src/cli.ts validate --root .
```

Expected: `Canon is valid.` (or equivalent) and exit 0.

- [ ] **Step 3: Stop for user go-ahead**

This is a substantial new command. Do **not** start Task 4 until the user explicitly says to implement.

- [ ] **Step 4: Commit** living canon files the skill changed

```bash
git add docs/canon/CLI.md docs/canon/OVERVIEW.md docs/canon/ARCHITECTURE.md docs/canon/GLOSSARY.md docs/canon/SKILLS.md
git commit -m "$(cat <<'EOF'
docs: absorb migrate, versioning, and adopter CI into living canon

EOF
)"
```

---

### Task 3: User go-ahead gate

**Files:** none

**Interfaces:**
- Consumes: Task 2 living canon
- Produces: permission to write application code (Tasks 4+)

- [ ] **Step 1: Ask the user**

After Task 2 commit, ask: living canon now describes `migrate` and the release checkpoint. Implement application code next?

- [ ] **Step 2: Do not proceed** until the user answers yes.

---

### Task 4: `ensureRequiredGaps` (target-contract gap-fill)

**Files:**
- Create: `src/scaffold/ensure-required-gaps.ts`
- Test: `tests/ensure-required-gaps.test.ts`

**Interfaces:**
- Consumes: `Contract` from `src/contract/types.ts`; `sectionPathsFromIndex` from `src/validate/index-agreement.ts`; `canonDir` / `embeddedRoot` from `src/paths.ts`
- Produces:

```ts
export type EnsureRequiredGapsResult = {
  createdTemplates: string[];
  createdSections: string[];
  indexChanged: boolean;
};

export function ensureRequiredGaps(
  root: string,
  contract: Contract,
): EnsureRequiredGapsResult;
```

Paths in `createdTemplates` / `createdSections` are contract-relative (`templates/OVERVIEW.md`, `OVERVIEW.md`). Never mutates contract YAML. Never calls `ensureFuturePlansSkeleton`.

- [ ] **Step 1: Write the failing tests**

Create `tests/ensure-required-gaps.test.ts`:

```ts
import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { initCanon } from "../src/commands/init.js";
import { parseContractMarkdown } from "../src/contract/parse.js";
import { ensureRequiredGaps } from "../src/scaffold/ensure-required-gaps.js";

it("restores a missing required section and template without touching existing prose", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-restore-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const overview = join(canon, "OVERVIEW.md");
    const overviewTemplate = join(canon, "templates", "OVERVIEW.md");
    const planted = `${readFileSync(join(canon, "ARCHITECTURE.md"), "utf8")}\nPlanted architecture.\n`;
    writeFileSync(join(canon, "ARCHITECTURE.md"), planted);
    rmSync(overview);
    rmSync(overviewTemplate);

    const contract = parseContractMarkdown(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    );
    const result = ensureRequiredGaps(root, contract);

    assert.equal(existsSync(overview), true);
    assert.equal(existsSync(overviewTemplate), true);
    assert.equal(result.createdSections.includes("OVERVIEW.md"), true);
    assert.equal(result.createdTemplates.includes("templates/OVERVIEW.md"), true);
    assert.match(readFileSync(overview, "utf8"), /## Purpose/);
    assert.equal(readFileSync(join(canon, "ARCHITECTURE.md"), "utf8"), planted);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not inject a default-kit section omitted from the target contract", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-no-inject-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    let markdown = readFileSync(contractPath, "utf8");
    markdown = markdown.replace(
      /\n  - id: architecture[\s\S]*?template: ARCHITECTURE\n/,
      "\n",
    );
    writeFileSync(contractPath, markdown);
    rmSync(join(canon, "ARCHITECTURE.md"), { force: true });
    writeFileSync(
      join(canon, "INDEX.md"),
      readFileSync(join(canon, "INDEX.md"), "utf8").replace(
        /\| architecture \| ARCHITECTURE\.md \| architecture \| true \|\n/,
        "",
      ),
    );

    const contract = parseContractMarkdown(readFileSync(contractPath, "utf8"));
    ensureRequiredGaps(root, contract);
    assert.equal(existsSync(join(canon, "ARCHITECTURE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("appends missing INDEX Sections rows and is idempotent", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-index-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const indexPath = join(canon, "INDEX.md");
    const extra = `${readFileSync(indexPath, "utf8")}\n<!-- planted-index -->\n`;
    writeFileSync(
      indexPath,
      extra.replace(/\| overview \| OVERVIEW\.md \| overview \| true \|\n/, ""),
    );

    const contract = parseContractMarkdown(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    );
    const first = ensureRequiredGaps(root, contract);
    assert.equal(first.indexChanged, true);
    assert.match(readFileSync(indexPath, "utf8"), /OVERVIEW\.md/);
    assert.match(readFileSync(indexPath, "utf8"), /planted-index/);

    const second = ensureRequiredGaps(root, contract);
    assert.equal(second.createdSections.length, 0);
    assert.equal(second.createdTemplates.length, 0);
    assert.equal(second.indexChanged, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("fails closed when a listed template has no embedded original", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-unknown-tmpl-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const markdown = readFileSync(contractPath, "utf8").replace(
      "  - id: INDEX\n    path: templates/INDEX.md\n",
      "  - id: INDEX\n    path: templates/INDEX.md\n  - id: NOT_A_REAL_TEMPLATE\n    path: templates/NOT_A_REAL_TEMPLATE.md\n",
    );
    writeFileSync(contractPath, markdown);
    const contract = parseContractMarkdown(markdown);
    assert.throws(
      () => ensureRequiredGaps(root, contract),
      /NOT_A_REAL_TEMPLATE/,
    );
    assert.equal(existsSync(join(canon, "templates", "NOT_A_REAL_TEMPLATE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/ensure-required-gaps.test.ts
```

Expected: FAIL (module `ensure-required-gaps.js` not found).

- [ ] **Step 3: Implement `src/scaffold/ensure-required-gaps.ts`**

```ts
import fs from "node:fs";
import path from "node:path";
import type { Contract, SectionDef } from "../contract/types.js";
import { canonDir, embeddedRoot } from "../paths.js";
import { sectionPathsFromIndex } from "../validate/index-agreement.js";

export type EnsureRequiredGapsResult = {
  createdTemplates: string[];
  createdSections: string[];
  indexChanged: boolean;
};

const SECTIONS_HEADING_RE = /^##\s+Sections\s*$(.*?)(?=^##\s|(?![\s\S]))/ims;

function sectionsTableMarkdown(sections: SectionDef[]): string {
  return `| id | path | role | required |
| --- | --- | --- | --- |
${sections
  .map(
    (section) =>
      `| ${section.id} | ${section.path} | ${section.role} | ${section.required} |`,
  )
  .join("\n")}`;
}

function embeddedTemplatePath(templateId: string): string {
  return path.join(embeddedRoot(), "templates", `${templateId}.md`);
}

function restoreMissingTemplates(
  root: string,
  contract: Contract,
): string[] {
  const canonRoot = canonDir(root);
  const created: string[] = [];
  for (const template of contract.templates) {
    const dest = path.join(canonRoot, template.path);
    if (fs.existsSync(dest)) continue;
    const source = embeddedTemplatePath(template.id);
    if (!fs.existsSync(source)) {
      throw new Error(
        `Template ${template.id} is missing at ${template.path} and has no embedded original`,
      );
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
    created.push(template.path);
  }
  return created;
}

function copySectionFromTemplate(
  canonRoot: string,
  section: SectionDef,
  contract: Contract,
): void {
  const template = contract.templates.find((item) => item.id === section.template);
  if (!template) {
    throw new Error(
      `Section ${section.path} references unknown template ${section.template}`,
    );
  }
  const templateFile = path.join(canonRoot, template.path);
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template ${section.template} does not exist at ${template.path}`);
  }
  const dest = path.join(canonRoot, section.path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(templateFile, dest);
}

function fillIndexFromTemplate(
  canonRoot: string,
  contract: Contract,
): void {
  const indexPath = path.join(canonRoot, "INDEX.md");
  let markdown = fs.readFileSync(indexPath, "utf8");
  if (markdown.includes("<!-- sections table -->")) {
    markdown = markdown.replace(
      "<!-- sections table -->",
      sectionsTableMarkdown(contract.sections),
    );
    fs.writeFileSync(indexPath, markdown);
    return;
  }
  appendMissingIndexRows(indexPath, contract);
}

function appendMissingIndexRows(indexPath: string, contract: Contract): boolean {
  if (!fs.existsSync(indexPath)) return false;
  const markdown = fs.readFileSync(indexPath, "utf8");
  const indexed = new Set(sectionPathsFromIndex(markdown));
  const missing = contract.sections.filter((section) => !indexed.has(section.path));
  if (missing.length === 0) return false;

  if (markdown.includes("<!-- sections table -->")) {
    fs.writeFileSync(
      indexPath,
      markdown.replace(
        "<!-- sections table -->",
        sectionsTableMarkdown(contract.sections),
      ),
    );
    return true;
  }

  const sectionsMatch = SECTIONS_HEADING_RE.exec(markdown);
  if (!sectionsMatch) {
    throw new Error("INDEX.md does not contain a Sections table to append to");
  }
  const body = sectionsMatch[1]!;
  const bodyLines = body.split("\n");
  let lastTableRowIndex = -1;
  for (let i = 0; i < bodyLines.length; i += 1) {
    if (bodyLines[i]!.trim().startsWith("|")) lastTableRowIndex = i;
  }
  if (lastTableRowIndex === -1) {
    throw new Error("INDEX.md Sections heading has no table to append to");
  }
  const rows = missing.map(
    (section) =>
      `| ${section.id} | ${section.path} | ${section.role} | ${section.required} |`,
  );
  bodyLines.splice(lastTableRowIndex + 1, 0, ...rows);
  const updatedBody = bodyLines.join("\n");
  const updatedMarkdown =
    markdown.slice(0, sectionsMatch.index) +
    sectionsMatch[0].replace(body, () => updatedBody) +
    markdown.slice(sectionsMatch.index + sectionsMatch[0].length);
  fs.writeFileSync(indexPath, updatedMarkdown);
  return true;
}

export function ensureRequiredGaps(
  root: string,
  contract: Contract,
): EnsureRequiredGapsResult {
  const canonRoot = canonDir(root);
  const createdTemplates = restoreMissingTemplates(root, contract);
  const createdSections: string[] = [];

  const indexSection = contract.sections.find(
    (section) => section.path === "INDEX.md" && section.required,
  );
  const indexPath = path.join(canonRoot, "INDEX.md");
  if (indexSection && !fs.existsSync(indexPath)) {
    copySectionFromTemplate(canonRoot, indexSection, contract);
    fillIndexFromTemplate(canonRoot, contract);
    createdSections.push("INDEX.md");
  }

  for (const section of contract.sections) {
    if (!section.required) continue;
    if (section.path === "CANON_CONTRACT.md" || section.path === "INDEX.md") {
      continue;
    }
    const dest = path.join(canonRoot, section.path);
    if (fs.existsSync(dest)) continue;
    copySectionFromTemplate(canonRoot, section, contract);
    createdSections.push(section.path);
  }

  const indexChanged =
    createdSections.includes("INDEX.md") ||
    appendMissingIndexRows(indexPath, contract);

  return { createdTemplates, createdSections, indexChanged };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/ensure-required-gaps.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scaffold/ensure-required-gaps.ts tests/ensure-required-gaps.test.ts
git commit -m "$(cat <<'EOF'
feat: fill missing required canon files from the target contract

EOF
)"
```

---

### Task 5: `migrate` command + CLI wiring

**Files:**
- Create: `src/commands/migrate.ts`
- Modify: `src/cli.ts` (add `migrate` after `upgrade-skills`, same `--root` + try/catch pattern)
- Modify: `src/contract/schema.ts` (error must not promise a YAML rewrite)
- Modify: `tests/cli-commands.test.ts` (add `"migrate"` to both command arrays)
- Modify: `tests/cli-stub.test.ts` (assert `migrate` `--help` includes `--root <path>`)
- Test: `tests/migrate.test.ts`

**Interfaces:**
- Consumes: `ensureRequiredGaps` from Task 4; `upgradeSkills(root: string): Promise<number>` from `src/commands/upgrade-skills.ts`; `DEFAULT_SCHEMA_VERSION` from `src/version.ts`
- Produces: `export async function migrateCanon(root: string): Promise<number>` — exit code of `upgradeSkills` (its trailing validate). No second validate call.

- [ ] **Step 1: Write the failing tests**

Create `tests/migrate.test.ts`:

```ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { it } from "node:test";
import { fileURLToPath } from "node:url";
import { initCanon } from "../src/commands/init.js";
import { migrateCanon } from "../src/commands/migrate.js";
import { upgradeSkills } from "../src/commands/upgrade-skills.js";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

it("rejects a missing contract before writing files", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-missing-"));
  try {
    await assert.rejects(migrateCanon(root), /CANON_CONTRACT\.md.*does not exist/i);
    assert.equal(existsSync(join(root, ".cursor", "skills")), false);
    assert.equal(existsSync(join(root, "docs", "canon")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects unsupported schema_version before any writes", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-schema-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const contractPath = join(root, "docs", "canon", "CANON_CONTRACT.md");
    const overviewPath = join(root, "docs", "canon", "OVERVIEW.md");
    const beforeContract = readFileSync(contractPath, "utf8");
    writeFileSync(
      contractPath,
      beforeContract.replace("schema_version: 1", "schema_version: 99"),
    );
    rmSync(overviewPath);

    await assert.rejects(migrateCanon(root), /schema_version 99/i);
    assert.equal(existsSync(overviewPath), false);
    assert.equal(
      readFileSync(contractPath, "utf8"),
      beforeContract.replace("schema_version: 1", "schema_version: 99"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("restores missing required files then upgrade-skills, and is content-idempotent on canon docs", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-restore-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const overview = join(canon, "OVERVIEW.md");
    const architecture = join(canon, "ARCHITECTURE.md");
    const planted = `${readFileSync(architecture, "utf8")}\nPlanted.\n`;
    writeFileSync(architecture, planted);
    rmSync(overview);

    assert.equal(await migrateCanon(root), 0);
    assert.equal(existsSync(overview), true);
    assert.equal(readFileSync(architecture, "utf8"), planted);
    assert.equal(
      existsSync(join(root, ".cursor", "skills", "canon-write", "SKILL.md")),
      true,
    );

    const snapshot = {
      overview: readFileSync(overview, "utf8"),
      architecture: readFileSync(architecture, "utf8"),
      index: readFileSync(join(canon, "INDEX.md"), "utf8"),
      contract: readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    };
    assert.equal(await migrateCanon(root), 0);
    assert.equal(readFileSync(overview, "utf8"), snapshot.overview);
    assert.equal(readFileSync(architecture, "utf8"), snapshot.architecture);
    assert.equal(readFileSync(join(canon, "INDEX.md"), "utf8"), snapshot.index);
    assert.equal(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
      snapshot.contract,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not add omitted default-kit sections", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-no-kit-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    writeFileSync(
      contractPath,
      readFileSync(contractPath, "utf8").replace(
        /\n  - id: architecture[\s\S]*?template: ARCHITECTURE\n/,
        "\n",
      ),
    );
    writeFileSync(
      join(canon, "INDEX.md"),
      readFileSync(join(canon, "INDEX.md"), "utf8").replace(
        /\| architecture \| ARCHITECTURE\.md \| architecture \| true \|\n/,
        "",
      ),
    );
    rmSync(join(canon, "ARCHITECTURE.md"), { force: true });

    assert.equal(await migrateCanon(root), 0);
    assert.equal(existsSync(join(canon, "ARCHITECTURE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("still allows upgrade-skills to run alone", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-upgrade-alone-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    assert.equal(await upgradeSkills(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("prints migrate failures without a stack trace", () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-cli-"));
  try {
    const result = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "migrate", "--root", root],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:.*CANON_CONTRACT\.md.*does not exist/i);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
```

In `tests/cli-commands.test.ts`, add `"migrate"` to both arrays (after `"upgrade-skills"`).

In `tests/cli-stub.test.ts`, after the upgrade-skills help assertion, add:

```ts
    const migrate = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "migrate", "--help"],
      { cwd: root, encoding: "utf8" },
    );
    assert.equal(migrate.status, 0);
    assert.match(migrate.stdout, /--root <path>/);
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx tsx --test tests/migrate.test.ts tests/cli-commands.test.ts tests/cli-stub.test.ts
```

Expected: FAIL (`migrate.js` not found and/or help lists missing `migrate`).

- [ ] **Step 3: Implement migrate + CLI + schema message**

`src/commands/migrate.ts`:

```ts
import fs from "node:fs";
import YAML from "yaml";
import { extractYamlBlock, parseContractMarkdown } from "../contract/parse.js";
import { contractPath, resolveRoot } from "../paths.js";
import { ensureRequiredGaps } from "../scaffold/ensure-required-gaps.js";
import { DEFAULT_SCHEMA_VERSION, PACKAGE_VERSION } from "../version.js";
import { upgradeSkills } from "./upgrade-skills.js";

export async function migrateCanon(root: string): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const file = contractPath(resolvedRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`CANON_CONTRACT.md does not exist at ${file}`);
  }
  const markdown = fs.readFileSync(file, "utf8");
  const raw = YAML.parse(extractYamlBlock(markdown)) as {
    schema_version?: unknown;
  };
  if (raw.schema_version !== DEFAULT_SCHEMA_VERSION) {
    const seen =
      raw.schema_version === undefined ? "missing" : String(raw.schema_version);
    throw new Error(
      `Unsupported schema_version ${seen}; this CLI (${PACKAGE_VERSION}) supports schema_version ${DEFAULT_SCHEMA_VERSION} only. See README Upgrade. No files were changed.`,
    );
  }
  const contract = parseContractMarkdown(markdown);
  ensureRequiredGaps(resolvedRoot, contract);
  return upgradeSkills(resolvedRoot);
}
```

In `src/cli.ts`, after the `upgrade-skills` command block, add:

```ts
program
  .command("migrate")
  .description(
    "Bring an existing canon up to this CLI (required gaps, then upgrade-skills)",
  )
  .option("--root <path>", "target repo root", ".")
  .action(async (opts: { root: string }) => {
    try {
      const { migrateCanon } = await import("./commands/migrate.js");
      process.exitCode = await migrateCanon(opts.root);
    } catch (error) {
      console.error(
        `error: ${error instanceof Error ? error.message : String(error)}`,
      );
      process.exitCode = 1;
    }
  });
```

In `src/contract/schema.ts`, change the unsupported-schema error to:

```ts
      `Unsupported schema_version ${seen}; this CLI (${PACKAGE_VERSION}) supports schema_version ${DEFAULT_SCHEMA_VERSION} only. See README Upgrade`,
```

(`tests/contract.test.ts` already matches `/schema_version/i` — keep that.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx tsx --test tests/migrate.test.ts tests/cli-commands.test.ts tests/cli-stub.test.ts tests/contract.test.ts tests/upgrade-skills.test.ts tests/ensure-required-gaps.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/commands/migrate.ts src/cli.ts src/contract/schema.ts tests/migrate.test.ts tests/cli-commands.test.ts tests/cli-stub.test.ts
git commit -m "$(cat <<'EOF'
feat: add doc-canon migrate to fill required gaps then upgrade-skills

EOF
)"
```

---

### Task 6: MIT license, changelog, pack files

**Files:**
- Create: `LICENSE`
- Create: `CHANGELOG.md`
- Modify: `package.json` (`license`, `files` includes `CHANGELOG.md`)

**Interfaces:**
- Consumes: spec license = MIT; package name `doc-canon` version `0.1.0`
- Produces: npm pack listing includes `LICENSE`, `CHANGELOG.md`, `README.md`

- [ ] **Step 1: Write a failing pack assertion**

Create `tests/pack-files.test.ts`:

```ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("npm pack contents", () => {
  it("includes LICENSE, CHANGELOG.md, and README.md", () => {
    assert.equal(existsSync(path.join(root, "LICENSE")), true);
    assert.equal(existsSync(path.join(root, "CHANGELOG.md")), true);
    const result = spawnSync("npm", ["pack", "--dry-run"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const out = `${result.stdout}\n${result.stderr}`;
    assert.match(out, /LICENSE/);
    assert.match(out, /CHANGELOG\.md/);
    assert.match(out, /README\.md/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx --test tests/pack-files.test.ts
```

Expected: FAIL (`LICENSE` missing).

- [ ] **Step 3: Add files**

`LICENSE` (MIT, year 2026):

```text
MIT License

Copyright (c) 2026 doc-canon contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

`CHANGELOG.md`:

```markdown
# Changelog

## 0.1.0

First public release.

- CLI: `init`, `validate`, `check`, `report`, `upgrade-skills`, `index`, `search`, `migrate`
- Dual-write Cursor + Claude Code overlays
- Local BM25 `index` / `search`
- `doc-canon migrate` fills missing required canon files from the target contract, then runs `upgrade-skills`
```

In `package.json`:
- add `"license": "MIT"`
- change `"files"` to `["dist", "embedded", "bin", "CHANGELOG.md"]` (npm already packs `LICENSE` and `README.md`)

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx --test tests/pack-files.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add LICENSE CHANGELOG.md package.json tests/pack-files.test.ts
git commit -m "$(cat <<'EOF'
chore: add MIT license and changelog for npm publish

EOF
)"
```

---

### Task 7: Local `npm run release`

**Files:**
- Create: `scripts/release.sh`
- Modify: `package.json` scripts: `"release": "bash scripts/release.sh"`
- Test: `tests/release-script.test.ts`

**Interfaces:**
- Consumes: Task 6 pack files
- Produces: `npm run release` / `npm run release -- --dry-run` / `DRY_RUN=1 npm run release`. Default path: test → build → validate this repo → `npm pack --dry-run` (require LICENSE, CHANGELOG.md, README.md in the listing) → `npm publish`. Dry-run skips publish. No git tag, no git push, no `.github/workflows`.

- [ ] **Step 1: Write the failing script-source tests**

Create `tests/release-script.test.ts`:

```ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = readFileSync(path.join(root, "scripts", "release.sh"), "utf8");
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts?: { release?: string };
};

describe("release.sh", () => {
  it("is wired as npm run release and never tags or uses GitHub Actions", () => {
    assert.equal(pkg.scripts?.release, "bash scripts/release.sh");
    assert.match(script, /npm test/);
    assert.match(script, /npm run build/);
    assert.match(script, /doc-canon validate|bin\/doc-canon\.js validate/);
    assert.match(script, /npm pack --dry-run/);
    assert.match(script, /LICENSE/);
    assert.match(script, /CHANGELOG\.md/);
    assert.match(script, /README\.md/);
    assert.match(script, /npm publish/);
    assert.match(script, /DRY_RUN|--dry-run/);
    assert.doesNotMatch(script, /git tag/);
    assert.doesNotMatch(script, /git push/);
    assert.doesNotMatch(script, /\.github/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx --test tests/release-script.test.ts
```

Expected: FAIL (script missing).

- [ ] **Step 3: Implement `scripts/release.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

DRY=0
if [[ "${1:-}" == "--dry-run" || "${DRY_RUN:-}" == "1" ]]; then
  DRY=1
fi

npm test
npm run build
node bin/doc-canon.js validate --root "$ROOT"

PACK_OUT="$(npm pack --dry-run 2>&1)"
echo "$PACK_OUT"
for required in LICENSE CHANGELOG.md README.md; do
  echo "$PACK_OUT" | grep -q "$required" || {
    echo "error: npm pack listing missing $required" >&2
    exit 1
  }
done

if [[ "$DRY" -eq 1 ]]; then
  echo "dry-run: skip npm publish"
  exit 0
fi

npm publish
```

`chmod +x scripts/release.sh`

Do **not** pass `--access public` unless publish fails and npm asks for it (unscoped `doc-canon` is public by default).

- [ ] **Step 4: Run tests + a dry-run smoke that skips the full suite if you already ran `npm test` in this task**

```bash
npx tsx --test tests/release-script.test.ts tests/pack-files.test.ts
DRY_RUN=1 bash scripts/release.sh
```

Expected: tests PASS; dry-run prints `dry-run: skip npm publish` and never contacts the registry. The dry-run **does** re-run `npm test` (slow, honest). Do not add a skip-tests flag.

- [ ] **Step 5: Confirm no workflow file was added**

```bash
test ! -e .github/workflows
```

Expected: exit 0 (path absent) or the directory has no files added by this work.

- [ ] **Step 6: Commit**

```bash
git add scripts/release.sh package.json tests/release-script.test.ts
git commit -m "$(cat <<'EOF'
chore: add local npm run release with dry-run and no git push

EOF
)"
```

---

### Task 8: README, usage-flows, acceptance

**Files:**
- Modify: `README.md` (EN + RU)
- Modify: `docs/guides/usage-flows.md` (EN + RU)
- Modify: `docs/acceptance/skill-scenarios.md`

**Interfaces:**
- Consumes: shipped `migrate` + release script
- Produces: adopter-facing install/upgrade/CI copy; no `.github/workflows` in **this** repo

- [ ] **Step 1: Update README EN**

Replace **Install** with:

```markdown
## Install

```bash
npm install -g doc-canon
# or one-shot:
npx doc-canon --help
```

From this repository (development):

```bash
npm install
npm link   # optional: put doc-canon on PATH for local development
```
```

After **upgrade-skills**, add:

```markdown
### migrate

Bring an **existing** canon up to this CLI: create missing required files/templates listed in **that repo’s** `CANON_CONTRACT.md`, add missing INDEX Sections rows, then run `upgrade-skills`. Does not rewrite section prose and does not add default sections the contract omitted. Empty repos should use `init`, not `migrate`.

```bash
doc-canon migrate
doc-canon migrate --root /path/to/repo
```

### When to use upgrade-skills vs migrate

- After `npm install -g doc-canon@…` (or a newer `npx`): run **`migrate`** on each target repo.
- If the contract is already `schema_version: 1` and you only need managed overlays / `skills_stamp`: **`upgrade-skills`** is enough.
- `schema_version` other than `1` fails closed; this CLI does not rewrite contract YAML.

Soft coupling: changes to managed skills/rules bump **both** npm version and `skills_stamp`. A CLI-only bugfix may bump npm patch without a stamp bump. Validate still fails closed on a too-old stamp (`upgrade-skills` / `migrate` to refresh).
```

Add **Adopter CI** (example for *their* repo, not this one):

```markdown
## Adopter CI

Recommended gate is `doc-canon validate` (structure only). `check` is optional. Do **not** fail CI on open `DISCREPANCIES.md` entries.

```yaml
# example for an adopter repository — not used in the doc-canon repo itself
name: canon
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g doc-canon
      - run: doc-canon validate
```
```

Under **Development**, add:

```bash
DRY_RUN=1 npm run release    # test, build, validate, pack-check; no publish
# after a real publish, tag/push git separately if you want a GitHub tag
```

Mirror the same sections in README RU (`Установка`, `migrate`, `upgrade-skills` vs `migrate`, `CI для adopter-репозитория`, `Development`).

- [ ] **Step 2: Update `docs/guides/usage-flows.md`**

Add EN section **Upgrade an existing canon** before **Also see**:

- When: installed CLI is newer than the target repo’s overlays/stamp, or required files listed in the contract are missing.
- CLI vs skill: `doc-canon migrate` (or `upgrade-skills` alone if only assets).
- Steps: install CLI → `doc-canon migrate --root .` → expect `Canon is valid.` / exit 0. Second run must not rewrite planted prose.
- Common mistakes: using `migrate` instead of `init` on a repo with no canon; expecting `migrate` to bump `schema_version`; failing CI on open discrepancies.

Add EN section **Adopter CI**:

- When: the adopter wants a PR gate.
- Use `doc-canon validate`. Optional `check`. Never fail on Open discrepancies.
- Point at the README YAML example.

Mirror both sections in the RU half. In **Also see** / **Также смотрите**, mention `migrate`.

- [ ] **Step 3: Update `docs/acceptance/skill-scenarios.md`**

Append:

```markdown
## Install from npm and migrate

- [ ] Install via `npx doc-canon --help` or `npm install -g doc-canon` (not clone + `npm link` as the only path).
- [ ] On a throwaway repo with `init`, delete a required section file listed in its contract, run `doc-canon migrate`, confirm the file returns from the named template and `validate` exits 0.
- [ ] Confirm planted prose in another section is unchanged.
- [ ] Confirm a second `migrate` does not rewrite that prose.
- [ ] Confirm a contract that omits a default-kit section does not get that file created.
- [ ] Confirm `schema_version: 99` exits non-zero and does not restore deleted files.
```

- [ ] **Step 4: Grep that this repo did not gain workflows**

```bash
git ls-files .github/workflows
```

Expected: empty.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/guides/usage-flows.md docs/acceptance/skill-scenarios.md
git commit -m "$(cat <<'EOF'
docs: document npm install, migrate, and adopter validate CI

EOF
)"
```

---

### Task 9: Full verify

**Files:** none new

**Interfaces:**
- Consumes: Tasks 4–8
- Produces: evidence that `npm test` and `npm run build` pass

- [ ] **Step 1: Run the full suite**

```bash
npm test
npm run build
node bin/doc-canon.js --help
node bin/doc-canon.js migrate --help
node bin/doc-canon.js validate --root .
```

Expected: all tests pass; build succeeds; `--help` lists `migrate`; `migrate --help` shows `--root`; validate exit 0.

- [ ] **Step 2: Dry-run release** (optional if Task 7 already ran it this session)

```bash
DRY_RUN=1 npm run release
```

Expected: ends with `dry-run: skip npm publish`.

- [ ] **Step 3: Commit only if Step 1 forced extra fixes**

If no extra diffs: skip. If fixes: commit them with a message that names the fix.

---

### Task 10: Maintainer publish (manual)

**Files:** none required (git tag is outside the script)

**Interfaces:**
- Consumes: green Task 9
- Produces: `doc-canon@0.1.0` (or current `0.1.x`) on npm. **Do not run `npm publish` from an unattended agent** unless the user explicitly asks and npm auth is already configured.

- [ ] **Step 1: Ask the user** to run from a machine with npm login:

```bash
npm run release
```

- [ ] **Step 2: After a successful publish**, document (do not automate) git tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

Only if the user wants a GitHub tag. Not part of `scripts/release.sh`.

- [ ] **Step 3: Invoke `canon-future-plan` / `canon-write` to absorb**

After publish + docs are true: mark P3 `absorbed` (or leave `implementing` until the user confirms npm install works via `npx doc-canon`). Claude overlay absorb is “when living OVERVIEW/CLI/SKILLS/README already match” — if Task 2 already described dual-write, only the P3 initiative status remains. Do not edit `docs/canon/**` from the coding agent.

---

## Spec coverage

| Spec item | Task |
| --- | --- |
| Rewrite P3 via `canon-future-plan` | 1 |
| Living canon migrate / versioning / CI | 2 |
| Substantial wait-gate | 3 |
| Target-contract gap-fill, no default kit, INDEX rows, unknown template fail-closed | 4 |
| `migrate` sequence, schema fail-closed, `--root`, CLI help, upgrade-skills still works | 5 |
| MIT LICENSE, CHANGELOG, pack contents | 6 |
| `npm run release`, dry-run, no tag/push, no GHA | 7 |
| README EN/RU, usage-flows, acceptance, adopter CI YAML | 8 |
| Full test/build | 9 |
| Real npm publish + optional git tag + absorb P3 | 10 (manual / skills) |
| No prose rewrite / no discrepancy CI fail / no schema rewriter | 4–5 tests + 8 copy |

## Execution notes

- Task 3 is a hard stop. Implementing `migrate` before living canon + user go-ahead violates repo canon-first rules.
- Task 10 publish needs human npm credentials; treat it as a checklist, not an agent surprise publish.
