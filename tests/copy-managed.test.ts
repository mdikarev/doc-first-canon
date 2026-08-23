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
import { describe, it } from "node:test";
import {
  assertManagedMarkersWellFormed,
  copyManagedAssets,
  stripYamlFrontmatter,
} from "../src/scaffold/copy-managed.js";
import { embeddedRoot } from "../src/paths.js";

describe("stripYamlFrontmatter", () => {
  it("removes leading YAML frontmatter and keeps the markdown body", () => {
    const source = `---
description: Use the project canon as agent context
alwaysApply: true
---

# doc-canon context rule

Body line.
`;
    assert.equal(
      stripYamlFrontmatter(source),
      "# doc-canon context rule\n\nBody line.\n",
    );
  });

  it("throws when frontmatter is missing", () => {
    assert.throws(
      () => stripYamlFrontmatter("# no frontmatter\n"),
      /frontmatter/i,
    );
  });
});

describe("assertManagedMarkersWellFormed", () => {
  it("names the file in the error", () => {
    assert.throws(
      () =>
        assertManagedMarkersWellFormed(
          "<!-- doc-canon:start -->\nonly start\n",
          "CLAUDE.md",
        ),
      /CLAUDE\.md.*exactly one.*doc-canon:start.*doc-canon:end/i,
    );
  });
});

describe("copyManagedAssets", () => {
  it("writes skills to every harness and upserts short AGENTS + full-body CLAUDE", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-copy-managed-"));
    try {
      copyManagedAssets(root);

      const embeddedSkill = readFileSync(
        join(embeddedRoot(), "skills", "canon-write", "SKILL.md"),
        "utf8",
      );
      for (const skillRoot of [
        ".cursor",
        ".claude",
        ".dsh",
      ] as const) {
        assert.equal(
          readFileSync(
            join(root, skillRoot, "skills", "canon-write", "SKILL.md"),
            "utf8",
          ),
          embeddedSkill,
        );
      }

      const rule = readFileSync(
        join(embeddedRoot(), "rules", "doc-canon.mdc"),
        "utf8",
      );
      assert.equal(
        readFileSync(join(root, ".cursor", "rules", "doc-canon.mdc"), "utf8"),
        rule,
      );

      const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
      assert.match(agents, /<!-- doc-canon:start -->/);
      assert.match(agents, /For design and development, treat `docs\/canon\/`/);
      assert.match(agents, /doc-canon scout \"<topic>\"/);
      assert.doesNotMatch(agents, /Search first — it is mandatory/);

      const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
      assert.match(claude, /<!-- doc-canon:start -->/);
      assert.match(claude, /# doc-canon context rule/);
      assert.match(claude, /Feature-change order \(canon-first\)/);
      assert.match(claude, /doc-canon scout \"<topic>\"/);
      assert.match(claude, /## Code analysis order/);
      assert.doesNotMatch(claude, /## Search-first is mandatory/);
      assert.doesNotMatch(claude, /^---$/m);
      assert.doesNotMatch(claude, /alwaysApply/);

      const body = stripYamlFrontmatter(rule).trim();
      assert.match(
        claude,
        new RegExp(body.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes only the selected harness skill trees and keeps the blocks", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-copy-selected-"));
    try {
      copyManagedAssets(root, ["dsh"]);

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
      assert.equal(existsSync(join(root, ".cursor", "skills")), false);
      assert.equal(existsSync(join(root, ".claude", "skills")), false);
      assert.equal(existsSync(join(root, ".cursor", "rules")), false);

      const agents = readFileSync(join(root, "AGENTS.md"), "utf8");
      assert.match(agents, /<!-- doc-canon:start -->/);
      const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
      assert.match(claude, /<!-- doc-canon:start -->/);
      assert.match(claude, /# doc-canon context rule/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("writes the Cursor pointer rule only when cursor is selected", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-copy-cursor-"));
    try {
      copyManagedAssets(root, ["cursor"]);
      assert.equal(
        existsSync(join(root, ".cursor", "skills", "canon-write", "SKILL.md")),
        true,
      );
      assert.equal(
        existsSync(join(root, ".cursor", "rules", "doc-canon.mdc")),
        true,
      );
      assert.equal(existsSync(join(root, ".claude", "skills")), false);
      assert.equal(existsSync(join(root, ".dsh", "skills")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves CLAUDE.md prose outside markers on re-upsert", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-claude-upsert-"));
    try {
      writeFileSync(
        join(root, "CLAUDE.md"),
        `User preface.\n\n<!-- doc-canon:start -->\nstale\n<!-- doc-canon:end -->\n\nUser epilogue.\n`,
      );
      copyManagedAssets(root);
      const claude = readFileSync(join(root, "CLAUDE.md"), "utf8");
      assert.match(claude, /^User preface\./);
      assert.match(claude, /User epilogue\./);
      assert.match(claude, /# doc-canon context rule/);
      assert.doesNotMatch(claude, /\nstale\n/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
