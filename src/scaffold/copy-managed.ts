import fs from "node:fs";
import path from "node:path";
import { embeddedRoot } from "../paths.js";

const START_MARKER = "<!-- doc-canon:start -->";
const END_MARKER = "<!-- doc-canon:end -->";

export function stripYamlFrontmatter(source: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!match) {
    throw new Error(
      "embedded pointer rule is missing YAML frontmatter to strip for CLAUDE.md",
    );
  }
  return match[1].replace(/^\r?\n/, "");
}

export function assertManagedMarkersWellFormed(
  existing: string,
  fileLabel: string,
): void {
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  const startCount = existing.split(START_MARKER).length - 1;
  const endCount = existing.split(END_MARKER).length - 1;
  const hasNoMarkers = startCount === 0 && endCount === 0;
  const hasValidManagedBlock =
    startCount === 1 && endCount === 1 && start < end;
  if (!hasNoMarkers && !hasValidManagedBlock) {
    throw new Error(
      `${fileLabel} has malformed doc-canon markers: expected exactly one ` +
        "doc-canon:start and one doc-canon:end marker, with start before end. " +
        "Fix the markers and retry.",
    );
  }
}

/** @deprecated Prefer assertManagedMarkersWellFormed(existing, "AGENTS.md") */
export function assertAgentsMarkersWellFormed(existing: string): void {
  assertManagedMarkersWellFormed(existing, "AGENTS.md");
}

function copyDirectoryFiles(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectoryFiles(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

export function upsertMarkedBlock(
  root: string,
  fileName: string,
  managedBlock: string,
): void {
  const filePath = path.join(root, fileName);
  const block = managedBlock.trim();
  const existing = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";
  assertManagedMarkersWellFormed(existing, fileName);
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);
  const startCount = existing.split(START_MARKER).length - 1;

  let next: string;
  if (startCount === 0) {
    next = `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${block}\n`;
  } else {
    next =
      existing.slice(0, start) + block + existing.slice(end + END_MARKER.length);
  }
  fs.writeFileSync(filePath, next);
}

export function upsertAgentsBlock(root: string): void {
  const managedBlock = fs
    .readFileSync(path.join(embeddedRoot(), "agents", "AGENTS.block.md"), "utf8")
    .trim();
  upsertMarkedBlock(root, "AGENTS.md", managedBlock);
}

export function upsertClaudeBlock(root: string): void {
  const ruleSource = fs.readFileSync(
    path.join(embeddedRoot(), "rules", "doc-canon.mdc"),
    "utf8",
  );
  const body = stripYamlFrontmatter(ruleSource).trim();
  const managedBlock = `${START_MARKER}\n${body}\n${END_MARKER}`;
  upsertMarkedBlock(root, "CLAUDE.md", managedBlock);
}

export function copyManagedAssets(root: string): void {
  for (const name of ["AGENTS.md", "CLAUDE.md"] as const) {
    const filePath = path.join(root, name);
    if (fs.existsSync(filePath)) {
      assertManagedMarkersWellFormed(fs.readFileSync(filePath, "utf8"), name);
    }
  }

  const skillsSource = path.join(embeddedRoot(), "skills");
  copyDirectoryFiles(skillsSource, path.join(root, ".cursor", "skills"));
  copyDirectoryFiles(skillsSource, path.join(root, ".claude", "skills"));

  const rulesRoot = path.join(root, ".cursor", "rules");
  fs.mkdirSync(rulesRoot, { recursive: true });
  fs.copyFileSync(
    path.join(embeddedRoot(), "rules", "doc-canon.mdc"),
    path.join(rulesRoot, "doc-canon.mdc"),
  );

  upsertAgentsBlock(root);
  upsertClaudeBlock(root);
}
