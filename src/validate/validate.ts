import fs from "node:fs";
import path from "node:path";
import { parseContractMarkdown } from "../contract/parse.js";
import type { Contract } from "../contract/types.js";
import {
  canonDir,
  contractPath,
  resolveRoot,
} from "../paths.js";
import {
  MIN_SKILLS_STAMP,
  PACKAGE_VERSION,
  SKILLS_STAMP,
} from "../version.js";
import {
  assertRequiredHeadings,
  requiredHeadingsFromTemplate,
} from "./headings.js";
import {
  isFuturePlansInitiativePath,
  validateFuturePlansZone,
} from "./future-plans-index.js";
import { validateIndexAgreement } from "./index-agreement.js";
import { findBrokenCanonLinks } from "./links.js";
import type { FindingKind } from "../report/types.js";
import type {
  ValidationIssue,
  ValidationResult,
  ValidationSeverity,
} from "./types.js";

const DOTTED_NUMERIC_STAMP = /^\d+(?:\.\d+)*$/;

function addIssue(
  issues: ValidationIssue[],
  message: string,
  kind: FindingKind,
  paths: string[],
  severity: ValidationSeverity = "error",
): void {
  issues.push({ message, kind, paths, severity });
}

export function cmpStamp(a: string, b: string): number {
  const left = a.split(".").map((part) => Number(part) || 0);
  const right = b.split(".").map((part) => Number(part) || 0);
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function markdownFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...markdownFiles(entryPath));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(entryPath);
  }
  return files;
}

function resolveCanonFile(
  canonRoot: string,
  relativePath: string,
  kind: "Section" | "Template",
  issues: ValidationIssue[],
): string | undefined {
  const file = path.resolve(canonRoot, relativePath);
  const relative = path.relative(canonRoot, file);
  if (
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    addIssue(
      issues,
      `${kind} path ${relativePath} resolves outside the canon root`,
      "structure",
      [relativePath],
    );
    return undefined;
  }
  if (fs.existsSync(file)) {
    try {
      const realCanonRoot = fs.realpathSync(canonRoot);
      const realFile = fs.realpathSync(file);
      const realRelative = path.relative(realCanonRoot, realFile);
      if (
        realRelative === ".." ||
        realRelative.startsWith(`..${path.sep}`) ||
        path.isAbsolute(realRelative)
      ) {
        addIssue(
          issues,
          `${kind} path ${relativePath} resolves outside the canon root`,
          "structure",
          [relativePath],
        );
        return undefined;
      }
    } catch (error) {
      addIssue(
        issues,
        `Could not resolve ${kind.toLowerCase()} path ${relativePath}: ${error instanceof Error ? error.message : String(error)}`,
        "structure",
        [relativePath],
      );
      return undefined;
    }
  }
  return file;
}

function isFile(
  file: string,
  displayPath: string,
  issues: ValidationIssue[],
): boolean {
  try {
    if (!fs.statSync(file).isFile()) {
      addIssue(issues, `${displayPath} is not a file`, "structure", [displayPath]);
      return false;
    }
    return true;
  } catch (error) {
    addIssue(
      issues,
      `Could not inspect ${displayPath}: ${error instanceof Error ? error.message : String(error)}`,
      "structure",
      [displayPath],
    );
    return false;
  }
}

function readTextFile(
  file: string,
  displayPath: string,
  issues: ValidationIssue[],
): string | undefined {
  try {
    return fs.readFileSync(file, "utf8");
  } catch (error) {
    addIssue(
      issues,
      `Could not read ${displayPath}: ${error instanceof Error ? error.message : String(error)}`,
      "structure",
      [displayPath],
    );
    return undefined;
  }
}

function lineCount(markdown: string): number {
  const lines = markdown.split(/\r?\n/);
  if (lines.at(-1) === "") lines.pop();
  return lines.length;
}

function readContract(root: string, issues: ValidationIssue[]): Contract | undefined {
  const file = contractPath(root);
  if (!fs.existsSync(file)) {
    addIssue(issues, "CANON_CONTRACT.md does not exist", "structure", [
      "CANON_CONTRACT.md",
    ]);
    return undefined;
  }
  if (!isFile(file, "CANON_CONTRACT.md", issues)) return undefined;
  const markdown = readTextFile(file, "CANON_CONTRACT.md", issues);
  if (markdown === undefined) return undefined;
  try {
    return parseContractMarkdown(markdown);
  } catch (error) {
    addIssue(
      issues,
      `CANON_CONTRACT.md is invalid: ${error instanceof Error ? error.message : String(error)}`,
      "structure",
      ["CANON_CONTRACT.md"],
    );
    return undefined;
  }
}

export function validateCanon(root: string): ValidationResult {
  const issues: ValidationIssue[] = [];
  let resolvedRoot: string;
  try {
    resolvedRoot = resolveRoot(process.cwd(), root);
  } catch (error) {
    return {
      ok: false,
      issues: [
        {
          message: error instanceof Error ? error.message : String(error),
          kind: "structure",
          paths: [],
          severity: "error",
        },
      ],
    };
  }

  const canonRoot = canonDir(resolvedRoot);
  try {
    const contract = readContract(resolvedRoot, issues);
    if (!contract) return { ok: false, issues };

    if (!DOTTED_NUMERIC_STAMP.test(contract.skills_stamp)) {
      addIssue(
        issues,
        `skills_stamp ${contract.skills_stamp} must use dotted-numeric format`,
        "structure",
        ["CANON_CONTRACT.md"],
      );
    } else if (cmpStamp(contract.skills_stamp, MIN_SKILLS_STAMP) < 0) {
      addIssue(
        issues,
        `skills_stamp ${contract.skills_stamp} is older than ${MIN_SKILLS_STAMP}; upgrade skills via doc-canon upgrade-skills (CLI ${PACKAGE_VERSION}, current stamp ${SKILLS_STAMP})`,
        "structure",
        ["CANON_CONTRACT.md"],
      );
    }

    const templates = new Map(
      contract.templates.map((template) => [template.id, template.path]),
    );
    for (const section of contract.sections) {
      const sectionFile = resolveCanonFile(
        canonRoot,
        section.path,
        "Section",
        issues,
      );
      if (!sectionFile) continue;
      const sectionExists = fs.existsSync(sectionFile);
      if (section.required && !sectionExists) {
        addIssue(
          issues,
          `Missing required section ${section.path}`,
          "structure",
          [section.path],
        );
      }
      const sectionIsFile =
        sectionExists && isFile(sectionFile, section.path, issues);

      const templateRelativePath = templates.get(section.template);
      if (!templateRelativePath) {
        addIssue(
          issues,
          `Section ${section.path} references unknown template ${section.template}`,
          "structure",
          [section.path],
        );
        continue;
      }
      const templateFile = resolveCanonFile(
        canonRoot,
        templateRelativePath,
        "Template",
        issues,
      );
      if (!templateFile) continue;
      if (!fs.existsSync(templateFile)) {
        addIssue(
          issues,
          `Template ${section.template} does not exist at ${templateRelativePath}`,
          "structure",
          [templateRelativePath],
        );
        continue;
      }
      if (!isFile(templateFile, templateRelativePath, issues)) continue;
      if (!sectionIsFile) continue;

      const sectionMarkdown = readTextFile(sectionFile, section.path, issues);
      const templateMarkdown = readTextFile(
        templateFile,
        templateRelativePath,
        issues,
      );
      if (sectionMarkdown === undefined || templateMarkdown === undefined) {
        continue;
      }
      const requiredHeadings = requiredHeadingsFromTemplate(templateMarkdown);
      const missingHeadings = assertRequiredHeadings(
        sectionMarkdown,
        requiredHeadings,
      );
      if (missingHeadings.length > 0) {
        addIssue(
          issues,
          `${section.path} is missing required headings: ${missingHeadings.join(", ")}`,
          "structure",
          [section.path],
        );
      }
      if (lineCount(sectionMarkdown) > contract.policies.max_lines) {
        addIssue(
          issues,
          `${section.path} exceeds max_lines ${contract.policies.max_lines}`,
          "structure",
          [section.path],
          "warning",
        );
      }
      const maxLineLength = contract.policies.max_line_length;
      if (maxLineLength !== undefined) {
        // Table rows and fenced code blocks are exempt: markdown table rows
        // cannot be wrapped without breaking the table, and code blocks may
        // carry intentionally long lines (URLs, examples).
        let inCodeBlock = false;
        const longLines = sectionMarkdown
          .split("\n")
          .map((line, index) => ({ line, index: index + 1 }))
          .filter(({ line }) => {
            if (line.startsWith("```")) {
              inCodeBlock = !inCodeBlock;
              return false;
            }
            if (inCodeBlock || line.startsWith("|")) return false;
            return line.length > maxLineLength;
          })
          .map(({ index }) => index);
        if (longLines.length > 0) {
          addIssue(
            issues,
            `${section.path} has ${longLines.length} line(s) longer than max_line_length ${maxLineLength}: ${longLines.join(", ")}`,
            "structure",
            [section.path],
            "warning",
          );
        }
      }
    }

    const indexFile = path.join(canonRoot, "INDEX.md");
    if (!fs.existsSync(indexFile)) {
      addIssue(issues, "INDEX.md does not exist", "structure", ["INDEX.md"]);
    } else if (isFile(indexFile, "INDEX.md", issues)) {
      const indexMarkdown = readTextFile(indexFile, "INDEX.md", issues);
      if (indexMarkdown !== undefined) {
        issues.push(...validateIndexAgreement(indexMarkdown, contract));
      }
    }

    issues.push(...validateFuturePlansZone(canonRoot, contract));

    const contractedPaths = new Set(
      contract.sections.map((section) => path.normalize(section.path)),
    );
    for (const markdownFile of markdownFiles(canonRoot)) {
      const relative = path.relative(canonRoot, markdownFile);
      if (
        relative !== "templates" &&
        !relative.startsWith(`templates${path.sep}`) &&
        !contractedPaths.has(path.normalize(relative)) &&
        !isFuturePlansInitiativePath(relative.replaceAll("\\", "/"))
      ) {
        addIssue(
          issues,
          `Orphan canon file ${relative} is not listed in the contract`,
          "structure",
          [relative],
        );
      }
      if (!relative.startsWith(`templates${path.sep}`)) {
        const markdown = readTextFile(markdownFile, relative, issues);
        if (markdown !== undefined) {
          issues.push(
            ...findBrokenCanonLinks(
              markdown,
              markdownFile,
              canonRoot,
            ),
          );
        }
      }
    }
  } catch (error) {
    addIssue(
      issues,
      `Validation failed: ${error instanceof Error ? error.message : String(error)}`,
      "structure",
      [],
    );
  }

  return { ok: issues.every((issue) => issue.severity !== "error"), issues };
}
