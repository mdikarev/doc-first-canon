import fs from "node:fs";
import path from "node:path";
import { docCanonDir } from "../paths.js";
import { bm25IndexPath, indexManifestPath } from "./paths.js";
import type { Bm25State, IndexManifest } from "./types.js";

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function parseManifest(raw: unknown): IndexManifest {
  const manifest = raw as IndexManifest;
  if (manifest?.schema_version !== 1) {
    throw new Error(`unsupported manifest schema_version: ${manifest?.schema_version}`);
  }
  return manifest;
}

function parseBm25(raw: unknown): Bm25State {
  const bm25 = raw as Bm25State;
  if (bm25?.schema_version !== 1) {
    throw new Error(`unsupported bm25 schema_version: ${bm25?.schema_version}`);
  }
  return bm25;
}

export function saveIndexPair(
  root: string,
  manifest: IndexManifest,
  bm25: Bm25State,
): void {
  if (manifest.index_id !== bm25.index_id) {
    throw new Error(
      `index_id mismatch: manifest=${manifest.index_id} bm25=${bm25.index_id}`,
    );
  }
  fs.mkdirSync(docCanonDir(path.resolve(root)), { recursive: true });
  writeJsonAtomic(bm25IndexPath(root), bm25);
  writeJsonAtomic(indexManifestPath(root), manifest);
}

export function loadIndexPair(
  root: string,
): { manifest: IndexManifest; bm25: Bm25State } {
  const manifestPath = indexManifestPath(root);
  const bm25Path = bm25IndexPath(root);
  if (!fs.existsSync(manifestPath) || !fs.existsSync(bm25Path)) {
    throw new Error("index pair not found");
  }
  const manifest = parseManifest(readJson(manifestPath));
  const bm25 = parseBm25(readJson(bm25Path));
  if (manifest.index_id !== bm25.index_id) {
    throw new Error(
      `index_id mismatch: manifest=${manifest.index_id} bm25=${bm25.index_id}`,
    );
  }
  return { manifest, bm25 };
}

export function tryLoadManifest(root: string): IndexManifest | null {
  const manifestPath = indexManifestPath(root);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return parseManifest(readJson(manifestPath));
  } catch {
    return null;
  }
}
