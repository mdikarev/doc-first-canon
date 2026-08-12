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
  "canon-future-plan",
] as const;

function readEmbedded(...parts: string[]): string {
  const path = join(embeddedRoot(), ...parts);
  assert.equal(existsSync(path), true, `missing embedded asset: ${parts.join("/")}`);
  return readFileSync(path, "utf8");
}

describe("managed agent assets", () => {
  it("ships five canon skills with shared safety guidance", () => {
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

  it("documents canon-write clarify-before-invent protocol", () => {
    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(write, /Clarify before substantial writes/i);
    assert.match(write, /substantial/i);
    assert.match(write, /skip/i);
    assert.match(write, /one (?:question )?at a time|one at a time/i);
    assert.match(write, /recommend/i);
    assert.match(write, /A\/B\/C|multiple-choice|options/i);
    assert.match(write, /three|at most 3|cap of 3|up to 3/i);
    assert.match(write, /do not invent|without inventing|not invent/i);
  });

  it("documents Scout Expand Execute recipe in write and audit skills", () => {
    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(write, /Scout/i);
    assert.match(write, /Expand/i);
    assert.match(write, /working set/i);
    assert.match(write, /sufficient|need more/i);
    assert.match(write, /after Expand|after.*Expand|following Expand/i);
    assert.match(write, /clarif/i);
    assert.match(write, /doc-canon search/i);
    assert.match(write, /index_stale/i);
    assert.match(write, /one-shot.*doc-canon index|doc-canon index.*one-shot/i);

    const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
    assert.match(audit, /Scout/i);
    assert.match(audit, /Expand/i);
    assert.match(audit, /working set/i);
    assert.match(audit, /sufficient|need more/i);
    assert.match(audit, /show|briefly|in chat/i);
    assert.match(audit, /doc-canon search/i);
    assert.match(audit, /index_stale/i);
  });

  it("documents search-first retrieval in pointer rule and AGENTS block", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /doc-canon search/i);
    assert.match(rule, /fail-closed|fail closed/i);

    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /doc-canon search/i);
  });

  it("documents working-set discipline in pointer rule and AGENTS block", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /working set/i);
    assert.match(rule, /expand/i);
    assert.match(rule, /INDEX\.md/);

    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /working set/i);
    assert.match(block, /expand/i);
  });

  it("documents canon-first feature-change order in pointer, AGENTS, and canon-write", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /canon-write/i);
    assert.match(rule, /feature|behavior|functional/i);
    assert.match(
      rule,
      /canon.*(?:first|before).*code|before.*(?:application )?code|then.*code/i,
    );
    assert.match(rule, /optional.*(?:spec|plan)|spec\/plan|design\/plan/i);
    assert.match(rule, /code_stale/i);
    assert.match(rule, /substantial/i);
    assert.match(
      rule,
      /(?:do not|never|must not).*(?:edit|modify).*docs\/canon|invoke.*canon-write|through.*canon-write/i,
    );

    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /canon-write/i);
    assert.match(
      block,
      /canon.*(?:first|before).*code|before.*(?:application )?code|then.*code/i,
    );

    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(
      write,
      /before.*(?:feature |application )?code|coding agents.*(?:invoke|call)|feature change/i,
    );
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
    assert.match(audit, /doc-canon report/);
    assert.match(audit, /kind.*paths|normalized.*kind/i);
    assert.match(audit, /cannot confirm|not reproduce|unreproduced|no match/i);
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
    assert.match(rule, /doc-canon search|INDEX\.md/i);
    assert.match(rule, /Feature-change order|canon-first|canon-write/i);
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

  it("documents canon-future-plan ownership and write handoff", () => {
    const future = readEmbedded("skills", "canon-future-plan", "SKILL.md");
    assert.match(future, /future_plans/i);
    assert.match(future, /FUTURE_PLAN/);
    assert.match(future, /INDEX\.md/);
    assert.match(future, /Scout/i);
    assert.match(future, /draft|refining|absorbed/i);
    assert.match(future, /checklist|task tracker|coding-agent prompt/i);

    const write = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(write, /canon-future-plan/);
    assert.match(write, /handoff|stop|invoke/i);

    const contract = readEmbedded("skills", "canon-contract", "SKILL.md");
    assert.match(contract, /canon-future-plan/);
    assert.doesNotMatch(
      contract,
      /register `?future_plans\/<slug>\.md`? with `?required: false`?/,
    );
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
      "Canon-write clarifies before substantial writes",
      "Check preserves skill findings",
      "Canon-write Scout Expand Execute before deep reads",
      "Canon-audit Scout Expand Execute before deep reads",
      "Scout uses search then Expand",
      "Search missing index falls back",
      "Post-write runs index",
      "Feature-change order is canon-first",
      "Future plans authoring uses canon-future-plan",
    ]) {
      assert.match(scenarios, new RegExp(phrase, "i"));
    }
  });
});
