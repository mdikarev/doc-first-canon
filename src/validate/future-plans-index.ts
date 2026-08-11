import fs from "node:fs";
import path from "node:path";
import type { Contract } from "../contract/types.js";
import {
  assertRequiredHeadings,
  requiredHeadingsFromTemplate,
} from "./headings.js";

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
  return (
    normalized.startsWith(`${FUTURE_PLANS_DIR}/`) &&
    normalized !== FUTURE_PLANS_INDEX &&
    !normalized.startsWith(`${FUTURE_PLANS_DIR}/templates/`)
  );
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
): string[] {
  const errors: string[] = [];
  const indexAbs = path.join(canonRoot, FUTURE_PLANS_INDEX);
  if (!fs.existsSync(indexAbs)) return errors;

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
      errors.push(
        `future_plans Initiatives table links to missing file ${indexedPath}`,
      );
    }
  }

  for (const diskPath of diskInitiatives) {
    if (!indexed.has(diskPath)) {
      errors.push(
        `Orphan future_plans file ${diskPath} is not listed in future_plans/INDEX.md Initiatives`,
      );
    }
  }

  const templateEntry = contract.templates.find((t) => t.id === "FUTURE_PLAN");
  if (!templateEntry) {
    if (indexed.size > 0) {
      errors.push(
        `Initiatives require template FUTURE_PLAN but it is not registered`,
      );
    }
    return errors;
  }

  const templateAbs = path.join(canonRoot, templateEntry.path);
  if (!fs.existsSync(templateAbs)) {
    errors.push(`Template FUTURE_PLAN does not exist at ${templateEntry.path}`);
    return errors;
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
      errors.push(
        `${indexedPath} is missing required headings: ${missing.join(", ")}`,
      );
    }
  }

  return errors;
}
