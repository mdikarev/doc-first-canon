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
