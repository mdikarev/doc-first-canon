import fs from "node:fs";
import path from "node:path";
import { extractYamlBlock } from "../contract/parse.js";
import { contractPath, resolveRoot } from "../paths.js";
import { ensureFuturePlansSkeleton } from "../scaffold/ensure-future-plans.js";
import {
  assertManagedMarkersWellFormed,
  copyManagedAssets,
} from "../scaffold/copy-managed.js";
import { resolveUpgradeHarnesses } from "../scaffold/harnesses.js";
import { SKILLS_STAMP } from "../version.js";
import { validateCanon } from "./validate.js";

export interface UpgradeSkillsOptions {
  yes?: boolean;
  /** Comma-separated harness list (cursor,claude,dsh); undefined = detect + prompt. */
  harnesses?: string;
}

function upgradedContractMarkdown(root: string): string {
  const file = contractPath(root);
  if (!fs.existsSync(file)) {
    throw new Error(`CANON_CONTRACT.md does not exist at ${file}`);
  }
  fs.accessSync(file, fs.constants.R_OK | fs.constants.W_OK);
  const markdown = fs.readFileSync(file, "utf8");
  const yaml = extractYamlBlock(markdown);
  if (!/^skills_stamp:\s*.*$/m.test(yaml)) {
    throw new Error("Machine contract does not define skills_stamp");
  }
  const updatedYaml = yaml.replace(
    /^skills_stamp:\s*.*$/m,
    () => `skills_stamp: "${SKILLS_STAMP}"`,
  );
  return markdown.replace(yaml, () => updatedYaml);
}

function assertUpgradePreconditions(root: string): string {
  const updatedContract = upgradedContractMarkdown(root);
  for (const name of ["AGENTS.md", "CLAUDE.md"] as const) {
    const filePath = path.join(root, name);
    if (fs.existsSync(filePath)) {
      fs.accessSync(filePath, fs.constants.R_OK | fs.constants.W_OK);
      assertManagedMarkersWellFormed(fs.readFileSync(filePath, "utf8"), name);
    }
  }
  return updatedContract;
}

export async function upgradeSkills(
  root: string,
  opts: UpgradeSkillsOptions = {},
): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const updatedContract = assertUpgradePreconditions(resolvedRoot);
  const harnesses = await resolveUpgradeHarnesses(resolvedRoot, opts);
  copyManagedAssets(resolvedRoot, harnesses);
  const { contractMarkdown } = ensureFuturePlansSkeleton(
    resolvedRoot,
    updatedContract,
  );
  fs.writeFileSync(contractPath(resolvedRoot), contractMarkdown);
  return validateCanon(resolvedRoot);
}
