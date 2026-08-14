import fs from "node:fs";
import path from "node:path";
import type { Contract, SectionDef } from "../contract/types.js";
import { canonDir, embeddedRoot } from "../paths.js";
import { sectionPathsFromIndex } from "../validate/index-agreement.js";

export type EnsureRequiredGapsResult = {
  createdTemplates: string[];
  createdSections: string[];
  indexChanged: boolean;
};

const SECTIONS_HEADING_RE = /^##\s+Sections\s*$(.*?)(?=^##\s|(?![\s\S]))/ims;

function sectionsTableMarkdown(sections: SectionDef[]): string {
  return `| id | path | role | required |
| --- | --- | --- | --- |
${sections
  .map(
    (section) =>
      `| ${section.id} | ${section.path} | ${section.role} | ${section.required} |`,
  )
  .join("\n")}`;
}

function embeddedTemplatePath(templateId: string): string {
  return path.join(embeddedRoot(), "templates", `${templateId}.md`);
}

function restoreMissingTemplates(
  root: string,
  contract: Contract,
): string[] {
  const canonRoot = canonDir(root);
  const created: string[] = [];
  for (const template of contract.templates) {
    const dest = path.join(canonRoot, template.path);
    if (fs.existsSync(dest)) continue;
    const source = embeddedTemplatePath(template.id);
    if (!fs.existsSync(source)) {
      throw new Error(
        `Template ${template.id} is missing at ${template.path} and has no embedded original`,
      );
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
    created.push(template.path);
  }
  return created;
}

function copySectionFromTemplate(
  canonRoot: string,
  section: SectionDef,
  contract: Contract,
): void {
  const template = contract.templates.find((item) => item.id === section.template);
  if (!template) {
    throw new Error(
      `Section ${section.path} references unknown template ${section.template}`,
    );
  }
  const templateFile = path.join(canonRoot, template.path);
  if (!fs.existsSync(templateFile)) {
    throw new Error(`Template ${section.template} does not exist at ${template.path}`);
  }
  const dest = path.join(canonRoot, section.path);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(templateFile, dest);
}

function fillIndexFromTemplate(
  canonRoot: string,
  contract: Contract,
): void {
  const indexPath = path.join(canonRoot, "INDEX.md");
  let markdown = fs.readFileSync(indexPath, "utf8");
  if (markdown.includes("<!-- sections table -->")) {
    markdown = markdown.replace(
      "<!-- sections table -->",
      sectionsTableMarkdown(contract.sections),
    );
    fs.writeFileSync(indexPath, markdown);
    return;
  }
  appendMissingIndexRows(indexPath, contract);
}

function appendMissingIndexRows(indexPath: string, contract: Contract): boolean {
  if (!fs.existsSync(indexPath)) return false;
  const markdown = fs.readFileSync(indexPath, "utf8");
  const indexed = new Set(sectionPathsFromIndex(markdown));
  const missing = contract.sections.filter((section) => !indexed.has(section.path));
  if (missing.length === 0) return false;

  if (markdown.includes("<!-- sections table -->")) {
    fs.writeFileSync(
      indexPath,
      markdown.replace(
        "<!-- sections table -->",
        sectionsTableMarkdown(contract.sections),
      ),
    );
    return true;
  }

  const sectionsMatch = SECTIONS_HEADING_RE.exec(markdown);
  if (!sectionsMatch) {
    throw new Error("INDEX.md does not contain a Sections table to append to");
  }
  const body = sectionsMatch[1]!;
  const bodyLines = body.split("\n");
  let lastTableRowIndex = -1;
  for (let i = 0; i < bodyLines.length; i += 1) {
    if (bodyLines[i]!.trim().startsWith("|")) lastTableRowIndex = i;
  }
  if (lastTableRowIndex === -1) {
    throw new Error("INDEX.md Sections heading has no table to append to");
  }
  const rows = missing.map(
    (section) =>
      `| ${section.id} | ${section.path} | ${section.role} | ${section.required} |`,
  );
  bodyLines.splice(lastTableRowIndex + 1, 0, ...rows);
  const updatedBody = bodyLines.join("\n");
  const updatedMarkdown =
    markdown.slice(0, sectionsMatch.index) +
    sectionsMatch[0].replace(body, () => updatedBody) +
    markdown.slice(sectionsMatch.index + sectionsMatch[0].length);
  fs.writeFileSync(indexPath, updatedMarkdown);
  return true;
}

export function ensureRequiredGaps(
  root: string,
  contract: Contract,
): EnsureRequiredGapsResult {
  const canonRoot = canonDir(root);
  const createdTemplates = restoreMissingTemplates(root, contract);
  const createdSections: string[] = [];

  const indexSection = contract.sections.find(
    (section) => section.path === "INDEX.md" && section.required,
  );
  const indexPath = path.join(canonRoot, "INDEX.md");
  if (indexSection && !fs.existsSync(indexPath)) {
    copySectionFromTemplate(canonRoot, indexSection, contract);
    fillIndexFromTemplate(canonRoot, contract);
    createdSections.push("INDEX.md");
  }

  for (const section of contract.sections) {
    if (!section.required) continue;
    if (section.path === "CANON_CONTRACT.md" || section.path === "INDEX.md") {
      continue;
    }
    const dest = path.join(canonRoot, section.path);
    if (fs.existsSync(dest)) continue;
    copySectionFromTemplate(canonRoot, section, contract);
    createdSections.push(section.path);
  }

  const indexChanged =
    createdSections.includes("INDEX.md") ||
    appendMissingIndexRows(indexPath, contract);

  return { createdTemplates, createdSections, indexChanged };
}
