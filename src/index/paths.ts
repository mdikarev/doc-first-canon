import path from "node:path";
import { docCanonDir } from "../paths.js";

export function indexManifestPath(root: string): string {
  return path.join(docCanonDir(root), "index-manifest.json");
}

export function bm25IndexPath(root: string): string {
  return path.join(docCanonDir(root), "bm25-index.json");
}

export function indexWatchPidPath(root: string): string {
  return path.join(docCanonDir(root), "index-watch.pid");
}
