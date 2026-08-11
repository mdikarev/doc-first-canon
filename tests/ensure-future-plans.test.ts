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
import { ensureFuturePlansSkeleton } from "../src/scaffold/ensure-future-plans.js";
import { parseContractMarkdown } from "../src/contract/parse.js";
import { validateCanon } from "../src/validate/validate.js";

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

it("is idempotent when the future_plans skeleton already exists", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-idempotent-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const contractBefore = readFileSync(contractPath, "utf8");
    const indexBefore = readFileSync(join(canon, "INDEX.md"), "utf8");
    const futurePlansIndexBefore = readFileSync(
      join(canon, "future_plans", "INDEX.md"),
      "utf8",
    );

    const result = ensureFuturePlansSkeleton(root, contractBefore);

    assert.equal(result.contractChanged, false);
    assert.equal(result.indexTableChanged, false);
    assert.equal(result.createdIndex, false);
    assert.deepEqual(result.createdTemplates, []);
    assert.equal(result.contractMarkdown, contractBefore);
    assert.equal(
      readFileSync(join(canon, "future_plans", "INDEX.md"), "utf8"),
      futurePlansIndexBefore,
    );
    assert.equal(readFileSync(join(canon, "INDEX.md"), "utf8"), indexBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("preserves literal $& in contract policies.ignore when rewriting the yaml block", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-dollar-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const contract = readFileSync(contractPath, "utf8")
      .replace("  ignore: []", () => '  ignore: ["**/$&cache/**"]')
      .replace(
        "  - id: future-plans-index\n    path: future_plans/INDEX.md\n    role: section\n    required: true\n    template: FUTURE_PLANS_INDEX",
        "  - id: future-plans-index\n    path: future_plans/INDEX.md\n    role: section\n    required: false\n    template: FUTURE_PLANS_INDEX",
      );
    writeFileSync(contractPath, contract);

    // Sanity check the fixture actually contains a literal, unescaped $&.
    assert.match(contract, /\*\*\/\$&cache\/\*\*/);

    const result = ensureFuturePlansSkeleton(root, contract);
    assert.equal(result.contractChanged, true);

    const parsed = parseContractMarkdown(result.contractMarkdown);
    assert.deepEqual(parsed.policies.ignore, ["**/$&cache/**"]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("appends the Sections row even when an unrelated table elsewhere mentions the future_plans path", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-scoped-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const indexPath = join(canon, "INDEX.md");
    let index = readFileSync(indexPath, "utf8").replace(
      /\| future-plans-index \| future_plans\/INDEX\.md \| section \| true \|\n/,
      "",
    );
    // An unrelated pipe table outside the Sections heading that happens to
    // mention the same path text must not be mistaken for the real row.
    index += `\n## Unrelated\n| note | path |\n| --- | --- |\n| see also | future_plans/INDEX.md |\n`;
    writeFileSync(indexPath, index);

    const contractPath = join(canon, "CANON_CONTRACT.md");
    const result = ensureFuturePlansSkeleton(root, readFileSync(contractPath, "utf8"));
    writeFileSync(contractPath, result.contractMarkdown);

    assert.equal(result.indexTableChanged, true);
    const updatedIndex = readFileSync(indexPath, "utf8");
    const sectionsBody =
      /^##\s+Sections\s*$(.*?)(?=^##\s|(?![\s\S]))/ims.exec(updatedIndex)?.[1] ?? "";
    assert.match(sectionsBody, /future_plans\/INDEX\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not duplicate the Sections row when it is present as a markdown link cell", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-linkcell-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const indexPath = join(canon, "INDEX.md");
    const index = readFileSync(indexPath, "utf8").replace(
      "| future-plans-index | future_plans/INDEX.md | section | true |",
      "| future-plans-index | [future_plans/INDEX.md](future_plans/INDEX.md) | section | true |",
    );
    writeFileSync(indexPath, index);
    const before = readFileSync(indexPath, "utf8");

    const contractPath = join(canon, "CANON_CONTRACT.md");
    const result = ensureFuturePlansSkeleton(root, readFileSync(contractPath, "utf8"));

    assert.equal(result.indexTableChanged, false);
    assert.equal(readFileSync(indexPath, "utf8"), before);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("strips optional initiative section rows but keeps initiative files", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-strip-fp-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const initiativePath = join(canon, "future_plans", "demo-initiative.md");
    writeFileSync(
      initiativePath,
      "# Demo\n\n## Intent\nx\n\n## In scope\ny\n\n## Out of scope\nz\n\n## Absorbs into\na\n\n## Open questions\nb\n",
    );
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

it("promotes an existing but optional future-plans-index section to required", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-ensure-fp-optional-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const contract = readFileSync(contractPath, "utf8").replace(
      "  - id: future-plans-index\n    path: future_plans/INDEX.md\n    role: section\n    required: true\n    template: FUTURE_PLANS_INDEX",
      "  - id: future-plans-index\n    path: future_plans/INDEX.md\n    role: section\n    required: false\n    template: FUTURE_PLANS_INDEX",
    );
    writeFileSync(contractPath, contract);

    const result = ensureFuturePlansSkeleton(root, contract);
    const parsed = parseContractMarkdown(result.contractMarkdown);
    const section = parsed.sections.find((s) => s.path === "future_plans/INDEX.md");
    assert.equal(section?.required, true);
    assert.equal(result.contractChanged, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
