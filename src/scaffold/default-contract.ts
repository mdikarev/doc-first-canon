import { SKILLS_STAMP } from "../version.js";

const SECTIONS = [
  ["index", "INDEX.md", "index", "INDEX"],
  ["overview", "OVERVIEW.md", "overview", "OVERVIEW"],
  ["architecture", "ARCHITECTURE.md", "architecture", "ARCHITECTURE"],
  ["glossary", "GLOSSARY.md", "glossary", "GLOSSARY"],
  ["discrepancies", "DISCREPANCIES.md", "discrepancies", "DISCREPANCIES"],
  ["contract", "CANON_CONTRACT.md", "contract", "CANON_CONTRACT"],
  ["future-plans-index", "future_plans/INDEX.md", "section", "FUTURE_PLANS_INDEX"],
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
  "FUTURE_PLANS_INDEX",
  "FUTURE_PLAN",
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

## Naming conventions
- Canon files use UPPERCASE names (e.g. \`INDEX.md\`, \`OVERVIEW.md\`) in the canon root and in every subdirectory (\`templates/\`, ...).
- Exception: \`future_plans/\` initiative files use lowercase kebab-case with a \`pN\` prefix (e.g. \`p0-skill-context-efficiency.md\`); \`future_plans/INDEX.md\` stays UPPERCASE.
- Directory names are lowercase (e.g. \`future_plans/\`).
- Prose lives in \`.md\` files; data/config files may use other extensions (\`.json\`, \`.yaml\`).
- Names use ASCII, digits, \`-\`/\`_\`; no spaces, no dot beyond the final extension.
- These rules are descriptive guidance; \`validate\` does not enforce them yet.

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
  max_line_length: 500
  ignore: []
\`\`\`

## Change policy
Confirm contract changes with the user and run validation after editing.
`;
}
