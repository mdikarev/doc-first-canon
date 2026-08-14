import fs from "node:fs";
import YAML from "yaml";
import { extractYamlBlock, parseContractMarkdown } from "../contract/parse.js";
import { contractPath, resolveRoot } from "../paths.js";
import { ensureRequiredGaps } from "../scaffold/ensure-required-gaps.js";
import { DEFAULT_SCHEMA_VERSION, PACKAGE_VERSION } from "../version.js";
import { upgradeSkills } from "./upgrade-skills.js";

export async function migrateCanon(root: string): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const file = contractPath(resolvedRoot);
  if (!fs.existsSync(file)) {
    throw new Error(`CANON_CONTRACT.md does not exist at ${file}`);
  }
  const markdown = fs.readFileSync(file, "utf8");
  const raw = YAML.parse(extractYamlBlock(markdown)) as {
    schema_version?: unknown;
  };
  if (raw.schema_version !== DEFAULT_SCHEMA_VERSION) {
    const seen =
      raw.schema_version === undefined ? "missing" : String(raw.schema_version);
    throw new Error(
      `Unsupported schema_version ${seen}; this CLI (${PACKAGE_VERSION}) supports schema_version ${DEFAULT_SCHEMA_VERSION} only. See README Upgrade. No files were changed.`,
    );
  }
  const contract = parseContractMarkdown(markdown);
  ensureRequiredGaps(resolvedRoot, contract);
  return upgradeSkills(resolvedRoot);
}
