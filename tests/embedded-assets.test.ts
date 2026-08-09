import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { embeddedRoot } from "../src/paths.js";

const SKILLS = [
  "canon-bootstrap",
  "canon-audit",
  "canon-write",
  "canon-contract",
] as const;

function readEmbedded(...parts: string[]): string {
  const path = join(embeddedRoot(), ...parts);
  assert.equal(existsSync(path), true, `missing embedded asset: ${parts.join("/")}`);
  return readFileSync(path, "utf8");
}

describe("managed agent assets", () => {
  it("ships four canon skills with shared safety guidance", () => {
    for (const skill of SKILLS) {
      const markdown = readEmbedded("skills", skill, "SKILL.md");
      assert.match(markdown, /doc-canon validate/, skill);
      assert.match(markdown, /npm install -g doc-canon/, skill);
      assert.match(markdown, /local npx/, skill);
      assert.match(markdown, /Never modify application code/, skill);
      assert.match(markdown, /docs\/canon\//, skill);
      assert.match(markdown, /INDEX\.md/, skill);
    }
  });

  it("documents bootstrap and writing workflows", () => {
    const bootstrap = readEmbedded("skills", "canon-bootstrap", "SKILL.md");
    assert.match(bootstrap, /empty/i);
    assert.match(bootstrap, /non-empty/i);
    assert.match(bootstrap, /extract-then-freeze/i);
    assert.match(bootstrap, /import sources/i);
    assert.match(bootstrap, /doc-canon init/);

    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(write, /templates/i);
    assert.match(write, /everyday sync/i);
    assert.match(write, /validate after edits/i);
  });

  it("documents semantic audit merge and discrepancy lifecycle", () => {
    const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
    assert.match(audit, /doc-canon check/);
    assert.match(audit, /source: skill/);
    assert.match(audit, /source: cli/);
    assert.match(audit, /read-modify-write/i);
    assert.match(audit, /status: stale/);
    assert.match(audit, /structure.*consistency.*not.*DISCREPANCIES/is);
    assert.match(audit, /successful apply.*set.*decision.*move.*Open.*Resolved/is);
    assert.match(audit, /docs_stale.*same session.*validate/is);
    assert.match(audit, /code_stale.*stay Open.*later audit/is);
  });

  it("requires explicit confirmation for contract changes", () => {
    const contract = readEmbedded("skills", "canon-contract", "SKILL.md");
    assert.match(contract, /intended diff/i);
    assert.match(contract, /explicit user confirmation/i);
    assert.match(contract, /contract.*templates/is);
    assert.match(contract, /never change other repositories' defaults/i);
  });

  it("ships an always-on Cursor pointer rule", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /alwaysApply:\s*true/);
    assert.match(rule, /context source of truth/i);
    assert.match(rule, /start.*INDEX\.md/i);
    assert.match(rule, /architectural or behavioral changes/i);
    assert.match(rule, /do not silently pick a side/i);
    assert.match(rule, /does not replace other domain rules/i);
  });

  it("ships the delimited AGENTS managed block", () => {
    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /<!-- doc-canon:start -->/);
    assert.match(block, /<!-- doc-canon:end -->/);
    assert.match(block, /docs\/canon\/INDEX\.md/);
    assert.match(block, /DISCREPANCIES\.md/);
  });

  it("documents future_plans as directional canon, not task storage", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /future_plans/i);
    assert.match(rule, /not.*(?:coding tasks|development tasks|task tracker)/i);

    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /future_plans/i);

    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(write, /future_plans/i);
    assert.match(write, /absorb/i);

    const contract = readEmbedded("skills", "canon-contract", "SKILL.md");
    assert.match(contract, /FUTURE_PLAN/);
    assert.match(contract, /future_plans\//);

    const bootstrap = readEmbedded("skills", "canon-bootstrap", "SKILL.md");
    assert.match(bootstrap, /future_plans/i);

    const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
    assert.match(audit, /future_plans/i);
    assert.match(audit, /not.*(?:behavioral SoT|current SoT)|directional/i);
  });

  it("documents every MVP skill acceptance scenario", () => {
    const scenarios = readFileSync(
      join(process.cwd(), "docs", "acceptance", "skill-scenarios.md"),
      "utf8",
    );
    for (const phrase of [
      "Bootstrap an empty project",
      "Bootstrap a non-empty project",
      "Resolve docs stale",
      "Resolve code stale",
      "Resolved on a later audit",
      "Add a new template kind",
      "Pointer rule and AGENTS block after init",
      "Check preserves skill findings",
    ]) {
      assert.match(scenarios, new RegExp(phrase, "i"));
    }
  });
});
