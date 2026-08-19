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
import { validateCanon } from "../src/validate/validate.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

it("rejects a missing contract before creating managed assets", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-missing-contract-"));
  try {
    await assert.rejects(upgradeSkills(root), /CANON_CONTRACT\.md.*does not exist/i);
    assert.equal(existsSync(join(root, ".cursor", "skills")), false);
    assert.equal(existsSync(join(root, ".cursor", "rules")), false);
    assert.equal(existsSync(join(root, "AGENTS.md")), false);
    assert.equal(existsSync(join(root, "CLAUDE.md")), false);
    assert.equal(existsSync(join(root, ".claude")), false);
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
    const dshSkillPath = join(
      root,
      ".dsh",
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
    writeFileSync(dshSkillPath, "stale dsh skill\n");
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
      readFileSync(dshSkillPath, "utf8"),
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
    assert.equal(
      readFileSync(
        join(root, ".claude", "skills", "canon-write", "SKILL.md"),
        "utf8",
      ),
      readFileSync(
        join(embeddedRoot(), "skills", "canon-write", "SKILL.md"),
        "utf8",
      ),
    );
    assert.match(
      readFileSync(join(root, "CLAUDE.md"), "utf8"),
      /Feature-change order \(canon-first\)/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not reinstall a deleted harness tree without opt-in", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-claude-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    rmSync(join(root, ".claude"), { recursive: true, force: true });
    assert.equal(await upgradeSkills(root), 0);
    assert.equal(existsSync(join(root, ".claude")), false);
    // The always-on blocks are still upserted regardless of harness selection.
    assert.match(
      readFileSync(join(root, "CLAUDE.md"), "utf8"),
      /# doc-canon context rule/,
    );
    // The still-present harnesses keep their refreshed trees.
    assert.equal(
      existsSync(join(root, ".cursor", "skills", "canon-write", "SKILL.md")),
      true,
    );
    assert.equal(
      existsSync(join(root, ".dsh", "skills", "canon-write", "SKILL.md")),
      true,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("reinstalls a deleted harness tree when explicitly selected", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-claude-optin-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    rmSync(join(root, ".claude"), { recursive: true, force: true });
    assert.equal(await upgradeSkills(root, { harnesses: "claude" }), 0);
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

it("refreshes only the harnesses passed via --harnesses", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-dsh-only-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const cursorSkill = join(
      root,
      ".cursor",
      "skills",
      "canon-write",
      "SKILL.md",
    );
    writeFileSync(cursorSkill, "stale cursor skill\n");
    assert.equal(await upgradeSkills(root, { harnesses: "dsh" }), 0);
    // dsh refreshed, cursor untouched (not selected), claude untouched.
    assert.equal(
      readFileSync(
        join(root, ".dsh", "skills", "canon-write", "SKILL.md"),
        "utf8",
      ),
      readFileSync(
        join(embeddedRoot(), "skills", "canon-write", "SKILL.md"),
        "utf8",
      ),
    );
    assert.equal(readFileSync(cursorSkill, "utf8"), "stale cursor skill\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("restores a stripped future_plans skeleton", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-future-plans-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const initiativePath = join(canon, "future_plans", "demo-initiative.md");
    const planted =
      "# Planted\n\n## Intent\nx\n\n## In scope\ny\n\n## Out of scope\nz\n\n## Absorbs into\na\n\n## Open questions\nb\n";
    writeFileSync(initiativePath, planted);

    const fpIndexPath = join(canon, "future_plans", "INDEX.md");
    writeFileSync(
      fpIndexPath,
      readFileSync(fpIndexPath, "utf8").replace(
        /## Initiatives[\s\S]*$/,
        `## Initiatives

| # | Initiative | Status | File |
| --- | --- | --- | --- |
| 9 | Demo | draft | [demo-initiative.md](demo-initiative.md) |
`,
      ),
    );

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
        `  - id: future-demo
    path: future_plans/demo-initiative.md
    role: section
    required: false
    template: FUTURE_PLAN
templates:
`,
      );
    writeFileSync(contractPath, contract);
    rmSync(join(canon, "templates", "FUTURE_PLANS_INDEX.md"), { force: true });
    rmSync(join(canon, "templates", "FUTURE_PLAN.md"), { force: true });

    const indexPath = join(canon, "INDEX.md");
    writeFileSync(
      indexPath,
      readFileSync(indexPath, "utf8").replace(
        /\| future-plans-index \| future_plans\/INDEX\.md \| section \| true \|\n/,
        `| future-plans-index | future_plans/INDEX.md | section | true |
| future-demo | future_plans/demo-initiative.md | section | false |
`,
      ),
    );

    assert.equal(await upgradeSkills(root), 0);

    assert.equal(existsSync(fpIndexPath), true);
    assert.equal(existsSync(join(canon, "templates", "FUTURE_PLAN.md")), true);
    assert.match(readFileSync(indexPath, "utf8"), /future_plans\/INDEX\.md/);
    assert.match(
      readFileSync(contractPath, "utf8"),
      /path:\s*future_plans\/INDEX\.md/,
    );
    assert.doesNotMatch(
      readFileSync(contractPath, "utf8"),
      /future_plans\/demo-initiative\.md/,
    );
    assert.doesNotMatch(readFileSync(contractPath, "utf8"), /future-demo/);
    assert.equal(readFileSync(initiativePath, "utf8"), planted);
    assert.equal(validateCanon(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [name, malformed] of [
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
      writeFileSync(agentsPath, malformed);

      await assert.rejects(
        upgradeSkills(root),
        /AGENTS\.md.*exactly one.*doc-canon:start.*doc-canon:end.*start.*before.*end/i,
      );
      assert.equal(readFileSync(agentsPath, "utf8"), malformed);
      assert.equal(readFileSync(skillPath, "utf8"), "user-visible stale skill\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it(`rejects ${name} without changing CLAUDE.md`, async () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-upgrade-claude-markers-"));
    try {
      assert.equal(await initCanon(root, { yes: true }), 0);
      const claudePath = join(root, "CLAUDE.md");
      const skillPath = join(
        root,
        ".claude",
        "skills",
        "canon-write",
        "SKILL.md",
      );
      writeFileSync(skillPath, "user-visible stale claude skill\n");
      writeFileSync(claudePath, malformed);

      await assert.rejects(
        upgradeSkills(root),
        /CLAUDE\.md.*exactly one.*doc-canon:start.*doc-canon:end.*start.*before.*end/i,
      );
      assert.equal(readFileSync(claudePath, "utf8"), malformed);
      assert.equal(
        readFileSync(skillPath, "utf8"),
        "user-visible stale claude skill\n",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
