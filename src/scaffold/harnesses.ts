import fs from "node:fs";
import path from "node:path";
import { checkboxPrompt, isTty, type CheckboxOption } from "../agnostic/prompt.js";

export const HARNESSES = ["cursor", "claude", "dsh"] as const;
export type Harness = (typeof HARNESSES)[number];

export const HARNESS_LABELS: Record<Harness, string> = {
  cursor: "Cursor",
  claude: "Claude Code",
  dsh: "DSH (DeepSeek Harness)",
};

/** Per-harness skill-tree root, relative to the repo root. */
export const HARNESS_SKILL_ROOTS: Record<Harness, string> = {
  cursor: ".cursor/skills",
  claude: ".claude/skills",
  dsh: ".dsh/skills",
};

/**
 * Parse the --harnesses CLI value ("cursor,claude,dsh"). Unknown names and an
 * empty value fail closed with a descriptive error.
 */
export function parseHarnesses(value: string | undefined): Harness[] {
  const raw = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (raw.length === 0) {
    throw new Error(
      `--harnesses requires a comma-separated list of harnesses: ${HARNESSES.join(", ")}`,
    );
  }
  const invalid = raw.filter(
    (harness) => !(HARNESSES as readonly string[]).includes(harness),
  );
  if (invalid.length > 0) {
    throw new Error(
      `Unknown harness name(s): ${invalid.join(", ")}. Accepted values: ${HARNESSES.join(", ")}.`,
    );
  }
  return [...new Set(raw)] as Harness[];
}

/** Harnesses whose skill tree already exists in the repo. */
export function detectInstalledHarnesses(root: string): Harness[] {
  return HARNESSES.filter((harness) =>
    fs.existsSync(path.join(root, HARNESS_SKILL_ROOTS[harness])),
  );
}

export interface HarnessSelectionOptions {
  yes?: boolean;
  harnesses?: string;
}

async function selectHarnesses(
  question: string,
  options: CheckboxOption<Harness>[],
): Promise<Harness[]> {
  return checkboxPrompt(question, options);
}

/**
 * init: --harnesses wins; --yes or non-TTY installs every harness;
 * a TTY without flags prompts (all checked by default).
 */
export async function resolveInitHarnesses(
  opts: HarnessSelectionOptions,
): Promise<Harness[]> {
  if (opts.harnesses !== undefined) return parseHarnesses(opts.harnesses);
  if (opts.yes || !isTty()) return [...HARNESSES];
  return selectHarnesses(
    "Install doc-canon managed skills for which agent harnesses?",
    HARNESSES.map((harness) => ({
      value: harness,
      label: HARNESS_LABELS[harness],
      checked: true,
    })),
  );
}

/**
 * upgrade-skills / migrate: --harnesses wins; otherwise refresh the harnesses
 * already present in the repo, and on a TTY offer the missing ones.
 */
export async function resolveUpgradeHarnesses(
  root: string,
  opts: HarnessSelectionOptions,
): Promise<Harness[]> {
  if (opts.harnesses !== undefined) return parseHarnesses(opts.harnesses);
  const installed = detectInstalledHarnesses(root);
  if (opts.yes || !isTty()) return installed;
  const missing = HARNESSES.filter((harness) => !installed.includes(harness));
  if (missing.length === 0) return installed;
  const added = await selectHarnesses(
    "Additional agent harnesses are not installed in this repository — install them?",
    missing.map((harness) => ({
      value: harness,
      label: HARNESS_LABELS[harness],
      checked: true,
    })),
  );
  return [...installed, ...added];
}
