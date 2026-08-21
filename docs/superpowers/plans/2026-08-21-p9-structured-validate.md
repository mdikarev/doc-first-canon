# P9 Structured Validate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validators return structured issues `{message, kind, paths, severity}`; `doc-canon validate --json` emits a stable machine shape; `check` maps issues to findings directly; managed skills gate success on `validate --json`.

**Architecture:** A shared `ValidationIssue` model in a new `src/validate/types.ts` replaces the `{ok, errors, warnings}` string arrays. Validators attach kind/paths at the point of detection; the command layer formats human output (byte-identical) and `--json`; `check` maps error-severity issues to report findings, deleting the message-regex classification. Canon-first: living canon + embedded skills + `skills_stamp` land before application code, with a user go-ahead gate.

**Tech Stack:** TypeScript (strict, ESM with `.js` import suffixes), Node ≥22.16, node:test, commander CLI. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-21-p9-structured-validate-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Message text of validation issues is **byte-identical** to today's strings (report finding ids stay stable: `stableFindingId` = `sha256(kind \0 paths \0 summary)`).
- Human `validate` output stays byte-identical: `warning: <msg>` / `error: <msg>` on stderr, `Canon is valid.` on stdout when ok; exit 0/1 unchanged.
- Validators emit `kind` ∈ {`structure`, `consistency`} only (never `drift`/`conflict`/`discipline`); `severity` ∈ {`error`, `warning`}; only `error`-severity issues become report findings (today's behavior: warnings never become findings).
- `--json` prints to stdout only: `{schema_version: 1, ok, issues: [...]}`.
- Canon-first order: Task 1 (living canon + embedded skills + stamp) runs before application code; **stop for explicit user go-ahead** after Task 1.
- `skills_stamp` 0.15.0 → 0.16.0; soft coupling means the release also bumps npm `0.8.0` → `0.9.0` (Task 4).
- Prose lines in canon/skill files stay ≤500 chars; table rows and fenced code blocks exempt.
- Tests: `npm test` (node:test + tsx). Commit after every task.

---

### Task 1: Managed skills + living canon gate on `validate --json` (canon-first)

**Files:**
- Modify: `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-bootstrap/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, `embedded/skills/canon-contract/SKILL.md`, `embedded/skills/canon-future-plan/SKILL.md` (success-gate lines)
- Modify: `docs/canon/CLI.md` (validate row + flags table), `docs/canon/SKILLS.md` (invariant), `docs/canon/ARCHITECTURE.md` (Validate building block), `docs/canon/GLOSSARY.md` (new term)
- Modify: `src/version.ts` (`SKILLS_STAMP`), `docs/canon/CANON_CONTRACT.md` (`skills_stamp`)
- Modify: `tests/embedded-assets.test.ts` (assert the new gate)

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces: `SKILLS_STAMP = "0.16.0"` in `src/version.ts`; the new gate sentence in every embedded skill; `upgrade-skills` refreshed harness trees.

This task is a canon-first update executed via the `canon-write` skill discipline (invoke the skill, then apply the edits below). Do NOT touch application code beyond `src/version.ts`.

- [ ] **Step 1: Replace the success gate in all five skills**

In each of the five `embedded/skills/*/SKILL.md`, replace the line:

```
- Always run `doc-canon validate` before claiming success on canon edits.
```

with:

```
- Always run `doc-canon validate --json` before claiming success on canon edits; success requires exit 0 and zero `error`-severity issues.
```

- [ ] **Step 2: Update the remaining `validate` invocations in skill bodies**

Replace each of these exact lines (old → new):

- `canon-audit/SKILL.md` line 18: `1. Run `doc-canon validate` first. If it fails, stop the semantic pass and repair structure through canon-write or the contract through canon-contract.` → `1. Run `doc-canon validate --json` first. If it fails (exit ≠0 or `error`-severity issues), stop the semantic pass and repair structure through canon-write or the contract through canon-contract.`
- `canon-audit/SKILL.md` line 60: `4. For `docs_stale`, edit the canon from its template and run `doc-canon validate`. Only after validation succeeds, set `decision: docs_stale`, then move the entry to Resolved in the same session.` → `4. For `docs_stale`, edit the canon from its template and run `doc-canon validate --json`. Only after it succeeds, set `decision: docs_stale`, then move the entry to Resolved in the same session.`
- `canon-audit/SKILL.md` line 64: `Finish by running `doc-canon validate` again after any canon edits and report remaining open decisions.` → `Finish by running `doc-canon validate --json` again after any canon edits and report remaining open decisions.`
- `canon-contract/SKILL.md` line 24: `7. Run `doc-canon validate`. If it fails, repair only the confirmed local contract/template change or report the blocker.` → `7. Run `doc-canon validate --json`. If it fails, repair only the confirmed local contract/template change or report the blocker.`
- `canon-bootstrap/SKILL.md` line 37: `5. Run `doc-canon validate`. After it succeeds, import sources outside `docs/canon/` are not SoT. Do not delete or silently update those legacy files.` → `5. Run `doc-canon validate --json`. After it succeeds, import sources outside `docs/canon/` are not SoT. Do not delete or silently update those legacy files.`
- `canon-write/SKILL.md` line 74: `10. Validate after edits by running `doc-canon validate`. Claim success only after it passes.` → `10. Validate after edits by running `doc-canon validate --json`. Claim success only after it passes.`
- `canon-future-plan/SKILL.md` line 52: `9. Run `doc-canon validate`. Claim success only after it passes.` → `9. Run `doc-canon validate --json`; claim success only after it passes (exit 0, zero `error`-severity issues).`
- `canon-future-plan/SKILL.md` line 60: `3. Run `doc-canon validate` and claim success only after it passes.` → `3. Run `doc-canon validate --json` and claim success only after it passes.`

- [ ] **Step 3: Update living canon**

- `docs/canon/CLI.md` — `validate` behavior row (line 65, starts `| `validate` | Schema + structure; exit ≠0 on errors; need not write report; …`): append a clause — `--json` prints structured issues `{schema_version: 1, ok, issues: [{message, kind, paths, severity}]}` to stdout, warnings included as `severity: "warning"` issues, exit code unchanged. Flags table row (line 85): `| `validate` | `--root <path>` (default `.`) |` → `| `validate` | `--root <path>` (default `.`), `--json` |` (the exhaustive-flags contract: a flag not listed does not exist).
- `docs/canon/SKILLS.md` — invariant line `Always `doc-canon validate` before claiming success on canon edits` → `Always `doc-canon validate --json` before claiming success on canon edits (exit 0, zero `error`-severity issues)`.
- `docs/canon/ARCHITECTURE.md` — Validate building block bullet: note validators return structured issues (`kind`/`paths`/`severity`) and the CLI exposes `--json`.
- `docs/canon/GLOSSARY.md` — add a term **Validation issue**: `A structured validation finding {message, kind, paths, severity} emitted by the validate pipeline; consumed by `doc-canon validate --json` and mapped to report findings by `check`.`

- [ ] **Step 4: Bump the stamp**

In `src/version.ts` change `SKILLS_STAMP = "0.15.0"` → `SKILLS_STAMP = "0.16.0"`. In `docs/canon/CANON_CONTRACT.md` change `skills_stamp: "0.15.0"` → `skills_stamp: "0.16.0"`.

- [ ] **Step 5: Strengthen the embedded-assets test**

In `tests/embedded-assets.test.ts`, first test (`ships five canon skills with shared safety guidance`), add after the `doc-canon validate` assert:

```ts
assert.match(markdown, /doc-canon validate --json/, skill);
```

- [ ] **Step 6: Propagate and verify**

Run: `node bin/doc-canon.js upgrade-skills --yes` (refreshes `.dsh/skills`, `.cursor/skills`, `.claude/skills`). Run: `node bin/doc-canon.js validate` — expected `Canon is valid.` exit 0. Run: `npm test` — expected all tests pass **including** `skills-stamp-guard.test.ts` (it needs this commit to set the new `SKILLS_STAMP` line in `src/version.ts`) and `embedded-assets.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add embedded/skills docs/canon src/version.ts tests/embedded-assets.test.ts
git commit -m "feat(skills): canon skills gate success on validate --json; skills_stamp 0.16.0 (P9)"
```

- [ ] **Step 8: STOP — user go-ahead gate**

This is a substantial canon change. Do not start Task 2 until the user explicitly approves continuing.

---

### Task 2: Structured validation issues (`ValidationIssue` model, validator refactor, `check` mapping)

**Files:**
- Create: `src/validate/types.ts`
- Modify: `src/validate/validate.ts` (issues instead of strings; delete `validationErrorKind`/`validationErrorPaths`)
- Modify: `src/validate/links.ts`, `src/validate/index-agreement.ts`, `src/validate/future-plans-index.ts` (return issues)
- Modify: `src/commands/check.ts` (map issues → findings directly; delete regex imports)
- Test: `tests/validate.test.ts`, `tests/validate-future-plans.test.ts`, `tests/contract.test.ts`, `tests/ensure-future-plans.test.ts`, `tests/templates-fixture.test.ts` (shape migration + new asserts), `tests/check.test.ts` (kind/paths asserts)

**Interfaces:**
- Consumes: `SKILLS_STAMP` bump from Task 1 (unchanged here).
- Produces: `validateCanon(root: string): ValidationResult` where `ValidationResult = { ok: boolean; issues: ValidationIssue[] }` and `ValidationIssue = { message: string; kind: FindingKind; paths: string[]; severity: "error" | "warning" }` (exported from `src/validate/types.ts`); `checkCanon` maps `issues.filter(i => i.severity === "error")` to findings.

- [ ] **Step 1: Create the types**

Create `src/validate/types.ts`:

```ts
import type { FindingKind } from "../report/types.js";

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  message: string;
  kind: FindingKind;
  paths: string[];
  severity: ValidationSeverity;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
```

- [ ] **Step 2: Migrate tests to the new shape (red)**

In `tests/validate.test.ts` change the happy-canon assert to:

```ts
assert.deepEqual(validateCanon(fixture("happy-canon")), { ok: true, issues: [] });
```

and replace every `result.errors.join("\n")` with `result.issues.map((i) => i.message).join("\n")` (keeps the existing regex assertions on message text). Apply the same `errors`→`issues`/`warnings`→`issues` migration to the other four test files that touch the result shape (18 assertion sites total; grep `errors:` / `warnings:` / `.errors` in `tests/` to find them).

- [ ] **Step 3: Run the migrated tests to verify they fail**

Run: `node --import tsx --test tests/validate.test.ts` — expected: FAIL (validateCanon still returns `{ok, errors, warnings}`; `issues` is undefined).

- [ ] **Step 4: Refactor `src/validate/validate.ts` to emit issues**

Add the helper and swap the accumulators:

```ts
import type { FindingKind } from "../report/types.js";
import type { ValidationIssue, ValidationResult, ValidationSeverity } from "./types.js";

function addIssue(
  issues: ValidationIssue[],
  message: string,
  kind: FindingKind,
  paths: string[],
  severity: ValidationSeverity = "error",
): void {
  issues.push({ message, kind, paths, severity });
}
```

Change `validateCanon(root: string): ValidateResult` → `validateCanon(root: string): ValidationResult` with `const issues: ValidationIssue[] = []`; every `errors.push(msg)` becomes `addIssue(issues, msg, "structure", [path])` and every `warnings.push(msg)` becomes `addIssue(issues, msg, "structure", [path], "warning")` using the per-check path from the mapping below. The three early `return { ok: false, errors, warnings }` sites become `return { ok: false, issues }`. The final return becomes:

```ts
return { ok: issues.every((i) => i.severity !== "error"), issues };
```

Per-check path mapping (message text unchanged): contract/stamp checks → `["CANON_CONTRACT.md"]`; section/template checks → `[section.path]` / `[template.path]`; `max_lines` and `max_line_length` → warning, `[section.path]`; INDEX agreement → `["INDEX.md"]`; future-plans zone → affected path; orphan → `[relative]`; broken link → `consistency`, `[sourcePath, href]`.

Change the three helper validators to return issues and call `addIssue` at the point of detection (keep their exported names):

- `src/validate/links.ts` — `findBrokenCanonLinks(markdown, sourcePath, canonRoot): ValidationIssue[]`; for each broken link push `addIssue(issues, `${path.relative(canonRoot, sourcePath)} links to missing ${href}`, "consistency", [path.relative(canonRoot, sourcePath), href])` (reuse the existing message template exactly, including `href` as written).
- `src/validate/index-agreement.ts` — `validateIndexAgreement(indexMarkdown, contract): ValidationIssue[]`, kind `structure`, paths `["INDEX.md"]`, messages unchanged.
- `src/validate/future-plans-index.ts` — `validateFuturePlansZone(canonRoot, contract): ValidationIssue[]`, kind `structure`, paths per violation (initiative file or `future_plans/INDEX.md`), messages unchanged.

Delete `validationErrorKind` and `validationErrorPaths` (lines ~39/43) from `validate.ts` — they are no longer produced here.

- [ ] **Step 5: Map issues in `src/commands/check.ts`**

Replace the `validation.errors.map(...)` block (with `validationErrorKind`/`validationErrorPaths`) with a direct map over error-severity issues:

```ts
const cliFindings: Finding[] = validation.issues
  .filter((issue) => issue.severity === "error")
  .map((issue) => ({
    id: stableFindingId(issue.kind, issue.paths, issue.message),
    kind: issue.kind,
    paths: issue.paths,
    summary: issue.message,
    status: "open" as const,
    source: "cli" as const,
  }));
```

Remove the now-unused imports of `validationErrorKind`/`validationErrorPaths`. `stableFindingId` and the discipline-findings block stay untouched.

- [ ] **Step 6: Run the migrated tests to verify they pass**

Run: `npm test` — expected: all pass, including the migrated shape assertions.

- [ ] **Step 7: Add per-check kind/paths/severity tests**

Append to `tests/validate.test.ts` inside `describe("validateCanon")`:

```ts
it("marks broken links as consistency issues with source and href paths", () => {
  const result = validateCanon(fixture("broken-link"));
  const link = result.issues.find((i) => i.kind === "consistency");
  assert.ok(link);
  assert.equal(link.paths.length, 2);
  assert.match(link.paths[0]!, /\.md$/);
  assert.match(link.message, /links to missing/);
});

it("marks missing sections as structure issues with the section path", () => {
  const result = validateCanon(fixture("missing-section"));
  const issue = result.issues.find((i) => i.message.match(/missing required section/i));
  assert.ok(issue);
  assert.equal(issue.kind, "structure");
  assert.deepEqual(issue.severity, "error");
  assert.deepEqual(issue.paths, ["OVERVIEW.md"]);
});

it("keeps max_line_length as a warning severity issue", () => {
  const result = validateCanon(fixture("long-lines"));
  const issue = result.issues.find((i) => i.message.match(/max_line_length/));
  assert.ok(issue);
  assert.deepEqual(issue.severity, "warning");
});
```

Create the two new fixtures under `tests/fixtures/` by copying `happy-canon` and: `broken-link` — add one `[x](missing.md)` link in `OVERVIEW.md`; `long-lines` — add one prose line > `policies.max_line_length` (default 500) in `OVERVIEW.md`. If a fixture copy diverges from the happy canon contract, adjust the copied contract to match the minimal change.

Also append to `tests/check.test.ts`:

```ts
it("writes CLI findings with kind and paths from structured issues", async () => {
  const { root, cleanup } = temporaryHappyCanon();
  try {
    const overview = join(root, "docs", "canon", "OVERVIEW.md");
    writeFileSync(overview, readFileSync(overview, "utf8") + "\n[broken](missing.md)\n");
    assert.equal(await checkCanon(root), 1);
    const report = readReport(root);
    const finding = report!.findings.find((f) => f.kind === "consistency");
    assert.ok(finding);
    assert.equal(finding.paths.length, 2);
    assert.equal(finding.source, "cli");
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 8: Run the full suite**

Run: `npm test` — expected: all pass. Then `node bin/doc-canon.js validate` — `Canon is valid.` (no behavior change for human output yet).

- [ ] **Step 9: Commit**

```bash
git add src/validate src/commands/check.ts tests
git commit -m "refactor(validate): structured issues with kind/paths/severity; check maps directly (P9)"
```

---

### Task 3: `doc-canon validate --json` CLI

**Files:**
- Modify: `src/cli.ts` (validate command: `--json` option)
- Modify: `src/commands/validate.ts` (human formatting byte-identical + `--json` mode)
- Test: create `tests/validate-cli-json.test.ts`

**Interfaces:**
- Consumes: `ValidationResult`/`ValidationIssue` from `src/validate/types.js` (Task 2).
- Produces: `validateCanon(root: string, opts?: { json?: boolean }): Promise<number>` in `src/commands/validate.ts`; `doc-canon validate --json` prints `{schema_version: 1, ok, issues}` to stdout.

- [ ] **Step 1: Write the failing CLI test**

Create `tests/validate-cli-json.test.ts`:

```ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testsDir, "..");
const bin = join(repoRoot, "bin", "doc-canon.js");
const fixture = (name: string): string => join(testsDir, "fixtures", name);

describe("doc-canon validate --json", () => {
  it("emits {schema_version, ok, issues} on stdout for a valid canon", () => {
    const r = spawnSync("node", [bin, "validate", "--json", "--root", fixture("happy-canon")], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr);
    const pack = JSON.parse(r.stdout) as { schema_version: number; ok: boolean; issues: unknown[] };
    assert.equal(pack.schema_version, 1);
    assert.equal(pack.ok, true);
    assert.deepEqual(pack.issues, []);
  });

  it("lists error-severity issues with kind and paths for a broken canon", () => {
    const r = spawnSync("node", [bin, "validate", "--json", "--root", fixture("missing-section")], { encoding: "utf8" });
    assert.equal(r.status, 1);
    const pack = JSON.parse(r.stdout) as { ok: boolean; issues: Array<{ kind: string; severity: string; paths: string[] }> };
    assert.equal(pack.ok, false);
    assert.ok(pack.issues.some((i) => i.severity === "error" && i.paths.length > 0));
  });

  it("keeps human mode byte-identical", () => {
    const r = spawnSync("node", [bin, "validate", "--root", fixture("missing-section")], { encoding: "utf8" });
    assert.equal(r.status, 1);
    assert.match(r.stderr, /^error: .*missing required section/i);
    assert.equal(r.stdout, "");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test tests/validate-cli-json.test.ts` — expected: FAIL with `error: unknown option '--json'`.

- [ ] **Step 3: Add the CLI option**

In `src/cli.ts`, the `validate` command gains `.option("--json", "emit structured issues JSON on stdout")` and the action passes `opts` through: `process.exitCode = await validateCanon(opts.root, { json: opts.json });`.

- [ ] **Step 4: Implement the command layer**

Replace `src/commands/validate.ts` body with:

```ts
import { validateCanon as validateStructure } from "../validate/validate.js";

export async function validateCanon(
  root: string,
  opts: { json?: boolean } = {},
): Promise<number> {
  const result = validateStructure(root);
  if (opts.json) {
    console.log(
      JSON.stringify({ schema_version: 1, ok: result.ok, issues: result.issues }, null, 2),
    );
    return result.ok ? 0 : 1;
  }
  for (const warning of result.issues.filter((i) => i.severity === "warning")) {
    console.warn(`warning: ${warning.message}`);
  }
  for (const error of result.issues.filter((i) => i.severity === "error")) {
    console.error(`error: ${error.message}`);
  }
  if (result.ok) console.log("Canon is valid.");
  return result.ok ? 0 : 1;
}
```

The human path prints all warnings then all errors then the success line — byte-identical to the previous two-array loop because filtering a single issues array preserves each group's relative order.

- [ ] **Step 5: Run tests to verify they pass**

Run: `node --import tsx --test tests/validate-cli-json.test.ts` — expected: PASS. Then `npm test` — all pass. Then `node bin/doc-canon.js validate` in the repo root — `Canon is valid.` exit 0; `node bin/doc-canon.js validate --json` prints the JSON pack.

- [ ] **Step 6: Commit**

```bash
git add src/cli.ts src/commands/validate.ts tests/validate-cli-json.test.ts
git commit -m "feat(cli): doc-canon validate --json (P9)"
```

---

### Task 4: Release prep — npm 0.9.0 (soft-coupled stamp bump)

**Files:**
- Modify: `package.json` (version), `src/version.ts` (`PACKAGE_VERSION`), `CHANGELOG.md` (0.9.0 entry), `README.md` (validate `--json` in EN + RU sections)
- Test: `tests/version-consistency.test.ts` (must pass)

**Interfaces:**
- Consumes: Task 1 stamp bump (0.16.0) — soft coupling requires the npm minor bump here.
- Produces: `PACKAGE_VERSION = "0.9.0"` matching `package.json` version; release-ready CHANGELOG.

- [ ] **Step 1: Bump versions**

`package.json` version `0.8.0` → `0.9.0`; `src/version.ts` `PACKAGE_VERSION = "0.8.0"` → `"0.9.0"`.

- [ ] **Step 2: CHANGELOG entry**

Add under `# Changelog`:

```
## 0.9.0

- **feat:** `doc-canon validate --json` — structured issues (`{schema_version: 1, ok, issues: [{message, kind, paths, severity}]}`) replace English-message parsing; validators attach kind/paths at detection, `check` maps issues to findings directly; `SKILLS_STAMP` 0.16.0 — all five canon skills gate success on `validate --json`
```

- [ ] **Step 3: README mirror**

In `README.md` (EN `### validate` and RU `### validate` sections) add the `--json` example and one line describing the machine shape.

- [ ] **Step 4: Verify**

Run: `node --import tsx --test tests/version-consistency.test.ts tests/skills-stamp-guard.test.ts tests/embedded-assets.test.ts` — expected: PASS. Then `npm test` (full suite) and `node bin/doc-canon.js validate`.

- [ ] **Step 5: Commit**

```bash
git add package.json src/version.ts CHANGELOG.md README.md
git commit -m "chore: prepare doc-canon 0.9.0 (P9 structured validate)"
```

---

### Task 5: Closing canon-audit and absorb P9

**Files:**
- Modify: `docs/canon/future_plans/p9-cli-structured-validate.md` (Status), `docs/canon/future_plans/INDEX.md` (row)

**Interfaces:**
- Consumes: Tasks 1–4 shipped; living canon (CLI.md, SKILLS.md, ARCHITECTURE.md, GLOSSARY.md) already describes `validate --json` (Task 1).
- Produces: P9 `absorbed`; `Canon is valid.`.

- [ ] **Step 1: Run the closing canon-audit**

Invoke the `canon-audit` skill on the validate/CLI topic: `validate` then `check`, Scout via `doc-canon search "validate json"`, and verify docs↔code agreement — CLI.md documents `--json` and the code implements it; SKILLS.md/embedded skills and the stamp match. Resolve any findings (do not silently pick a side).

- [ ] **Step 2: Absorb P9**

Via the `canon-future-plan` skill absorb handoff (outcomes already merged into living canon in Task 1): set `p9-cli-structured-validate.md` Status `refining` → `absorbed` and update the `future_plans/INDEX.md` row for `9` to `absorbed`.

- [ ] **Step 3: Verify and commit**

Run: `node bin/doc-canon.js validate` — `Canon is valid.` Then:

```bash
git add docs/canon/future_plans
git commit -m "docs(canon): mark P9 structured validate absorbed"
```

Then run the full release per `scripts/release.sh` (test, build, pack-check, publish, tag `v0.9.0`) — the maintainer's step.

