# doc-first-canon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an npm-distributed `doc-canon` CLI plus Cursor skills that scaffold, validate, inventory, and maintain a `docs/canon/` source of truth with human-in-the-loop conflict resolution.

**Architecture:** Deterministic TypeScript CLI (no LLM) owns schema, structure validation, language-agnostic inventory, and report merge for `source: cli` findings. Cursor skills (`canon-bootstrap`, `canon-audit`, `canon-write`, `canon-contract`) own interview, semantic audit, prose authorship, and discrepancy dialogue; they must invoke the CLI and never patch application code. `init` / `upgrade-skills` copy managed skills, pointer rule, and `AGENTS.md` block into the target repo.

**Tech Stack:** Node.js ≥20, TypeScript 5.x, npm package `doc-canon`, `commander` CLI, `yaml` for machine-block parse, Node built-in test runner (`node:test`) + `tsx`, Vitest optional only if needed — prefer `node:test`. Package type: ESM.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-07-doc-first-canon-design.md` — product requirements override this plan if they conflict; escalate rather than silently diverge.
- CLI never invents prose; skills never invent required files/section types/templates outside the local contract.
- Never edit application code from canon skills; code work goes to `DISCREPANCIES.md` with `coding_agent_prompt`.
- `validate` fails closed on unknown/incompatible major `schema_version` and on too-old `skills_stamp`.
- Extra template headings allowed; missing required headings fail validate.
- `check` must preserve findings with `source: skill`; skills own marking unconfirmed skill findings `stale`.
- `doc-canon check` never edits `DISCREPANCIES.md` or other canon prose.
- Discrepancy apply order: successful apply (canon edit + validate, or task write) → set `decision` → then move Open→Resolved when appropriate (docs_stale: same session after validate; code_stale: stay Open until later audit no longer reproduces).
- Single root `docs/canon/` only; monorepo multi-canon out of MVP.
- Target artifacts may gitignore `.doc-canon/report.json` and `.doc-canon/inventory.json`.

---

## File Structure

```text
package.json
tsconfig.json
.gitignore
README.md
bin/doc-canon.js                 # shebang entry → dist/cli.js
src/
  cli.ts                         # commander wiring
  version.ts                     # PACKAGE_VERSION, SKILLS_STAMP, DEFAULT_SCHEMA_VERSION
  paths.ts                       # resolve target root, .doc-canon/, docs/canon/
  contract/
    types.ts                     # Contract, SectionDef, TemplateDef, Policies
    parse.ts                     # extract + parse YAML fence from CANON_CONTRACT.md
    schema.ts                    # structural field validation (no external JSON Schema lib required)
  validate/
    validate.ts                  # orchestrate validate
    headings.ts                  # required H2/H3 presence from template
    links.ts                     # basic in-canon relative link checks
    index-agreement.ts           # INDEX ↔ contract paths
  inventory/
    build.ts                     # walk tree → Inventory
    types.ts
  report/
    types.ts                     # Finding, Report
    merge.ts                     # merge cli findings; preserve skill
    io.ts                        # read/write .doc-canon/report.json
  commands/
    init.ts
    upgrade-skills.ts
    validate.ts
    check.ts
    report.ts
  scaffold/
    default-contract.ts          # default CANON_CONTRACT.md body + YAML
    copy-managed.ts              # copy skills/rules/AGENTS block
  agnostic/
    ignore.ts                    # default excludes + policies.ignore
embedded/                        # files copied verbatim on init (also published in package)
  templates/
    INDEX.md
    OVERVIEW.md
    ARCHITECTURE.md
    GLOSSARY.md
    DISCREPANCIES.md
    CANON_CONTRACT.md            # human sections; machine YAML filled by scaffold
    SECTION.md
    ENTITY.md
    MODULE.md
    DOMAIN_TOPIC.md
  skills/
    canon-bootstrap/SKILL.md
    canon-audit/SKILL.md
    canon-write/SKILL.md
    canon-contract/SKILL.md
  rules/
    doc-canon.mdc
  agents/
    AGENTS.block.md              # managed block body only
tests/
  fixtures/
    happy-empty/                 # minimal target before init (empty or README only)
    broken-yaml/
    missing-section/
    missing-headings/
    index-mismatch/
    ignore-globs/
  contract.test.ts
  validate.test.ts
  inventory.test.ts
  report-merge.test.ts
  init.test.ts
  check.test.ts
  upgrade-skills.test.ts
docs/
  acceptance/
    skill-scenarios.md           # bootstrap/audit/write/contract acceptance scenarios
```

---

### Task 1: Package scaffold and CLI stub

**Files:**
- Create: `package.json`, `tsconfig.json`, `bin/doc-canon.js`, `src/cli.ts`, `src/version.ts`, `src/paths.ts`
- Modify: `.gitignore`, `README.md`
- Test: `tests/cli-stub.test.ts`

**Interfaces:**
- Produces: `PACKAGE_VERSION` string; CLI binary `doc-canon` with `--help`; `resolveRoot(cwd: string, flag?: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// tests/cli-stub.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

describe("doc-canon cli stub", () => {
  it("prints help and exits 0", () => {
    const r = spawnSync("npx", ["tsx", "src/cli.ts", "--help"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Usage:/);
    assert.match(r.stdout, /validate/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/cli-stub.test.ts`  
Expected: FAIL (missing `src/cli.ts` or no Usage)

- [ ] **Step 3: Write minimal implementation**

`package.json`:
```json
{
  "name": "doc-canon",
  "version": "0.1.0",
  "description": "Deterministic canon CLI for agent documentation",
  "type": "module",
  "bin": { "doc-canon": "./bin/doc-canon.js" },
  "files": ["dist", "embedded", "bin"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "tsx --test tests/**/*.test.ts",
    "prepare": "npm run build"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "commander": "^13.1.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "declaration": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

`src/version.ts`:
```ts
export const PACKAGE_VERSION = "0.1.0";
export const DEFAULT_SCHEMA_VERSION = 1;
/** Bump when managed skills/rules content changes incompatibly for validate. */
export const SKILLS_STAMP = "0.1.0";
/** Minimum skills_stamp this CLI accepts. */
export const MIN_SKILLS_STAMP = "0.1.0";
```

`src/paths.ts`:
```ts
import fs from "node:fs";
import path from "node:path";

export function resolveRoot(cwd: string, rootFlag?: string): string {
  const root = path.resolve(cwd, rootFlag ?? ".");
  if (!fs.existsSync(root)) throw new Error(`Root not found: ${root}`);
  return root;
}

export function canonDir(root: string): string {
  return path.join(root, "docs", "canon");
}

export function contractPath(root: string): string {
  return path.join(canonDir(root), "CANON_CONTRACT.md");
}

export function docCanonDir(root: string): string {
  return path.join(root, ".doc-canon");
}
```

`src/cli.ts`:
```ts
#!/usr/bin/env node
import { Command } from "commander";
import { PACKAGE_VERSION } from "./version.js";

const program = new Command();
program
  .name("doc-canon")
  .description("Deterministic canon CLI for agent documentation")
  .version(PACKAGE_VERSION);

program.command("init").description("Scaffold canon + managed agent assets");
program.command("upgrade-skills").description("Refresh managed skills/rules/AGENTS block");
program.command("validate").description("Schema + structure validation");
program.command("check").description("Validate + inventory + structural report");
program.command("report").description("Print last report.json");

program.parse();
```

`bin/doc-canon.js`:
```js
#!/usr/bin/env node
import "../dist/cli.js";
```

Update `.gitignore`:
```
node_modules/
dist/
.doc-canon/
*.log
```

Update `README.md` with one-paragraph product blurb + `npm install` / `doc-canon --help` (keep short).

- [ ] **Step 4: Run tests**

Run: `npm install && npm test`  
Expected: `cli-stub` PASS

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json bin/doc-canon.js src/cli.ts src/version.ts src/paths.ts tests/cli-stub.test.ts .gitignore README.md package-lock.json
git commit -m "chore: scaffold doc-canon TypeScript CLI package"
```

---

### Task 2: Contract types, YAML extract, schema validation

**Files:**
- Create: `src/contract/types.ts`, `src/contract/parse.ts`, `src/contract/schema.ts`
- Test: `tests/contract.test.ts`, `tests/fixtures/broken-yaml/docs/canon/CANON_CONTRACT.md`

**Interfaces:**
- Produces:
  - `extractYamlBlock(markdown: string): string` — exactly one ` ```yaml ` … ` ``` ` fence; else throw
  - `parseContractMarkdown(markdown: string): Contract`
  - `assertContractSchema(raw: unknown): Contract` — fail closed
  - Types:

```ts
export type SectionRole =
  | "index"
  | "overview"
  | "architecture"
  | "glossary"
  | "discrepancies"
  | "contract"
  | "section";

export interface SectionDef {
  id: string;
  path: string; // relative to docs/canon/
  role: SectionRole;
  required: boolean;
  template: string; // template id
}

export interface TemplateDef {
  id: string;
  path: string; // relative to docs/canon/
}

export interface Policies {
  max_lines: number;
  ignore: string[];
}

export interface Contract {
  schema_version: number;
  cli_compat: string; // semver range or min version string, e.g. ">=0.1.0"
  skills_stamp: string;
  sections: SectionDef[];
  templates: TemplateDef[];
  policies: Policies;
}
```

- [ ] **Step 1: Write the failing test**

```ts
// tests/contract.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseContractMarkdown } from "../src/contract/parse.js";

const good = `# Canon Contract
## Machine contract
\`\`\`yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - id: index
    path: INDEX.md
    role: index
    required: true
    template: INDEX
templates:
  - id: INDEX
    path: templates/INDEX.md
policies:
  max_lines: 400
  ignore: []
\`\`\`
`;

describe("parseContractMarkdown", () => {
  it("parses valid machine block", () => {
    const c = parseContractMarkdown(good);
    assert.equal(c.schema_version, 1);
    assert.equal(c.sections[0].path, "INDEX.md");
    assert.equal(c.policies.max_lines, 400);
  });

  it("fails on missing yaml fence", () => {
    assert.throws(() => parseContractMarkdown("# no yaml"), /machine block/i);
  });

  it("fails on incompatible schema_version", () => {
    const bad = good.replace("schema_version: 1", "schema_version: 99");
    assert.throws(() => parseContractMarkdown(bad), /schema_version/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/contract.test.ts`  
Expected: FAIL module not found

- [ ] **Step 3: Implement parse + schema**

`src/contract/parse.ts`: extract single yaml fence with regex `/```yaml\n([\s\S]*?)```/`; if zero or >1 fences with language yaml, throw. Parse with `YAML.parse`. Pass to `assertContractSchema`.

`src/contract/schema.ts`:
- Require `schema_version === DEFAULT_SCHEMA_VERSION` (1); if missing/other major → throw with upgrade guidance mentioning `PACKAGE_VERSION`.
- Require string `cli_compat`, `skills_stamp`.
- Require non-empty `sections` / `templates` arrays with required fields.
- `policies.max_lines` number default 400 if absent; `ignore` default `[]`.
- Unknown top-level keys: warn to stderr, ignore (soft forward-compat). Do not fail.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test`

- [ ] **Step 5: Commit**

```bash
git add src/contract tests/contract.test.ts
git commit -m "feat: parse and schema-validate CANON_CONTRACT YAML block"
```

---

### Task 3: Heading extraction and required-heading checks

**Files:**
- Create: `src/validate/headings.ts`
- Test: `tests/headings.test.ts`

**Interfaces:**
- Produces:
  - `extractMarkdownHeadings(md: string): { level: number; text: string }[]`
  - `requiredHeadingsFromTemplate(templateMd: string): string[]` — ordered list of required heading texts for levels marked required. **MVP rule:** every H1/H2 in the template is required; H3s under `## Scope` that appear in the template are required when present in template (OVERVIEW In/Out of scope). Simpler concrete rule for MVP: **all H1 and H2 lines in the template file are required; additionally any H3 that appears in the template is required.**
  - `assertRequiredHeadings(docMd: string, required: string[]): string[]` — returns list of missing heading texts (empty = ok). Match by exact trimmed heading text (strip `#` markers). Extra headings in doc are OK.

- [ ] **Step 1: Failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  requiredHeadingsFromTemplate,
  assertRequiredHeadings,
} from "../src/validate/headings.js";

describe("headings", () => {
  it("detects missing required H2", () => {
    const template = `# Overview\n## Purpose\n## Scope\n`;
    const doc = `# Overview\n## Purpose\n`;
    const req = requiredHeadingsFromTemplate(template);
    const missing = assertRequiredHeadings(doc, req);
    assert.deepEqual(missing, ["Scope"]);
  });

  it("allows extra headings", () => {
    const template = `# Overview\n## Purpose\n`;
    const doc = `# Overview\n## Purpose\n## Extra\n`;
    const missing = assertRequiredHeadings(doc, requiredHeadingsFromTemplate(template));
    assert.deepEqual(missing, []);
  });
});
```

- [ ] **Step 2–4: Implement, run tests, commit**

```bash
git commit -m "feat: required template heading checks (extras allowed)"
```

---

### Task 4: `validate` command (structure)

**Files:**
- Create: `src/validate/validate.ts`, `src/validate/index-agreement.ts`, `src/validate/links.ts`, `src/commands/validate.ts`
- Modify: `src/cli.ts` — wire `validate` with `--root <path>`
- Test: `tests/validate.test.ts` + fixtures `tests/fixtures/happy-canon/`, `missing-section/`, `missing-headings/`, `index-mismatch/`

**Interfaces:**
- Produces: `validateCanon(root: string): ValidateResult` where

```ts
export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}
```

Validation rules (errors unless noted):
1. `CANON_CONTRACT.md` exists; YAML parse/schema OK.
2. `schema_version` compatible (already in schema).
3. Compare `skills_stamp` to `MIN_SKILLS_STAMP` with semver-ish string compare (MVP: lexicographic equality allowed if equal; if contract stamp < min → error “upgrade skills via doc-canon upgrade-skills”). Implement tiny `cmpStamp(a,b)` splitting on `.` as numbers.
4. Every `sections[].path` where `required: true` exists under `docs/canon/`.
5. Every section `template` id exists in `templates[]`; template file exists.
6. INDEX.md Sections table paths agree with contract section paths (parse markdown table rows; every required contract path appears; every table path exists in contract).
7. For each section, load template file, `assertRequiredHeadings` on section file → error listing missing.
8. Orphan files: any `docs/canon/**/*.md` except under `templates/` not listed in contract sections → error (structure).
9. Basic links: markdown links `[text](rel)` pointing to `.md` under canon — if target missing → error.
10. Line count > `policies.max_lines` → **warning** only.

Exit code: `ok ? 0 : 1`. Print errors/warnings to stderr/stdout clearly.

- [ ] **Step 1: Build fixture `tests/fixtures/happy-canon/`** with full mandatory files matching default templates headings (stub content OK) and valid contract YAML (`skills_stamp: "0.1.0"`).

- [ ] **Step 2: Failing tests** for happy validate ok; missing section fails; missing heading fails; index mismatch fails.

- [ ] **Step 3: Implement `validateCanon` + CLI command**

```ts
// cli wiring sketch
program
  .command("validate")
  .option("--root <path>", "target repo root", ".")
  .action(async (opts) => {
    const { validateCanon } = await import("./commands/validate.js");
    const code = await validateCanon(opts.root);
    process.exit(code);
  });
```

- [ ] **Step 4: Run `npm test` — PASS**

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: doc-canon validate for contract, headings, index, links"
```

---

### Task 5: Inventory builder

**Files:**
- Create: `src/inventory/types.ts`, `src/inventory/build.ts`, `src/agnostic/ignore.ts`
- Test: `tests/inventory.test.ts`, `tests/fixtures/ignore-globs/`

**Interfaces:**
- Produces:

```ts
export interface InventoryEntry {
  path: string; // repo-relative posix
  kind: "file" | "dir";
  basename: string;
  tokens: string[]; // basename split on /[^a-zA-Z0-9]+/ lowercased filtered empty
}

export interface Inventory {
  generated_at: string; // ISO
  root: string;
  entries: InventoryEntry[];
  text_hits?: { term: string; paths: string[] }[];
}

export function buildInventory(
  root: string,
  ignoreGlobs: string[],
  glossaryTerms?: string[],
): Inventory;
```

Default excludes always applied: `.git`, `node_modules`, `dist`, `build`, `.doc-canon`, plus `policies.ignore` globs. Matching: simple glob `**`/`*` via `micromatch` **or** hand-rolled prefix/suffix matcher — add dependency `micromatch` + `@types/micromatch` if used.

Optional `glossaryTerms`: for each term, grep files as utf8 text (skip binaries by extension denylist: images, wasm, etc.); record paths with case-insensitive substring hit.

Write helper `writeInventory(root, inventory)` → `.doc-canon/inventory.json`.

- [ ] **Step 1: Failing test** — fixture with `src/foo.ts`, `node_modules/skip.js`, custom ignore `tmp/**`; assert inventory includes `src/foo.ts`, excludes node_modules and tmp.

- [ ] **Step 2–4: Implement, test, commit**

```bash
git commit -m "feat: language-agnostic inventory with ignore globs"
```

---

### Task 6: Report types and merge

**Files:**
- Create: `src/report/types.ts`, `src/report/merge.ts`, `src/report/io.ts`
- Test: `tests/report-merge.test.ts`

**Interfaces:**
- Produces:

```ts
export type FindingKind = "structure" | "consistency" | "drift" | "conflict";
export type FindingStatus = "open" | "stale";
export type FindingSource = "cli" | "skill";

export interface Finding {
  id: string; // e.g. "F-001"
  kind: FindingKind;
  paths: string[];
  summary: string;
  status: FindingStatus;
  source: FindingSource;
  discrepancy_id?: string;
}

export interface Report {
  schema_version: 1;
  generated_at: string;
  findings: Finding[];
}

export function mergeCliFindings(existing: Report | null, cliFindings: Finding[]): Report;
export function nextFindingId(findings: Finding[]): string; // max F-NNN + 1
```

`mergeCliFindings`: drop previous findings where `source === "cli"`; keep all `source === "skill"`; append/replace new cli set; set `generated_at` now. Never wipe skill findings.

- [ ] **Step 1: Failing test**

```ts
it("preserves skill findings when merging cli", () => {
  const existing = {
    schema_version: 1 as const,
    generated_at: "old",
    findings: [
      { id: "F-001", kind: "drift", paths: ["a"], summary: "s", status: "open", source: "skill" as const },
      { id: "F-002", kind: "structure", paths: ["b"], summary: "s", status: "open", source: "cli" as const },
    ],
  };
  const merged = mergeCliFindings(existing, [
    { id: "F-003", kind: "structure", paths: ["c"], summary: "n", status: "open", source: "cli" },
  ]);
  assert.equal(merged.findings.some((f) => f.id === "F-001" && f.source === "skill"), true);
  assert.equal(merged.findings.some((f) => f.id === "F-002"), false);
  assert.equal(merged.findings.some((f) => f.source === "cli" && f.paths[0] === "c"), true);
});
```

- [ ] **Step 2–4: Implement, test, commit**

```bash
git commit -m "feat: report.json merge preserving skill findings"
```

---

### Task 7: `check` and `report` commands

**Files:**
- Create: `src/commands/check.ts`, `src/commands/report.ts`
- Modify: `src/cli.ts`, `src/validate/validate.ts` (export helpers to emit structural findings)
- Test: `tests/check.test.ts`

**Interfaces:**
- `checkCanon(root: string): Promise<number>` — run validate; always refresh inventory to `.doc-canon/inventory.json`; map validate errors to `Finding` (`kind: structure` or `consistency` for link failures); `mergeCliFindings`; write `.doc-canon/report.json`; exit 1 if validate failed.
- `printReport(root: string): number` — read report, print JSON to stdout; exit 1 if missing.

Structural findings only from CLI — do not invent drift/conflict in CLI.

- [ ] **Step 1: Test** — on happy-canon, `check` writes inventory + report with only cli findings; seed a skill finding into report, run check again, assert skill finding still present.

- [ ] **Step 2–4: Implement, test, commit**

```bash
git commit -m "feat: doc-canon check and report commands"
```

---

### Task 8: Embedded default templates + default contract

**Files:**
- Create: all files under `embedded/templates/*.md` per spec heading lists (guidance HTML comments allowed)
- Create: `src/scaffold/default-contract.ts` generating `CANON_CONTRACT.md` with YAML listing mandatory sections + templates (`INDEX`, `OVERVIEW`, `ARCHITECTURE`, `GLOSSARY`, `DISCREPANCIES`, `CANON_CONTRACT`, plus kind templates `SECTION`, `ENTITY`, `MODULE`, `DOMAIN_TOPIC`)
- Test: `tests/templates-fixture.test.ts` — for each embedded template, `requiredHeadingsFromTemplate` non-empty; default contract parses; `validateCanon` on a temp dir after writing scaffold files passes.

**Default YAML section paths (exact):**
- `INDEX.md`, `OVERVIEW.md`, `ARCHITECTURE.md`, `GLOSSARY.md`, `DISCREPANCIES.md`, `CANON_CONTRACT.md`
- roles: `index`, `overview`, `architecture`, `glossary`, `discrepancies`, `contract`
- templates paths: `templates/<ID>.md`

Mandatory template bodies must include exactly the H1/H2/(H3) titles from the spec (e.g. OVERVIEW has `### In scope`, `### Out of scope`).

- [ ] **Step 1–4: Author templates, wire loader `embeddedRoot()` via `import.meta.url` resolving to `embedded/` in repo and `../embedded` from `dist/`, test validate on scaffolded temp dir, commit**

```bash
git commit -m "feat: embed default canon templates and contract"
```

---

### Task 9: Managed skills, pointer rule, AGENTS block sources

**Files:**
- Create: `embedded/skills/canon-bootstrap/SKILL.md`
- Create: `embedded/skills/canon-audit/SKILL.md`
- Create: `embedded/skills/canon-write/SKILL.md`
- Create: `embedded/skills/canon-contract/SKILL.md`
- Create: `embedded/rules/doc-canon.mdc`
- Create: `embedded/agents/AGENTS.block.md`
- Create: `docs/acceptance/skill-scenarios.md`
- Test: `tests/embedded-assets.test.ts` — assert files exist and contain required phrases

**Skill content requirements (must appear verbatim-enough in each SKILL.md):**

Shared preamble for all four:
- Always run `doc-canon validate` before claiming success on canon edits; if CLI missing on PATH, stop with install hint (`npm install -g doc-canon` or local npx).
- Never modify application code; only `docs/canon/**`, and managed paths when using upgrade flows via CLI.
- SoT is `docs/canon/`; start from `INDEX.md`.

`canon-bootstrap`: empty vs non-empty interview; extract-then-freeze; import sources not SoT after validate; call `doc-canon init` if scaffold missing.

`canon-audit`: validate first; refresh via `doc-canon check`; semantic checks per spec (coverage, orphans already CLI, glossary, architecture claims, links, doc↔doc); merge findings into report with `source: skill` (read-modify-write preserving `source: cli`); resolve dialogue; discrepancy lifecycle with apply→decision→Resolved order; structure/consistency not filed into DISCREPANCIES; mark unconfirmed prior skill findings `stale`.

`canon-write`: author/refactor from templates; everyday sync; validate after edits.

`canon-contract`: show intended diff; require explicit user confirmation; edit contract/templates; validate; never change other repos’ defaults.

`doc-canon.mdc` frontmatter `alwaysApply: true` (or current Cursor convention at implement time) + rule substance from spec Pointer section.

`AGENTS.block.md`:
```markdown
<!-- doc-canon:start -->
## doc-canon
For design and development, treat `docs/canon/` as the context source of truth. Start at `docs/canon/INDEX.md`. On docs↔code divergence, do not silently pick a side; use canon skills / `DISCREPANCIES.md`.
<!-- doc-canon:end -->
```

`docs/acceptance/skill-scenarios.md` — checklist scenarios from spec Testing section (bootstrap empty/non-empty, resolve docs vs code, Resolved on later audit, new template kind, pointer/AGENTS after init, check preserves skill findings).

- [ ] **Step 1: Failing test** for file existence + key phrases (`doc-canon validate`, `source: skill`, `<!-- doc-canon:start -->`, etc.)

- [ ] **Step 2–4: Write assets, pass tests, commit**

```bash
git commit -m "feat: embed Cursor skills, pointer rule, and AGENTS block"
```

---

### Task 10: `init` and `upgrade-skills`

**Files:**
- Create: `src/scaffold/copy-managed.ts`, `src/commands/init.ts`, `src/commands/upgrade-skills.ts`
- Modify: `src/cli.ts`
- Test: `tests/init.test.ts`, `tests/upgrade-skills.test.ts`

**Interfaces:**
- `initCanon(root: string, opts: { forceSkills?: boolean; yes?: boolean }): Promise<number>`
  - Create `docs/canon/` mandatory files from embedded templates (fill INDEX table from contract).
  - Write `CANON_CONTRACT.md` via `default-contract.ts` with `skills_stamp: SKILLS_STAMP`.
  - Copy skills to `.cursor/skills/<name>/SKILL.md`.
  - Copy rule to `.cursor/rules/doc-canon.mdc`.
  - Upsert `AGENTS.md` managed block: if file missing, create with block (if root non-empty and `!yes`, skip creating AGENTS only when unsafe — MVP: create minimal AGENTS.md with block; if AGENTS exists, replace only between markers or append markers once).
  - If canon already exists: do **not** overwrite canon document content; print message; update skills only if `forceSkills`.
  - Add `.doc-canon/` to target `.gitignore` if not present (append lines for `report.json` / `inventory.json` or whole dir).
  - End with running validate; non-zero if validate fails.

- `upgradeSkills(root: string): Promise<number>`
  - Refresh managed skills/rules/AGENTS block from embedded package files.
  - Do not wipe canon docs.
  - Update `skills_stamp` in contract YAML to `SKILLS_STAMP` (rewrite machine block only).
  - Validate after.

- [ ] **Step 1: Test init on empty temp dir** — expect canon files, skills, rule, AGENTS block, validate exit 0.

- [ ] **Step 2: Test init again** — canon prose unchanged when user-modified OVERVIEW; skills unchanged without force; with `--force-skills` skills refresh.

- [ ] **Step 3: Test upgrade-skills** does not delete OVERVIEW content; updates skill file body from stamp.

- [ ] **Step 4: Implement + commit**

```bash
git commit -m "feat: doc-canon init and upgrade-skills"
```

---

### Task 11: Wiring polish, README, package publishability

**Files:**
- Modify: `README.md`, `package.json` (`files`, `bin`), `src/cli.ts` (ensure all commands wired with `--root`)
- Test: `tests/cli-commands.test.ts` — `--help` lists `init|upgrade-skills|validate|check|report`

- [ ] **Step 1: README** — install, init, validate, check, upgrade-skills, pointer to spec + acceptance scenarios; note Claude Code later; note skills need `doc-canon` on PATH.

- [ ] **Step 2: `npm run build && npm test`** full green; `node bin/doc-canon.js --help` works after build.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: README usage for doc-canon MVP"
```

---

### Task 12: Spec coverage gate (manual verification checklist)

**Files:**
- Modify: none required; optionally append checklist results under `docs/acceptance/mvp-gate.md`

- [ ] **Step 1: Run through success criteria from spec** against a throwaway temp repo:
  1. Bootstrap via `doc-canon init` → valid canon + skills + pointer/AGENTS
  2. Confirm templates enforce required headings (break one heading → validate fails; add extra → warn/ok)
  3. `check` inventory + structural report; seed skill finding → preserved
  4. Confirm skill markdown documents discrepancy apply→decision→Resolved order
  5. Confirm per-repo contract isolation (second temp dir has own contract)

- [ ] **Step 2: Fix any gaps found; commit fixes**

```bash
git commit -m "test: close MVP acceptance gaps from spec gate"
```

---

## Self-Review (plan author)

**Spec coverage:**
| Spec area | Task |
|-----------|------|
| Contract YAML + fail closed schema | 2, 4 |
| Templates level B + required headings | 3, 8 |
| validate / check / report / inventory | 4–7 |
| init + upgrade-skills + managed assets | 9–10 |
| Skills + pointer + AGENTS | 9 |
| Truth model / discrepancy lifecycle in skills | 9 + acceptance doc |
| Report merge preserve skill | 6–7 |
| Testing fixtures | 4–7, 10, 12 |
| Non-goals respected (no AST, no CI hooks, no app-code edits) | Global + skills |

**Open choices locked in this plan:** npm + TypeScript ESM; schema fields as in Task 2; `max_lines` default 400; Cursor paths `.cursor/skills/`, `.cursor/rules/doc-canon.mdc`; `SKILLS_STAMP` string in version.ts.

**Placeholder scan:** none intentional; micromatch noted as allowed dependency in Task 5.

**Type consistency:** `Contract`, `Finding`, `Report`, `Inventory`, `ValidateResult` names reused across tasks as defined above.
