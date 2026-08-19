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
import { migrateCanon } from "../src/commands/migrate.js";
import { upgradeSkills } from "../src/commands/upgrade-skills.js";
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

it("rejects a missing contract before writing files", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-missing-"));
  try {
    await assert.rejects(migrateCanon(root), /CANON_CONTRACT\.md.*does not exist/i);
    assert.equal(existsSync(join(root, ".cursor", "skills")), false);
    assert.equal(existsSync(join(root, "docs", "canon")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("rejects unsupported schema_version before any writes", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-schema-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const contractPath = join(root, "docs", "canon", "CANON_CONTRACT.md");
    const overviewPath = join(root, "docs", "canon", "OVERVIEW.md");
    const beforeContract = readFileSync(contractPath, "utf8");
    writeFileSync(
      contractPath,
      beforeContract.replace("schema_version: 1", "schema_version: 99"),
    );
    rmSync(overviewPath);

    await assert.rejects(migrateCanon(root), /schema_version 99/i);
    assert.equal(existsSync(overviewPath), false);
    assert.equal(
      readFileSync(contractPath, "utf8"),
      beforeContract.replace("schema_version: 1", "schema_version: 99"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("restores missing required files then upgrade-skills, and is content-idempotent on canon docs", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-restore-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const overview = join(canon, "OVERVIEW.md");
    const architecture = join(canon, "ARCHITECTURE.md");
    const planted = `${readFileSync(architecture, "utf8")}\nPlanted.\n`;
    writeFileSync(architecture, planted);
    rmSync(overview);

    assert.equal(await migrateCanon(root), 0);
    assert.equal(existsSync(overview), true);
    assert.equal(readFileSync(architecture, "utf8"), planted);
    for (const skillRoot of [".cursor", ".claude", ".dsh"] as const) {
      assert.equal(
        existsSync(join(root, skillRoot, "skills", "canon-write", "SKILL.md")),
        true,
        skillRoot,
      );
    }

    const snapshot = {
      overview: readFileSync(overview, "utf8"),
      architecture: readFileSync(architecture, "utf8"),
      index: readFileSync(join(canon, "INDEX.md"), "utf8"),
      contract: readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    };
    assert.equal(await migrateCanon(root), 0);
    assert.equal(readFileSync(overview, "utf8"), snapshot.overview);
    assert.equal(readFileSync(architecture, "utf8"), snapshot.architecture);
    assert.equal(readFileSync(join(canon, "INDEX.md"), "utf8"), snapshot.index);
    assert.equal(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
      snapshot.contract,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not add omitted default-kit sections", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-no-kit-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    writeFileSync(
      contractPath,
      readFileSync(contractPath, "utf8").replace(
        /\n  - id: architecture[\s\S]*?template: ARCHITECTURE\n/,
        "\n",
      ),
    );
    writeFileSync(
      join(canon, "INDEX.md"),
      readFileSync(join(canon, "INDEX.md"), "utf8").replace(
        /\| architecture \| ARCHITECTURE\.md \| architecture \| true \|\n/,
        "",
      ),
    );
    rmSync(join(canon, "ARCHITECTURE.md"), { force: true });

    assert.equal(await migrateCanon(root), 0);
    assert.equal(existsSync(join(canon, "ARCHITECTURE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("still allows upgrade-skills to run alone", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-upgrade-alone-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    assert.equal(await upgradeSkills(root), 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("prints migrate failures without a stack trace", () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-migrate-cli-"));
  try {
    const result = spawnSync(
      "npx",
      ["tsx", "src/cli.ts", "migrate", "--root", root],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /error:.*CANON_CONTRACT\.md.*does not exist/i);
    assert.doesNotMatch(result.stderr, /\n\s+at /);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
