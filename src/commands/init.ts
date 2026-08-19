import fs from "node:fs";
import path from "node:path";
import { parseContractMarkdown } from "../contract/parse.js";
import { canonDir, embeddedRoot, resolveRoot } from "../paths.js";
import { copyManagedAssets } from "../scaffold/copy-managed.js";
import { defaultContractMarkdown } from "../scaffold/default-contract.js";
import { resolveInitHarnesses } from "../scaffold/harnesses.js";
import { validateCanon } from "./validate.js";

export interface InitOptions {
  forceSkills?: boolean;
  yes?: boolean;
  /** Comma-separated harness list (cursor,claude,dsh); undefined = prompt or default. */
  harnesses?: string;
}

function scaffoldCanon(root: string): void {
  const canonRoot = canonDir(root);
  const templateRoot = path.join(canonRoot, "templates");
  const embeddedTemplates = path.join(embeddedRoot(), "templates");
  fs.mkdirSync(templateRoot, { recursive: true });
  fs.cpSync(embeddedTemplates, templateRoot, { recursive: true });

  const contractMarkdown = defaultContractMarkdown();
  const contract = parseContractMarkdown(contractMarkdown);
  for (const section of contract.sections) {
    if (section.path === "CANON_CONTRACT.md") continue;
    const dest = path.join(canonRoot, section.path);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(
      path.join(templateRoot, `${section.template}.md`),
      dest,
    );
  }

  const indexPath = path.join(canonRoot, "INDEX.md");
  const sectionsTable = `| id | path | role | required |
| --- | --- | --- | --- |
${contract.sections
  .map(
    (section) =>
      `| ${section.id} | ${section.path} | ${section.role} | ${section.required} |`,
  )
  .join("\n")}`;
  fs.writeFileSync(
    indexPath,
    fs
      .readFileSync(indexPath, "utf8")
      .replace("<!-- sections table -->", sectionsTable),
  );
  fs.writeFileSync(path.join(canonRoot, "CANON_CONTRACT.md"), contractMarkdown);
}

function ensureGitignore(root: string): void {
  const gitignorePath = path.join(root, ".gitignore");
  const existing = fs.existsSync(gitignorePath)
    ? fs.readFileSync(gitignorePath, "utf8")
    : "";
  if (/^\.doc-canon\/?\s*$/m.test(existing)) return;
  fs.writeFileSync(
    gitignorePath,
    `${existing}${existing && !existing.endsWith("\n") ? "\n" : ""}.doc-canon/\n`,
  );
}

export async function initCanon(
  root: string,
  opts: InitOptions,
): Promise<number> {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const canonExists = fs.existsSync(canonDir(resolvedRoot));

  if (!canonExists) scaffoldCanon(resolvedRoot);
  else console.log("Canon already exists; preserving canon document content.");
  const shouldCopyAssets = !canonExists || opts.forceSkills;
  if (shouldCopyAssets) {
    const harnesses = await resolveInitHarnesses(opts);
    copyManagedAssets(resolvedRoot, harnesses);
  }
  ensureGitignore(resolvedRoot);

  return validateCanon(resolvedRoot);
}
