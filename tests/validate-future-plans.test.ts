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
