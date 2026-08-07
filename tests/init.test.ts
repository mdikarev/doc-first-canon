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

const MANDATORY_FILES = [
  "INDEX.md",
  "OVERVIEW.md",
  "ARCHITECTURE.md",
  "GLOSSARY.md",
  "DISCREPANCIES.md",
  "CANON_CONTRACT.md",
] as const;

const TEMPLATE_FILES = [
  ...MANDATORY_FILES,
  "SECTION.md",
  "ENTITY.md",
  "MODULE.md",
  "DOMAIN_TOPIC.md",
] as const;

const SKILLS = [
  "canon-bootstrap",
  "canon-audit",
  "canon-write",
  "canon-contract",
] as const;

it("initializes a valid canon and managed assets in an empty repository", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-init-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);

    for (const file of MANDATORY_FILES) {
      assert.equal(existsSync(join(root, "docs", "canon", file)), true, file);
    }
    for (const file of TEMPLATE_FILES) {
      assert.equal(
        existsSync(join(root, "docs", "canon", "templates", file)),
        true,
        `template ${file}`,
      );
    }
    for (const skill of SKILLS) {
      assert.equal(
        existsSync(join(root, ".cursor", "skills", skill, "SKILL.md")),
        true,
        skill,
      );
    }

    assert.equal(existsSync(join(root, ".cursor", "rules", "doc-canon.mdc")), true);
    assert.match(readFileSync(join(root, "AGENTS.md"), "utf8"), /<!-- doc-canon:start -->/);
    assert.match(readFileSync(join(root, ".gitignore"), "utf8"), /^\.doc-canon\/$/m);
    assert.match(
      readFileSync(join(root, "docs", "canon", "INDEX.md"), "utf8"),
      /\| overview \| OVERVIEW\.md \| overview \| true \|/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("preserves canon prose and refreshes skills only when forced", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-reinit-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const overviewPath = join(root, "docs", "canon", "OVERVIEW.md");
    const skillPath = join(
      root,
      ".cursor",
      "skills",
      "canon-write",
      "SKILL.md",
    );
    const customOverview = `${readFileSync(overviewPath, "utf8")}\nUser prose.\n`;
    writeFileSync(overviewPath, customOverview);
    writeFileSync(skillPath, "locally customized skill\n");

    const messages: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => messages.push(args.join(" "));
    try {
      assert.equal(await initCanon(root, { yes: true }), 0);
    } finally {
      console.log = originalLog;
    }
    assert.equal(readFileSync(overviewPath, "utf8"), customOverview);
    assert.equal(readFileSync(skillPath, "utf8"), "locally customized skill\n");
    assert.match(messages.join("\n"), /canon already exists/i);

    assert.equal(await initCanon(root, { yes: true, forceSkills: true }), 0);
    assert.equal(readFileSync(overviewPath, "utf8"), customOverview);
    assert.notEqual(readFileSync(skillPath, "utf8"), "locally customized skill\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
