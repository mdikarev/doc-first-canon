import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseGlossary, expandGlossaryQuery } from "../src/search/glossary.js";

describe("parseGlossary", () => {
  it("extracts terms under ## Terms with body synonyms", () => {
    const text = `# Glossary
## How to use
note
## Terms
### SoT
source of truth
### Pack
A bounded retrieval result.
## Naming conventions
stop`;
    const entries = parseGlossary(text);
    assert.deepEqual([...entries.keys()].sort(), ["Pack", "SoT"].sort());
    const sot = entries.get("SoT")!;
    assert.ok(sot.tokens.includes("sot"));
    assert.ok(sot.tokens.includes("source"));
    assert.ok(sot.tokens.includes("truth"));
  });

  it("stops term collection after leaving ## Terms", () => {
    const text = `## Terms
### T1
body
## Other
### T2
ignored`;
    const entries = parseGlossary(text);
    assert.ok(entries.has("T1"));
    assert.ok(!entries.has("T2"));
  });

  it("supports multi-word terms", () => {
    const text = `## Terms
### searchCanon / search
The public search function.`;
    const entries = parseGlossary(text);
    const entry = entries.get("searchCanon / search")!;
    assert.ok(entry.tokens.includes("search"));
    assert.ok(entry.tokens.includes("searchcanon"));
  });
});

describe("expandGlossaryQuery", () => {
  const glossary = parseGlossary(`## Terms
### SoT
source of truth
`);

  it("appends canonical term tokens for a matching synonym", () => {
    assert.match(expandGlossaryQuery("sot", glossary), /source/);
    assert.match(expandGlossaryQuery("sot", glossary), /truth/);
    assert.match(expandGlossaryQuery("sot", glossary), /sot/);
  });

  it("returns the query unchanged when nothing matches", () => {
    assert.equal(expandGlossaryQuery("zzz", glossary), "zzz");
  });

  it("returns the query unchanged for a null glossary", () => {
    assert.equal(expandGlossaryQuery("sot", null), "sot");
  });
});
