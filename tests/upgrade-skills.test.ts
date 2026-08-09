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
import { upgradeSkills } from "../src/commands/upgrade-skills.js";
import { embeddedRoot } from "../src/paths.js";
import { SKILLS_STAMP } from "../src/version.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

it("rejects a missing contract before creating managed assets", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-missing-contract-"));
  try {
    await assert.rejects(upgradeSkills(root), /CANON_CONTRACT\.md.*does not exist/i);
    assert.equal(existsSync(join(root, ".cursor", "skills")), false);
    assert.equal(existsSync(join(root, ".cursor", "rules")), false);
    assert.equal(existsSync(join(root, "AGENTS.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("prints expected upgrade failures without a stack trace", () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-cli-failure-"));
  try {
    const result = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "upgrade-skills", "--root", root],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:.*CANON_CONTRACT\.md.*does not exist/i);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("refreshes managed assets and stamp without replacing canon prose", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const overviewPath = join(root, "docs", "canon", "OVERVIEW.md");
    const contractPath = join(root, "docs", "canon", "CANON_CONTRACT.md");
    const skillPath = join(
      root,
      ".cursor",
      "skills",
      "canon-write",
      "SKILL.md",
    );
    const rulePath = join(root, ".cursor", "rules", "doc-canon.mdc");
    const agentsPath = join(root, "AGENTS.md");
    const customOverview = `${readFileSync(overviewPath, "utf8")}\nUser prose.\n`;
    const staleContract = readFileSync(contractPath, "utf8")
      .replace(`skills_stamp: "${SKILLS_STAMP}"`, 'skills_stamp: "0.0.0"')
      .replace(
        "## Change policy",
        "Custom contract prose.\n\n## Change policy",
      );
    writeFileSync(overviewPath, customOverview);
    writeFileSync(contractPath, staleContract);
    writeFileSync(skillPath, "stale skill\n");
    writeFileSync(rulePath, "stale rule\n");
    writeFileSync(
      agentsPath,
      `Project instructions.\n\n<!-- doc-canon:start -->\nstale block\n<!-- doc-canon:end -->\n`,
    );

    assert.equal(await upgradeSkills(root), 0);

    assert.equal(readFileSync(overviewPath, "utf8"), customOverview);
    assert.equal(
      readFileSync(contractPath, "utf8"),
      staleContract.replace(
        'skills_stamp: "0.0.0"',
        `skills_stamp: "${SKILLS_STAMP}"`,
      ),
    );
    assert.equal(
      readFileSync(skillPath, "utf8"),
      readFileSync(
        join(embeddedRoot(), "skills", "canon-write", "SKILL.md"),
        "utf8",
      ),
    );
    assert.equal(
      readFileSync(rulePath, "utf8"),
      readFileSync(join(embeddedRoot(), "rules", "doc-canon.mdc"), "utf8"),
    );
    assert.match(readFileSync(agentsPath, "utf8"), /^Project instructions\./);
    assert.match(
      readFileSync(agentsPath, "utf8"),
      /For design and development, treat `docs\/canon\/`/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("restores a stripped future_plans skeleton without touching planted initiatives", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-future-plans-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const initiativePath = join(canon, "future_plans", "demo-initiative.md");
    const planted =
      "# Planted\n\n## Intent\nx\n\n## In scope\ny\n\n## Out of scope\nz\n\n## Absorbs into\na\n\n## Open questions\nb\n";
    writeFileSync(initiativePath, planted);

    let contract = readFileSync(contractPath, "utf8");
    contract = contract
      .replace(
        /\n  - id: future-plans-index[\s\S]*?template: FUTURE_PLANS_INDEX\n/,
        "\n",
      )
      .replace(
        /\n  - id: FUTURE_PLANS_INDEX\n    path: templates\/FUTURE_PLANS_INDEX\.md\n/,
        "\n",
      )
      .replace(
        /\n  - id: FUTURE_PLAN\n    path: templates\/FUTURE_PLAN\.md\n/,
        "\n",
      )
      .replace(
        "templates:\n",
        "  - id: future-demo\n    path: future_plans/demo-initiative.md\n    role: section\n    required: false\n    template: FUTURE_PLAN\ntemplates:\n",
      );
    writeFileSync(contractPath, contract);
    rmSync(join(canon, "future_plans", "INDEX.md"), { force: true });
    rmSync(join(canon, "templates", "FUTURE_PLANS_INDEX.md"), { force: true });
    rmSync(join(canon, "templates", "FUTURE_PLAN.md"), { force: true });

    const indexPath = join(canon, "INDEX.md");
    writeFileSync(
      indexPath,
      readFileSync(indexPath, "utf8").replace(
        /\| future-plans-index \| future_plans\/INDEX\.md \| section \| true \|\n/,
        "",
      ),
    );

    assert.equal(await upgradeSkills(root), 0);

    assert.equal(existsSync(join(canon, "future_plans", "INDEX.md")), true);
    assert.equal(existsSync(join(canon, "templates", "FUTURE_PLAN.md")), true);
    assert.equal(readFileSync(initiativePath, "utf8"), planted);
    assert.match(readFileSync(indexPath, "utf8"), /future_plans\/INDEX\.md/);
    assert.match(
      readFileSync(contractPath, "utf8"),
      /path:\s*future_plans\/INDEX\.md/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, malformedAgents] of [
  [
    "unmatched start marker",
    "Project instructions.\n\n<!-- doc-canon:start -->\nUser content.\n",
  ],
  [
    "reversed markers",
    "Project instructions.\n\n<!-- doc-canon:end -->\nUser content.\n<!-- doc-canon:start -->\n",
  ],
  [
    "duplicate start markers",
    "Project instructions.\n\n<!-- doc-canon:start -->\nUser content.\n<!-- doc-canon:start -->\n<!-- doc-canon:end -->\n",
  ],
] as const) {
  it(`rejects ${name} without changing AGENTS.md`, async () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-markers-"));
    try {
      assert.equal(await initCanon(root, { yes: true }), 0);
      const agentsPath = join(root, "AGENTS.md");
      const skillPath = join(
        root,
        ".cursor",
        "skills",
        "canon-write",
        "SKILL.md",
      );
      writeFileSync(skillPath, "user-visible stale skill\n");
      writeFileSync(agentsPath, malformedAgents);

      await assert.rejects(
        upgradeSkills(root),
        /AGENTS\.md.*exactly one.*doc-canon:start.*doc-canon:end.*start.*before.*end/i,
      );
      assert.equal(readFileSync(agentsPath, "utf8"), malformedAgents);
      assert.equal(readFileSync(skillPath, "utf8"), "user-visible stale skill\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
