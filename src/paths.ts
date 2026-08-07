import fs from "node:fs";
import path from "node:path";

export function resolveRoot(cwd: string, rootFlag?: string): string {
  const root = path.resolve(cwd, rootFlag ?? ".");
  if (!fs.existsSync(root)) throw new Error(`Root not found: ${root}`);
  return root;
}

export function canonDir(root: string): string {
  return path.join(root, "docs", "canon");
}

export function contractPath(root: string): string {
  return path.join(canonDir(root), "CANON_CONTRACT.md");
}

export function docCanonDir(root: string): string {
  return path.join(root, ".doc-canon");
}
