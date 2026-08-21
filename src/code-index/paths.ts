import path from "node:path";
import { docCanonDir } from "../paths.js";

export function codeIndexManifestPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-manifest.json");
}

export function codeIndexStorePath(root: string): string {
  return path.join(docCanonDir(root), "code-ast-index.sqlite");
}

export function codeIndexWatchPidPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-watch.pid");
}

export function codeIndexConfigPath(root: string): string {
  return path.join(docCanonDir(root), "code-index.json");
}

export function codeIndexStatsPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-stats.json");
}