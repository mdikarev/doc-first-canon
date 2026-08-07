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
import { validateIndexAgreement } from "./index-agreement.js";
import { findBrokenCanonLinks } from "./links.js";

export interface ValidateResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
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

function readContract(root: string, errors: string[]): Contract | undefined {
  const file = contractPath(root);
  if (!fs.existsSync(file)) {
    errors.push("CANON_CONTRACT.md does not exist");
    return undefined;
  }
  try {
    return parseContractMarkdown(fs.readFileSync(file, "utf8"));
  } catch (error) {
    errors.push(
      `CANON_CONTRACT.md is invalid: ${error instanceof Error ? error.message : String(error)}`,
    );
    return undefined;
  }
}

export function validateCanon(root: string): ValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let resolvedRoot: string;
  try {
    resolvedRoot = resolveRoot(process.cwd(), root);
  } catch (error) {
    return {
      ok: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings,
    };
  }

  const canonRoot = canonDir(resolvedRoot);
  const contract = readContract(resolvedRoot, errors);
  if (!contract) return { ok: false, errors, warnings };

  if (cmpStamp(contract.skills_stamp, MIN_SKILLS_STAMP) < 0) {
    errors.push(
      `skills_stamp ${contract.skills_stamp} is older than ${MIN_SKILLS_STAMP}; upgrade skills via doc-canon upgrade-skills (CLI ${PACKAGE_VERSION}, current stamp ${SKILLS_STAMP})`,
    );
  }

  const templates = new Map(
    contract.templates.map((template) => [template.id, template.path]),
  );
  for (const section of contract.sections) {
    const sectionFile = path.join(canonRoot, section.path);
    if (section.required && !fs.existsSync(sectionFile)) {
      errors.push(`Missing required section ${section.path}`);
    }

    const templateRelativePath = templates.get(section.template);
    if (!templateRelativePath) {
      errors.push(
        `Section ${section.path} references unknown template ${section.template}`,
      );
      continue;
    }
    const templateFile = path.join(canonRoot, templateRelativePath);
    if (!fs.existsSync(templateFile)) {
      errors.push(
        `Template ${section.template} does not exist at ${templateRelativePath}`,
      );
      continue;
    }
    if (!fs.existsSync(sectionFile)) continue;

    const sectionMarkdown = fs.readFileSync(sectionFile, "utf8");
    const templateMarkdown = fs.readFileSync(templateFile, "utf8");
    const requiredHeadings = requiredHeadingsFromTemplate(templateMarkdown);
    const missingHeadings = assertRequiredHeadings(
      sectionMarkdown,
      requiredHeadings,
    );
    if (missingHeadings.length > 0) {
      errors.push(
        `${section.path} is missing required headings: ${missingHeadings.join(", ")}`,
      );
    }
    if (sectionMarkdown.split(/\r?\n/).length > contract.policies.max_lines) {
      warnings.push(
        `${section.path} exceeds max_lines ${contract.policies.max_lines}`,
      );
    }
  }

  const indexFile = path.join(canonRoot, "INDEX.md");
  if (!fs.existsSync(indexFile)) {
    errors.push("INDEX.md does not exist");
  } else {
    errors.push(
      ...validateIndexAgreement(
        fs.readFileSync(indexFile, "utf8"),
        contract,
      ),
    );
  }

  const contractedPaths = new Set(
    contract.sections.map((section) => path.normalize(section.path)),
  );
  for (const markdownFile of markdownFiles(canonRoot)) {
    const relative = path.relative(canonRoot, markdownFile);
    if (
      relative !== "templates" &&
      !relative.startsWith(`templates${path.sep}`) &&
      !contractedPaths.has(path.normalize(relative))
    ) {
      errors.push(`Orphan canon file ${relative} is not listed in the contract`);
    }
    if (!relative.startsWith(`templates${path.sep}`)) {
      errors.push(
        ...findBrokenCanonLinks(
          fs.readFileSync(markdownFile, "utf8"),
          markdownFile,
          canonRoot,
        ),
      );
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
