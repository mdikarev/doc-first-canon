import path from "node:path";
import { docCanonDir } from "../paths.js";

export function codeIndexManifestPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-manifest.json");
}

export function codeAstIndexPath(root: string): string {
  return path.join(docCanonDir(root), "code-ast-index.json");
}

export function codeIndexWatchPidPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-watch.pid");
}

export function codeIndexConfigPath(root: string): string {
  return path.join(docCanonDir(root), "code-index.json");
}
