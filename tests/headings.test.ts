import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  extractMarkdownHeadings,
  requiredHeadingsFromTemplate,
  assertRequiredHeadings,
} from "../src/validate/headings.js";

describe("headings", () => {
  it("detects missing required H2", () => {
    const template = `# Overview\n## Purpose\n## Scope\n`;
    const doc = `# Overview\n## Purpose\n`;
    const req = requiredHeadingsFromTemplate(template);
    const missing = assertRequiredHeadings(doc, req);
    assert.deepEqual(missing, ["Scope"]);
  });

  it("allows extra headings", () => {
    const template = `# Overview\n## Purpose\n`;
    const doc = `# Overview\n## Purpose\n## Extra\n`;
    const missing = assertRequiredHeadings(doc, requiredHeadingsFromTemplate(template));
    assert.deepEqual(missing, []);
  });

  it("requires H3 headings present in template", () => {
    const template = `# Overview\n## Scope\n### In scope\n### Out of scope\n`;
    const doc = `# Overview\n## Scope\n### In scope\n`;
    const missing = assertRequiredHeadings(doc, requiredHeadingsFromTemplate(template));
    assert.deepEqual(missing, ["Out of scope"]);
  });

  it("extractMarkdownHeadings returns level and text", () => {
    const md = `# Title\n\n## Section\n\n### Sub\n`;
    assert.deepEqual(extractMarkdownHeadings(md), [
      { level: 1, text: "Title" },
      { level: 2, text: "Section" },
      { level: 3, text: "Sub" },
    ]);
  });

  it("strips optional closing ATX hash markers from heading text", () => {
    const md = `# Overview #\n## Scope ##\n### In scope ###\n`;
    assert.deepEqual(extractMarkdownHeadings(md), [
      { level: 1, text: "Overview" },
      { level: 2, text: "Scope" },
      { level: 3, text: "In scope" },
    ]);
  });

  it("matches required headings when doc and template differ in closing ATX markers", () => {
    const template = `# Overview\n## Scope ##\n`;
    const doc = `# Overview\n## Scope\n`;
    const missing = assertRequiredHeadings(doc, requiredHeadingsFromTemplate(template));
    assert.deepEqual(missing, []);
  });
});
