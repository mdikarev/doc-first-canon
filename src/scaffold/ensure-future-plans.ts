import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";
import { extractYamlBlock } from "../contract/parse.js";
import { canonDir, embeddedRoot } from "../paths.js";
import { sectionPathsFromIndex } from "../validate/index-agreement.js";

export type EnsureFuturePlansResult = {
  contractMarkdown: string;
  createdIndex: boolean;
  createdTemplates: string[];
  contractChanged: boolean;
  indexTableChanged: boolean;
};

const FUTURE_PLANS_INDEX_PATH = "future_plans/INDEX.md";
const FUTURE_PLANS_INDEX_SECTION_ID = "future-plans-index";

const FUTURE_TEMPLATES = [
  { id: "FUTURE_PLANS_INDEX", path: "templates/FUTURE_PLANS_INDEX.md" },
  { id: "FUTURE_PLAN", path: "templates/FUTURE_PLAN.md" },
] as const;

function ensureFutureTemplates(root: string): string[] {
  const canonRoot = canonDir(root);
  const templatesDir = path.join(canonRoot, "templates");
  const embeddedTemplatesDir = path.join(embeddedRoot(), "templates");
  const created: string[] = [];

  for (const template of FUTURE_TEMPLATES) {
    const dest = path.join(canonRoot, template.path);
    if (fs.existsSync(dest)) continue;
    fs.mkdirSync(templatesDir, { recursive: true });
    fs.copyFileSync(
      path.join(embeddedTemplatesDir, `${template.id}.md`),
      dest,
    );
    created.push(template.path);
  }

  return created;
}

function ensureContractYaml(contractMarkdown: string): {
  markdown: string;
  changed: boolean;
} {
  const yamlText = extractYamlBlock(contractMarkdown);
  const contract = YAML.parse(yamlText) as {
    sections: Array<{
      id: string;
      path: string;
      role: string;
      required: boolean;
      template: string;
    }>;
    templates: Array<{ id: string; path: string }>;
    [key: string]: unknown;
  };

  let changed = false;

  for (const template of FUTURE_TEMPLATES) {
    const exists = contract.templates.some((t) => t.id === template.id);
    if (!exists) {
      contract.templates.push({ id: template.id, path: template.path });
      changed = true;
    }
  }

  const existingSection = contract.sections.find(
    (section) => section.path === FUTURE_PLANS_INDEX_PATH,
  );
  if (!existingSection) {
    contract.sections.push({
      id: FUTURE_PLANS_INDEX_SECTION_ID,
      path: FUTURE_PLANS_INDEX_PATH,
      role: "section",
      required: true,
      template: "FUTURE_PLANS_INDEX",
    });
    changed = true;
  } else if (!existingSection.required) {
    existingSection.required = true;
    changed = true;
  }

  const beforeLen = contract.sections.length;
  contract.sections = contract.sections.filter(
    (section) =>
      !(
        section.path.startsWith("future_plans/") &&
        section.path !== FUTURE_PLANS_INDEX_PATH
      ),
  );
  if (contract.sections.length !== beforeLen) changed = true;

  if (!changed) {
    return { markdown: contractMarkdown, changed: false };
  }

  const updatedYaml = YAML.stringify(contract);
  return {
    markdown: contractMarkdown.replace(yamlText, () => updatedYaml),
    changed: true,
  };
}

function ensureFuturePlansIndexFile(root: string): boolean {
  const canonRoot = canonDir(root);
  const indexPath = path.join(canonRoot, FUTURE_PLANS_INDEX_PATH);
  if (fs.existsSync(indexPath)) return false;

  const templatePath = path.join(
    canonRoot,
    "templates",
    "FUTURE_PLANS_INDEX.md",
  );
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  fs.copyFileSync(templatePath, indexPath);
  return true;
}

const SECTIONS_HEADING_RE = /^##\s+Sections\s*$(.*?)(?=^##\s|(?![\s\S]))/ims;

function tableCellPath(cell: string): string | undefined {
  const value = cell.trim().replace(/^`|`$/g, "");
  const link = /\[[^\]]*]\(([^)]+)\)/.exec(value);
  const candidate = (link?.[1] ?? value).split("#", 1)[0]?.trim();
  return candidate?.endsWith(".md") ? candidate : undefined;
}

function stripInitiativeRowsFromRootIndex(root: string): boolean {
  const indexPath = path.join(canonDir(root), "INDEX.md");
  if (!fs.existsSync(indexPath)) return false;

  const markdown = fs.readFileSync(indexPath, "utf8");
  const sectionsMatch = SECTIONS_HEADING_RE.exec(markdown);
  if (!sectionsMatch) return false;

  const body = sectionsMatch[1]!;
  const bodyLines = body.split("\n");
  let changed = false;
  const filteredLines: string[] = [];

  for (const line of bodyLines) {
    if (!line.trim().startsWith("|")) {
      filteredLines.push(line);
      continue;
    }
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 2 || /^[-:\s]+$/.test(cells[1] ?? "")) {
      filteredLines.push(line);
      continue;
    }
    const cellPath = tableCellPath(cells[1] ?? "");
    if (
      cellPath &&
      cellPath.startsWith("future_plans/") &&
      cellPath !== FUTURE_PLANS_INDEX_PATH
    ) {
      changed = true;
      continue;
    }
    filteredLines.push(line);
  }

  if (!changed) return false;

  const updatedBody = filteredLines.join("\n");
  const updatedMarkdown =
    markdown.slice(0, sectionsMatch.index) +
    sectionsMatch[0].replace(body, () => updatedBody) +
    markdown.slice(sectionsMatch.index + sectionsMatch[0].length);

  fs.writeFileSync(indexPath, updatedMarkdown);
  return true;
}

function ensureIndexTableRow(root: string): boolean {
  const indexPath = path.join(canonDir(root), "INDEX.md");
  if (!fs.existsSync(indexPath)) return false;

  const markdown = fs.readFileSync(indexPath, "utf8");
  if (sectionPathsFromIndex(markdown).includes(FUTURE_PLANS_INDEX_PATH)) {
    return false;
  }

  const sectionsMatch = SECTIONS_HEADING_RE.exec(markdown);
  if (!sectionsMatch) {
    throw new Error("INDEX.md does not contain a Sections table to append to");
  }

  const row = `| ${FUTURE_PLANS_INDEX_SECTION_ID} | ${FUTURE_PLANS_INDEX_PATH} | section | true |`;
  const body = sectionsMatch[1]!;
  const bodyLines = body.split("\n");

  let lastTableRowIndex = -1;
  for (let i = 0; i < bodyLines.length; i += 1) {
    if (bodyLines[i]!.trim().startsWith("|")) lastTableRowIndex = i;
  }
  if (lastTableRowIndex === -1) {
    throw new Error("INDEX.md Sections heading has no table to append to");
  }

  bodyLines.splice(lastTableRowIndex + 1, 0, row);
  const updatedBody = bodyLines.join("\n");
  const updatedMarkdown =
    markdown.slice(0, sectionsMatch.index) +
    sectionsMatch[0].replace(body, () => updatedBody) +
    markdown.slice(sectionsMatch.index + sectionsMatch[0].length);

  fs.writeFileSync(indexPath, updatedMarkdown);
  return true;
}

export function ensureFuturePlansSkeleton(
  root: string,
  contractMarkdown: string,
): EnsureFuturePlansResult {
  const createdTemplates = ensureFutureTemplates(root);
  const { markdown, changed: contractChanged } =
    ensureContractYaml(contractMarkdown);
  const createdIndex = ensureFuturePlansIndexFile(root);
  const strippedIndexRows = stripInitiativeRowsFromRootIndex(root);
  const indexTableChanged =
    strippedIndexRows || ensureIndexTableRow(root);

  return {
    contractMarkdown: markdown,
    createdIndex,
    createdTemplates,
    contractChanged,
    indexTableChanged,
  };
}
