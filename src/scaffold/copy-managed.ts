import fs from "node:fs";
import path from "node:path";
import { embeddedRoot } from "../paths.js";

const START_MARKER = "<!-- doc-canon:start -->";
const END_MARKER = "<!-- doc-canon:end -->";

function copyDirectoryFiles(source: string, target: string): void {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) copyDirectoryFiles(sourcePath, targetPath);
    else if (entry.isFile()) fs.copyFileSync(sourcePath, targetPath);
  }
}

export function upsertAgentsBlock(root: string): void {
  const agentsPath = path.join(root, "AGENTS.md");
  const managedBlock = fs
    .readFileSync(path.join(embeddedRoot(), "agents", "AGENTS.block.md"), "utf8")
    .trim();
  const existing = fs.existsSync(agentsPath)
    ? fs.readFileSync(agentsPath, "utf8")
    : "";
  const start = existing.indexOf(START_MARKER);
  const end = existing.indexOf(END_MARKER);

  let next: string;
  if (start >= 0 && end >= start) {
    next =
      existing.slice(0, start) +
      managedBlock +
      existing.slice(end + END_MARKER.length);
  } else {
    next = `${existing.trimEnd()}${existing.trim() ? "\n\n" : ""}${managedBlock}\n`;
  }
  fs.writeFileSync(agentsPath, next);
}

export function copyManagedAssets(root: string): void {
  copyDirectoryFiles(
    path.join(embeddedRoot(), "skills"),
    path.join(root, ".cursor", "skills"),
  );

  const rulesRoot = path.join(root, ".cursor", "rules");
  fs.mkdirSync(rulesRoot, { recursive: true });
  fs.copyFileSync(
    path.join(embeddedRoot(), "rules", "doc-canon.mdc"),
    path.join(rulesRoot, "doc-canon.mdc"),
  );
  upsertAgentsBlock(root);
}
