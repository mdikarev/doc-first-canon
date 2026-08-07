import { SKILLS_STAMP } from "../version.js";

const SECTIONS = [
  ["index", "INDEX.md", "index", "INDEX"],
  ["overview", "OVERVIEW.md", "overview", "OVERVIEW"],
  ["architecture", "ARCHITECTURE.md", "architecture", "ARCHITECTURE"],
  ["glossary", "GLOSSARY.md", "glossary", "GLOSSARY"],
  ["discrepancies", "DISCREPANCIES.md", "discrepancies", "DISCREPANCIES"],
  ["contract", "CANON_CONTRACT.md", "contract", "CANON_CONTRACT"],
] as const;

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

export function defaultContractMarkdown(): string {
  const sections = SECTIONS.map(
    ([id, path, role, template]) => `  - id: ${id}
    path: ${path}
    role: ${role}
    required: true
    template: ${template}`,
  ).join("\n");
  const templates = TEMPLATE_IDS.map(
    (id) => `  - id: ${id}
    path: templates/${id}.md`,
  ).join("\n");

  return `# Canon Contract

## Purpose
Define the files, templates, and structural policies for this canon.

## How agents must use this file
Treat the machine contract as the source of truth for canon structure.

## Machine contract
\`\`\`yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "${SKILLS_STAMP}"
sections:
${sections}
templates:
${templates}
policies:
  max_lines: 400
  ignore: []
\`\`\`

## Change policy
Confirm contract changes with the user and run validation after editing.
`;
}
