// tests/contract.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseContractMarkdown } from "../src/contract/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const brokenYamlFixture = readFileSync(
  join(__dirname, "fixtures/broken-yaml/docs/canon/CANON_CONTRACT.md"),
  "utf8",
);

const good = `# Canon Contract
## Machine contract
\`\`\`yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - id: index
    path: INDEX.md
    role: index
    required: true
    template: INDEX
templates:
  - id: INDEX
    path: templates/INDEX.md
policies:
  max_lines: 400
  ignore: []
\`\`\`
`;

describe("parseContractMarkdown", () => {
  it("parses valid machine block", () => {
    const c = parseContractMarkdown(good);
    assert.equal(c.schema_version, 1);
    assert.equal(c.sections[0].path, "INDEX.md");
    assert.equal(c.policies.max_lines, 400);
  });

  it("fails on missing yaml fence", () => {
    assert.throws(() => parseContractMarkdown("# no yaml"), /machine block/i);
  });

  it("throws on broken yaml fixture", () => {
    assert.throws(() => parseContractMarkdown(brokenYamlFixture));
  });

  it("fails on incompatible schema_version", () => {
    const bad = good.replace("schema_version: 1", "schema_version: 99");
    assert.throws(() => parseContractMarkdown(bad), /schema_version/i);
  });

  it("defaults policies when policies omitted", () => {
    const withoutPolicies = good.replace(
      /\npolicies:[\s\S]*?\n```/,
      "\n```",
    );
    const c = parseContractMarkdown(withoutPolicies);
    assert.equal(c.policies.max_lines, 400);
    assert.deepEqual(c.policies.ignore, []);
  });

  it("throws on malformed policies", () => {
    for (const policiesYaml of [
      "policies: null",
      "policies: broken",
      "policies:\n  - item",
    ]) {
      const md = good.replace(/policies:[\s\S]*?\n```/, `${policiesYaml}\n\`\`\``);
      assert.throws(
        () => parseContractMarkdown(md),
        /policies must be an object/i,
      );
    }
  });

  it("throws on multiple yaml fences", () => {
    const twoFences = `${good}\n\`\`\`yaml\nschema_version: 1\n\`\`\`\n`;
    assert.throws(
      () => parseContractMarkdown(twoFences),
      /exactly one yaml machine block/i,
    );
  });

  it("warns on unknown top-level key and ignores it", () => {
    const withUnknown = good.replace(
      "policies:",
      "unknown_field: foo\npolicies:",
    );
    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      const c = parseContractMarkdown(withUnknown);
      assert.equal(c.schema_version, 1);
      assert.match(
        warnings.join("\n"),
        /Unknown contract key "unknown_field" ignored/,
      );
    } finally {
      console.warn = originalWarn;
    }
  });
});
