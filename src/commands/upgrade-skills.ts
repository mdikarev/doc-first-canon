import fs from "node:fs";
import { extractYamlBlock } from "../contract/parse.js";
import { contractPath, resolveRoot } from "../paths.js";
import { copyManagedAssets } from "../scaffold/copy-managed.js";
import { SKILLS_STAMP } from "../version.js";
import { validateCanon } from "./validate.js";

function updateSkillsStamp(root: string): void {
  const file = contractPath(root);
  const markdown = fs.readFileSync(file, "utf8");
  const yaml = extractYamlBlock(markdown);
  if (!/^skills_stamp:\s*.*$/m.test(yaml)) {
    throw new Error("Machine contract does not define skills_stamp");
  }
  const updatedYaml = yaml.replace(
    /^skills_stamp:\s*.*$/m,
    `skills_stamp: "${SKILLS_STAMP}"`,
  );
  fs.writeFileSync(file, markdown.replace(yaml, updatedYaml));
}

export async function upgradeSkills(root: string): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  copyManagedAssets(resolvedRoot);
  updateSkillsStamp(resolvedRoot);
  return validateCanon(resolvedRoot);
}
