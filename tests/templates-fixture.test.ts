import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { parseContractMarkdown } from "../src/contract/parse.js";
import { defaultContractMarkdown } from "../src/scaffold/default-contract.js";
import { embeddedRoot } from "../src/paths.js";
import { requiredHeadingsFromTemplate } from "../src/validate/headings.js";
import { validateCanon } from "../src/validate/validate.js";
import { SKILLS_STAMP } from "../src/version.js";

const TEMPLATE_IDS = [
  "INDEX",
  "OVERVIEW",
  "ARCHITECTURE",
  "GLOSSARY",
  "DISCREPANCIES",
  "CANON_CONTRACT",
  "SECTION",
  "ENTITY",
  "MODULE",
  "DOMAIN_TOPIC",
] as const;

const TEMPLATE_HEADINGS: Record<(typeof TEMPLATE_IDS)[number], string[]> = {
  INDEX: ["Canon Index", "How to use this canon", "Reading order", "Sections", "Discrepancies"],
  OVERVIEW: ["Overview", "Purpose", "Problem & context", "Primary users / agents", "Scope", "In scope", "Out of scope", "Success signals", "Related canon"],
  ARCHITECTURE: ["Architecture", "Summary", "System context", "Building blocks", "Key flows", "Boundaries & non-responsibilities", "Tech & constraints", "Related canon"],
  GLOSSARY: ["Glossary", "How to use", "Terms", "Naming conventions", "Related canon"],
  DISCREPANCIES: ["Discrepancies", "How to use", "Open", "Resolved", "Template for new entries"],
  CANON_CONTRACT: ["Canon Contract", "Purpose", "How agents must use this file", "Machine contract", "Change policy"],
  SECTION: ["Purpose", "Scope", "Current state", "Rules & invariants", "Key details", "Open questions", "Related canon"],
  ENTITY: ["Purpose", "Scope", "Current state", "Identity & fields", "Lifecycle", "Invariants", "Relations", "Open questions", "Related canon"],
  MODULE: ["Purpose", "Scope", "Current state", "Responsibilities", "Interfaces", "Dependencies", "Invariants", "Open questions", "Related canon"],
  DOMAIN_TOPIC: ["Purpose", "Scope", "Current state", "Concepts", "Rules & invariants", "Key details", "Open questions", "Related canon"],
};

const MANDATORY_SECTIONS = [
  ["index", "INDEX.md", "index"],
  ["overview", "OVERVIEW.md", "overview"],
  ["architecture", "ARCHITECTURE.md", "architecture"],
  ["glossary", "GLOSSARY.md", "glossary"],
  ["discrepancies", "DISCREPANCIES.md", "discrepancies"],
  ["contract", "CANON_CONTRACT.md", "contract"],
] as const;

describe("embedded default canon", () => {
  it("ships every default template with required headings", () => {
    for (const id of TEMPLATE_IDS) {
      const markdown = readFileSync(
        join(embeddedRoot(), "templates", `${id}.md`),
        "utf8",
      );
      assert.deepEqual(requiredHeadingsFromTemplate(markdown), TEMPLATE_HEADINGS[id], id);
    }
  });

  it("generates a schema-valid default contract", () => {
    const contract = parseContractMarkdown(defaultContractMarkdown());

    assert.equal(contract.schema_version, 1);
    assert.equal(contract.cli_compat, ">=0.1.0");
    assert.equal(contract.skills_stamp, SKILLS_STAMP);
    assert.deepEqual(
      contract.sections.map(({ id, path, role }) => [id, path, role]),
      MANDATORY_SECTIONS,
    );
    assert.deepEqual(
      contract.templates.map(({ id, path }) => [id, path]),
      TEMPLATE_IDS.map((id) => [id, `templates/${id}.md`]),
    );
  });

  it("provides enough defaults to scaffold a valid canon", () => {
    const root = mkdtempSync(join(tmpdir(), "doc-canon-embedded-"));
    const canonRoot = join(root, "docs", "canon");
    const templateRoot = join(canonRoot, "templates");
    try {
      mkdirSync(templateRoot, { recursive: true });
      for (const id of TEMPLATE_IDS) {
        cpSync(
          join(embeddedRoot(), "templates", `${id}.md`),
          join(templateRoot, `${id}.md`),
        );
      }
      for (const [, sectionPath] of MANDATORY_SECTIONS) {
        if (sectionPath === "CANON_CONTRACT.md") continue;
        cpSync(
          join(templateRoot, sectionPath),
          join(canonRoot, sectionPath),
        );
      }
      writeFileSync(
        join(canonRoot, "INDEX.md"),
        readFileSync(join(templateRoot, "INDEX.md"), "utf8").replace(
          "<!-- sections table -->",
          `| id | path | role | required |
| --- | --- | --- | --- |
${MANDATORY_SECTIONS.map(
  ([id, sectionPath, role]) =>
    `| ${id} | ${sectionPath} | ${role} | true |`,
).join("\n")}`,
        ),
      );
      writeFileSync(
        join(canonRoot, "CANON_CONTRACT.md"),
        defaultContractMarkdown(),
      );

      assert.deepEqual(validateCanon(root), {
        ok: true,
        errors: [],
        warnings: [],
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
