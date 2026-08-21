import fs from "node:fs";
import path from "node:path";
import type { Contract } from "../contract/types.js";
import {
  assertRequiredHeadings,
  requiredHeadingsFromTemplate,
} from "./headings.js";
import type { ValidationIssue } from "./types.js";

const FUTURE_PLANS_DIR = "future_plans";
const FUTURE_PLANS_INDEX = "future_plans/INDEX.md";

function tableCellPath(cell: string): string | undefined {
  const value = cell.trim().replace(/^`|`$/g, "");
  const link = /\[[^\]]*]\(([^)]+)\)/.exec(value);
  const candidate = (link?.[1] ?? value).split("#", 1)[0]?.trim();
  return candidate?.endsWith(".md") ? candidate : undefined;
}

export function isFuturePlansInitiativePath(relativePosix: string): boolean {
  const normalized = relativePosix.replaceAll("\\", "/");
  if (!normalized.startsWith(`${FUTURE_PLANS_DIR}/`)) return false;
  if (normalized === FUTURE_PLANS_INDEX) return false;
  const rest = normalized.slice(`${FUTURE_PLANS_DIR}/`.length);
  // Only direct children of future_plans/ are exempt; nested paths (e.g.
  // future_plans/notes/x.md) remain contract orphans (fail closed).
  return rest.length > 0 && !rest.includes("/") && rest.endsWith(".md");
}

export function initiativePathsFromFuturePlansIndex(
  indexMarkdown: string,
): string[] {
  const section =
    /^##\s+Initiatives\s*$(.*?)(?=^##\s|(?![\s\S]))/ims.exec(indexMarkdown);
  if (!section) return [];

  const paths: string[] = [];
  for (const line of section[1].split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line.split("|").slice(1, -1);
    if (cells.length < 4 || /^[-:\s]+$/.test(cells[1] ?? "")) continue;
    const raw = tableCellPath(cells[3] ?? "");
    if (!raw) continue;
    const normalized = raw.replaceAll("\\", "/");
    const withPrefix = normalized.startsWith(`${FUTURE_PLANS_DIR}/`)
      ? normalized
      : `${FUTURE_PLANS_DIR}/${normalized}`;
    paths.push(withPrefix);
  }
  return paths;
}

export function validateFuturePlansZone(
  canonRoot: string,
  contract: Contract,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const indexAbs = path.join(canonRoot, FUTURE_PLANS_INDEX);
  if (!fs.existsSync(indexAbs)) return issues;

  const indexMarkdown = fs.readFileSync(indexAbs, "utf8");
  const indexed = new Set(
    initiativePathsFromFuturePlansIndex(indexMarkdown).map((p) =>
      path.normalize(p),
    ),
  );

  const diskInitiatives: string[] = [];
  const dir = path.join(canonRoot, FUTURE_PLANS_DIR);
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".md") || name === "INDEX.md") continue;
      diskInitiatives.push(path.normalize(`${FUTURE_PLANS_DIR}/${name}`));
    }
  }

  for (const indexedPath of indexed) {
    const abs = path.join(canonRoot, indexedPath);
    if (!fs.existsSync(abs)) {
      issues.push({
        message: `future_plans Initiatives table links to missing file ${indexedPath}`,
        kind: "structure",
        paths: [indexedPath],
        severity: "error",
      });
    }
  }

  for (const diskPath of diskInitiatives) {
    if (!indexed.has(diskPath)) {
      issues.push({
        message: `Orphan future_plans file ${diskPath} is not listed in future_plans/INDEX.md Initiatives`,
        kind: "structure",
        paths: [diskPath],
        severity: "error",
      });
    }
  }

  const templateEntry = contract.templates.find((t) => t.id === "FUTURE_PLAN");
  if (!templateEntry) {
    if (indexed.size > 0) {
      issues.push({
        message:
          "Initiatives require template FUTURE_PLAN but it is not registered",
        kind: "structure",
        paths: [FUTURE_PLANS_INDEX],
        severity: "error",
      });
    }
    return issues;
  }

  const templateAbs = path.join(canonRoot, templateEntry.path);
  if (!fs.existsSync(templateAbs)) {
    issues.push({
      message: `Template FUTURE_PLAN does not exist at ${templateEntry.path}`,
      kind: "structure",
      paths: [templateEntry.path],
      severity: "error",
    });
    return issues;
  }

  const required = requiredHeadingsFromTemplate(
    fs.readFileSync(templateAbs, "utf8"),
  );

  for (const indexedPath of indexed) {
    const abs = path.join(canonRoot, indexedPath);
    if (!fs.existsSync(abs)) continue;
    const missing = assertRequiredHeadings(
      fs.readFileSync(abs, "utf8"),
      required,
    );
    if (missing.length > 0) {
      issues.push({
        message: `${indexedPath} is missing required headings: ${missing.join(", ")}`,
        kind: "structure",
        paths: [indexedPath],
        severity: "error",
      });
    }
  }

  return issues;
}
