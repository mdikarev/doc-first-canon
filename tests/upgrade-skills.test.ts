import assert from "node:assert/strict";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { it } from "node:test";
import { initCanon } from "../src/commands/init.js";
import { upgradeSkills } from "../src/commands/upgrade-skills.js";
import { embeddedRoot } from "../src/paths.js";
import { SKILLS_STAMP } from "../src/version.js";

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
      writeFileSync(agentsPath, malformedAgents);

      await assert.rejects(
        upgradeSkills(root),
        /AGENTS\.md.*exactly one.*doc-canon:start.*doc-canon:end.*start.*before.*end/i,
      );
      assert.equal(readFileSync(agentsPath, "utf8"), malformedAgents);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
