import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseContractMarkdown } from "../contract/parse.js";
import { buildInventory, writeInventory } from "../inventory/build.js";
import {
  canonDir,
  contractPath,
  resolveRoot,
} from "../paths.js";
import { readReport, writeReport } from "../report/io.js";
import { mergeCliFindings } from "../report/merge.js";
import type { Finding } from "../report/types.js";
import { computeDisciplineState, type KindState } from "../discipline/state.js";
import { extractMarkdownHeadings } from "../validate/headings.js";
import {
  validateCanon,
  validationErrorKind,
  validationErrorPaths,
} from "../validate/validate.js";

function inventoryConfiguration(root: string): {
  ignoreGlobs: string[];
  glossaryTerms: string[];
} {
  try {
    const markdown = fs.readFileSync(contractPath(root), "utf8");
    const contract = parseContractMarkdown(markdown);
    const glossary = contract.sections.find((section) => section.role === "glossary");
    const glossaryFile = glossary
      ? path.resolve(canonDir(root), glossary.path)
      : undefined;
    const glossaryRelative = glossaryFile
      ? path.relative(canonDir(root), glossaryFile)
      : undefined;
    const glossaryMarkdown =
      glossaryFile &&
      glossaryRelative !== ".." &&
      !glossaryRelative?.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(glossaryRelative ?? "")
        ? fs.readFileSync(glossaryFile, "utf8")
        : "";
    let inTerms = false;
    const glossaryTerms: string[] = [];
    for (const heading of extractMarkdownHeadings(glossaryMarkdown)) {
      if (heading.level === 2) inTerms = heading.text === "Terms";
      else if (inTerms && heading.level === 3) glossaryTerms.push(heading.text);
    }
    return { ignoreGlobs: contract.policies.ignore, glossaryTerms };
  } catch {
    return { ignoreGlobs: [], glossaryTerms: [] };
  }
}

function stableFindingId(
  kind: Finding["kind"],
  paths: string[],
  summary: string,
): string {
  const content = `${kind}\0${paths.join("\0")}\0${summary}`;
  return `F-${createHash("sha256").update(content).digest("hex").slice(0, 12)}`;
}

export async function checkCanon(root: string): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const validation = validateCanon(resolvedRoot);
  const inventoryConfig = inventoryConfiguration(resolvedRoot);

  const inventory = buildInventory(
    resolvedRoot,
    inventoryConfig.ignoreGlobs,
    inventoryConfig.glossaryTerms,
  );
  writeInventory(resolvedRoot, inventory);

  const existing = readReport(resolvedRoot);
  const cliFindings: Finding[] = validation.errors.map((error) => {
    const kind = validationErrorKind(error);
    const paths = validationErrorPaths(error);
    const finding: Finding = {
      id: stableFindingId(kind, paths, error),
      kind,
      paths,
      summary: error,
      status: "open",
      source: "cli",
    };
    return finding;
  });

  const discipline = computeDisciplineState(resolvedRoot);
  const disciplineFindings: Finding[] = [];
  const pushDiscipline = (label: "doc" | "code", s: KindState): void => {
    if (!s.indexExists || (s.changed.length === 0 && !s.unprobed)) return;
    disciplineFindings.push({
      id: stableFindingId("discipline", [label], `${label} index un-probed`),
      kind: "discipline",
      paths: s.changed,
      summary: `${label} index exists but ${s.changed.length} file(s) changed since the last probe (un-probed: ${s.unprobed})`,
      status: "open",
      source: "cli",
    });
  };
  pushDiscipline("doc", discipline.doc);
  pushDiscipline("code", discipline.code);

  writeReport(resolvedRoot, mergeCliFindings(existing, [...cliFindings, ...disciplineFindings]));
  return validation.ok ? 0 : 1;
}
