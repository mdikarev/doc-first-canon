import fs from "node:fs";
import { parseContractMarkdown } from "../contract/parse.js";
import { buildInventory, writeInventory } from "../inventory/build.js";
import {
  contractPath,
  resolveRoot,
} from "../paths.js";
import { readReport, writeReport } from "../report/io.js";
import { mergeCliFindings, nextFindingId } from "../report/merge.js";
import type { Finding } from "../report/types.js";
import {
  validateCanon,
  validationErrorKind,
  validationErrorPaths,
} from "../validate/validate.js";

function inventoryIgnoreGlobs(root: string): string[] {
  try {
    const markdown = fs.readFileSync(contractPath(root), "utf8");
    return parseContractMarkdown(markdown).policies.ignore;
  } catch {
    return [];
  }
}

export async function checkCanon(root: string): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const validation = validateCanon(resolvedRoot);

  const inventory = buildInventory(
    resolvedRoot,
    inventoryIgnoreGlobs(resolvedRoot),
  );
  writeInventory(resolvedRoot, inventory);

  const existing = readReport(resolvedRoot);
  const findingsForIds = existing?.findings ?? [];
  const cliFindings: Finding[] = validation.errors.map((error) => {
    const finding: Finding = {
      id: nextFindingId(findingsForIds),
      kind: validationErrorKind(error),
      paths: validationErrorPaths(error),
      summary: error,
      status: "open",
      source: "cli",
    };
    findingsForIds.push(finding);
    return finding;
  });

  writeReport(resolvedRoot, mergeCliFindings(existing, cliFindings));
  return validation.ok ? 0 : 1;
}
