// tests/contract.test.ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseContractMarkdown } from "../src/contract/parse.js";

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

  it("fails on incompatible schema_version", () => {
    const bad = good.replace("schema_version: 1", "schema_version: 99");
    assert.throws(() => parseContractMarkdown(bad), /schema_version/i);
  });
});
