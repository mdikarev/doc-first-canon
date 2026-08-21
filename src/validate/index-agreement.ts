import type { Contract } from "../contract/types.js";
import type { ValidationIssue } from "./types.js";

function tableCellPath(cell: string): string | undefined {
  const value = cell.trim().replace(/^`|`$/g, "");
  const link = /\[[^\]]*]\(([^)]+)\)/.exec(value);
  const candidate = (link?.[1] ?? value).split("#", 1)[0]?.trim();
  return candidate?.endsWith(".md") ? candidate : undefined;
}

export function sectionPathsFromIndex(indexMarkdown: string): string[] {
  const sections = /^##\s+Sections\s*$(.*?)(?=^##\s|(?![\s\S]))/ims.exec(
    indexMarkdown,
  );
  if (!sections) return [];

  const paths: string[] = [];
  for (const line of sections[1].split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 2 || /^[-:\s]+$/.test(cells[1] ?? "")) continue;
    const path = tableCellPath(cells[1] ?? "");
    if (path) paths.push(path);
  }
  return paths;
}

export function validateIndexAgreement(
  indexMarkdown: string,
  contract: Contract,
): ValidationIssue[] {
  const indexed = new Set(sectionPathsFromIndex(indexMarkdown));
  const contracted = new Set(contract.sections.map((section) => section.path));
  const issues: ValidationIssue[] = [];

  for (const section of contract.sections) {
    if (section.required && !indexed.has(section.path)) {
      issues.push({
        message: `INDEX Sections table is missing required path ${section.path}`,
        kind: "structure",
        paths: ["INDEX.md"],
        severity: "error",
      });
    }
  }
  for (const indexedPath of indexed) {
    if (!contracted.has(indexedPath)) {
      issues.push({
        message: `INDEX Sections table path ${indexedPath} is not in the contract`,
        kind: "structure",
        paths: ["INDEX.md"],
        severity: "error",
      });
    }
  }
  return issues;
}
