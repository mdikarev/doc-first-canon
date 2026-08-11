import fs from "node:fs";
import path from "node:path";
import { canonDir } from "../paths.js";

function walkMd(absDir: string, root: string, out: string[]): void {
  for (const ent of fs.readdirSync(absDir, { withFileTypes: true })) {
    const abs = path.join(absDir, ent.name);
    if (ent.isDirectory()) {
      walkMd(abs, root, out);
      continue;
    }
    if (ent.isFile() && ent.name.endsWith(".md")) {
      const rel = path.relative(root, abs).split(path.sep).join("/");
      out.push(rel);
    }
  }
}

export function listCanonMarkdown(root: string): string[] {
  const dir = canonDir(root);
  if (!fs.existsSync(dir)) {
    throw new Error(`docs/canon not found under ${root}`);
  }
  const out: string[] = [];
  walkMd(dir, root, out);
  out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  return out;
}
