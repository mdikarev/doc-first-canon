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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseManifest(raw: unknown): IndexManifest {
  if (!isRecord(raw)) {
    throw new Error("invalid manifest");
  }
  if (raw.schema_version !== 1) {
    throw new Error(`unsupported manifest schema_version: ${raw.schema_version}`);
  }
  if (
    typeof raw.index_id !== "string" ||
    typeof raw.built_at !== "string" ||
    typeof raw.corpus !== "string" ||
    !isRecord(raw.docs)
  ) {
    throw new Error("invalid manifest");
  }
  for (const doc of Object.values(raw.docs)) {
    if (
      !isRecord(doc) ||
      typeof doc.hash !== "string" ||
      !isNumber(doc.token_count) ||
      (doc.size !== undefined && !isNumber(doc.size)) ||
      (doc.mtime_ms !== undefined && !isNumber(doc.mtime_ms))
    ) {
      throw new Error("invalid manifest");
    }
  }
  return raw as IndexManifest;
}

function parseBm25(raw: unknown): Bm25State {
  if (!isRecord(raw)) {
    throw new Error("invalid bm25");
  }
  if (raw.schema_version !== 1 && raw.schema_version !== 2) {
    throw new Error(`unsupported bm25 schema_version: ${raw.schema_version}`);
  }
  if (
    typeof raw.index_id !== "string" ||
    !isRecord(raw.postings) ||
    !isRecord(raw.doc_lengths)
  ) {
    throw new Error("invalid bm25");
  }
  if (
    raw.heading_terms !== undefined &&
    (!isRecord(raw.heading_terms) ||
      !Object.values(raw.heading_terms).every(
        (v) => Array.isArray(v) && v.every((s) => typeof s === "string"),
      ))
  ) {
    throw new Error("invalid bm25");
  }
  for (const terms of Object.values(raw.postings)) {
    if (!isRecord(terms) || !Object.values(terms).every(isNumber)) {
      throw new Error("invalid bm25");
    }
  }
  if (!Object.values(raw.doc_lengths).every(isNumber)) {
    throw new Error("invalid bm25");
  }
  return raw as Bm25State;
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

export function saveManifestOnly(root: string, manifest: IndexManifest): void {
  fs.mkdirSync(docCanonDir(path.resolve(root)), { recursive: true });
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

export function loadBm25(root: string): Bm25State {
  const bm25Path = bm25IndexPath(root);
  if (!fs.existsSync(bm25Path)) {
    throw new Error("bm25 index not found");
  }
  return parseBm25(readJson(bm25Path));
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