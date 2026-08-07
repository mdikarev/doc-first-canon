import YAML from "yaml";
import type { Contract } from "./types.js";
import { assertContractSchema } from "./schema.js";

const YAML_FENCE_RE = /```yaml\n([\s\S]*?)```/g;

export function extractYamlBlock(markdown: string): string {
  const matches = [...markdown.matchAll(YAML_FENCE_RE)];
  if (matches.length !== 1) {
    throw new Error(
      `Expected exactly one yaml machine block, found ${matches.length}`,
    );
  }
  return matches[0][1]!;
}

export function parseContractMarkdown(markdown: string): Contract {
  const yamlText = extractYamlBlock(markdown);
  const raw = YAML.parse(yamlText);
  return assertContractSchema(raw);
}
