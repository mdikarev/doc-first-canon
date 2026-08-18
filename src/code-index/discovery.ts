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

const SOURCE_ROOT_MANIFEST_FILES: readonly string[] = [
  "package.json",
  "go.mod",
  "Cargo.toml",
  "pyproject.toml",
  "setup.py",
  "setup.cfg",
];
const SOURCE_ROOT_MANIFEST_EXTENSIONS: readonly string[] = [".csproj", ".sln"];

function hasManifest(entries: fs.Dirent[]): boolean {
  return entries.some(
    (ent) =>
      ent.isFile() &&
      (SOURCE_ROOT_MANIFEST_FILES.includes(ent.name) ||
        SOURCE_ROOT_MANIFEST_EXTENSIONS.some((ext) =>
          ent.name.toLowerCase().endsWith(ext),
        )),
  );
}

export function discoverManifestRoots(vcsRoot: string): string[] {
  const roots: string[] = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    const abs = rel === "" ? vcsRoot : path.join(vcsRoot, rel);
    if (isIgnored(rel, [])) continue;
    const entries = fs.readdirSync(abs, { withFileTypes: true });
    if (hasManifest(entries)) {
      roots.push(rel);
    }
    for (const ent of entries) {
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
