// src/code-index/discovery.ts
import fs from "node:fs";
import path from "node:path";
import { isIgnored } from "../agnostic/ignore.js";
import { VCS_INDEXABLE_EXTENSIONS } from "./grammar-versions.js";
import type { CodeIndexConfig } from "./types.js";

export function findVcsRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`no VCS root (.git) found under ${start}`);
    }
    dir = parent;
  }
}

export function discoverManifestRoots(vcsRoot: string): string[] {
  const roots: string[] = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    const abs = rel === "" ? vcsRoot : path.join(vcsRoot, rel);
    if (isIgnored(rel, [])) continue;
    if (fs.existsSync(path.join(abs, "package.json"))) {
      roots.push(rel);
    }
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        stack.push(rel === "" ? ent.name : path.posix.join(rel, ent.name));
      }
    }
  }
  roots.sort();
  return roots;
}

export function discoverSourceRoots(
  root: string,
  config: CodeIndexConfig,
): { vcsRoot: string; roots: string[] } {
  const vcsRoot = findVcsRoot(root);
  if (config.roots && config.roots.length > 0) {
    const roots = config.roots.map((r) =>
      r === "." ? "" : path.posix.normalize(r).replace(/^\.\//, ""),
    );
    roots.sort();
    return { vcsRoot, roots };
  }
  const manifestRoots = discoverManifestRoots(vcsRoot);
  const roots = manifestRoots.length > 0 ? manifestRoots : [""];
  return { vcsRoot, roots };
}

function isIndexableFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  return VCS_INDEXABLE_EXTENSIONS.includes(ext);
}

export function listSourceFiles(
  vcsRoot: string,
  roots: string[],
  ignoreGlobs: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const walk = (relDir: string): void => {
    const abs = relDir === "" ? vcsRoot : path.join(vcsRoot, relDir);
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = relDir === "" ? ent.name : path.posix.join(relDir, ent.name);
      if (isIgnored(rel, ignoreGlobs)) continue;
      if (ent.isDirectory()) {
        walk(rel);
      } else if (ent.isFile() && isIndexableFile(rel)) {
        if (!seen.has(rel)) {
          seen.add(rel);
          out.push(rel);
        }
      }
    }
  };

  for (const relRoot of roots) walk(relRoot);
  out.sort();
  return out;
}
