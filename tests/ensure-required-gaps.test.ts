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
import { parseContractMarkdown } from "../src/contract/parse.js";
import { ensureRequiredGaps } from "../src/scaffold/ensure-required-gaps.js";

it("restores a missing required section and template without touching existing prose", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-restore-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const overview = join(canon, "OVERVIEW.md");
    const overviewTemplate = join(canon, "templates", "OVERVIEW.md");
    const planted = `${readFileSync(join(canon, "ARCHITECTURE.md"), "utf8")}\nPlanted architecture.\n`;
    writeFileSync(join(canon, "ARCHITECTURE.md"), planted);
    rmSync(overview);
    rmSync(overviewTemplate);

    const contract = parseContractMarkdown(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    );
    const result = ensureRequiredGaps(root, contract);

    assert.equal(existsSync(overview), true);
    assert.equal(existsSync(overviewTemplate), true);
    assert.equal(result.createdSections.includes("OVERVIEW.md"), true);
    assert.equal(result.createdTemplates.includes("templates/OVERVIEW.md"), true);
    assert.match(readFileSync(overview, "utf8"), /## Purpose/);
    assert.equal(readFileSync(join(canon, "ARCHITECTURE.md"), "utf8"), planted);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("does not inject a default-kit section omitted from the target contract", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-no-inject-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    let markdown = readFileSync(contractPath, "utf8");
    markdown = markdown.replace(
      /\n  - id: architecture[\s\S]*?template: ARCHITECTURE\n/,
      "\n",
    );
    writeFileSync(contractPath, markdown);
    rmSync(join(canon, "ARCHITECTURE.md"), { force: true });
    writeFileSync(
      join(canon, "INDEX.md"),
      readFileSync(join(canon, "INDEX.md"), "utf8").replace(
        /\| architecture \| ARCHITECTURE\.md \| architecture \| true \|\n/,
        "",
      ),
    );

    const contract = parseContractMarkdown(readFileSync(contractPath, "utf8"));
    ensureRequiredGaps(root, contract);
    assert.equal(existsSync(join(canon, "ARCHITECTURE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("appends missing INDEX Sections rows and is idempotent", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-index-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const indexPath = join(canon, "INDEX.md");
    const extra = `${readFileSync(indexPath, "utf8")}\n<!-- planted-index -->\n`;
    writeFileSync(
      indexPath,
      extra.replace(/\| overview \| OVERVIEW\.md \| overview \| true \|\n/, ""),
    );

    const contract = parseContractMarkdown(
      readFileSync(join(canon, "CANON_CONTRACT.md"), "utf8"),
    );
    const first = ensureRequiredGaps(root, contract);
    assert.equal(first.indexChanged, true);
    assert.match(readFileSync(indexPath, "utf8"), /OVERVIEW\.md/);
    assert.match(readFileSync(indexPath, "utf8"), /planted-index/);

    const second = ensureRequiredGaps(root, contract);
    assert.equal(second.createdSections.length, 0);
    assert.equal(second.createdTemplates.length, 0);
    assert.equal(second.indexChanged, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

it("fails closed when a listed template has no embedded original", async () => {
  const root = mkdtempSync(join(tmpdir(), "doc-canon-gaps-unknown-tmpl-"));
  try {
    assert.equal(await initCanon(root, { yes: true }), 0);
    const canon = join(root, "docs", "canon");
    const contractPath = join(canon, "CANON_CONTRACT.md");
    const markdown = readFileSync(contractPath, "utf8").replace(
      "  - id: INDEX\n    path: templates/INDEX.md\n",
      "  - id: INDEX\n    path: templates/INDEX.md\n  - id: NOT_A_REAL_TEMPLATE\n    path: templates/NOT_A_REAL_TEMPLATE.md\n",
    );
    writeFileSync(contractPath, markdown);
    const contract = parseContractMarkdown(markdown);
    assert.throws(
      () => ensureRequiredGaps(root, contract),
      /NOT_A_REAL_TEMPLATE/,
    );
    assert.equal(existsSync(join(canon, "templates", "NOT_A_REAL_TEMPLATE.md")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
