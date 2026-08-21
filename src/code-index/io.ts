// src/code-index/io.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { codeIndexManifestPath } from "./paths.js";
import type { CodeIndexManifest } from "./types.js";

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function parseManifest(raw: unknown): CodeIndexManifest {
  if (!isRecord(raw)) throw new Error("invalid code-index manifest");
  if (raw.schema_version !== 2) {
    throw new Error(`unsupported code-index manifest schema_version: ${String(raw.schema_version)}`);
  }
  if (
    !isString(raw.index_fingerprint) ||
    !isString(raw.content_fingerprint) ||
    !isString(raw.corpus) ||
    !isRecord(raw.grammar_versions) ||
    !Array.isArray(raw.roots) ||
    !raw.roots.every(isString) ||
    !isRecord(raw.files)
  ) {
    throw new Error("invalid code-index manifest");
  }
  for (const meta of Object.values(raw.files)) {
    if (
      !isRecord(meta) ||
      !isString(meta.hash) ||
      !isString(meta.language) ||
      !isNumber(meta.symbols)
    ) {
      throw new Error("invalid code-index manifest");
    }
  }
  return raw as CodeIndexManifest;
}

export function saveCodeIndexManifest(root: string, manifest: CodeIndexManifest): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  writeJsonAtomic(codeIndexManifestPath(root), manifest);
}

export function loadCodeIndexManifest(root: string): CodeIndexManifest {
  const p = codeIndexManifestPath(root);
  if (!fs.existsSync(p)) throw new Error("code index manifest not found");
  return parseManifest(readJson(p));
}

export function tryLoadCodeIndexManifest(root: string): CodeIndexManifest | null {
  const p = codeIndexManifestPath(root);
  if (!fs.existsSync(p)) return null;
  try {
    return parseManifest(readJson(p));
  } catch {
    return null;
  }
}
