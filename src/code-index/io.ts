// src/code-index/io.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { codeAstIndexPath, codeIndexManifestPath } from "./paths.js";
import type { CodeAstIndex, CodeIndexFileMeta, CodeIndexManifest } from "./types.js";

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

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseManifest(raw: unknown): CodeIndexManifest {
  if (!isRecord(raw)) throw new Error("invalid code-index manifest");
  if (raw.schema_version !== 1) {
    throw new Error(`unsupported code-index manifest schema_version: ${String(raw.schema_version)}`);
  }
  if (
    !isString(raw.index_fingerprint) ||
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

function parseAst(raw: unknown): CodeAstIndex {
  if (!isRecord(raw)) throw new Error("invalid code-ast-index");
  if (raw.schema_version !== 1) {
    throw new Error(`unsupported code-ast-index schema_version: ${String(raw.schema_version)}`);
  }
  if (!isString(raw.index_fingerprint) || !Array.isArray(raw.symbols) || !Array.isArray(raw.references)) {
    throw new Error("invalid code-ast-index");
  }
  return raw as CodeAstIndex;
}

export function saveCodeIndexPair(
  root: string,
  manifest: CodeIndexManifest,
  ast: CodeAstIndex,
): void {
  if (manifest.index_fingerprint !== ast.index_fingerprint) {
    throw new Error(
      `index_fingerprint mismatch: manifest=${manifest.index_fingerprint} ast=${ast.index_fingerprint}`,
    );
  }
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  writeJsonAtomic(codeAstIndexPath(root), ast);
  writeJsonAtomic(codeIndexManifestPath(root), manifest);
}

export function loadCodeIndexPair(
  root: string,
): { manifest: CodeIndexManifest; ast: CodeAstIndex } {
  const manifestPath = codeIndexManifestPath(root);
  const astPath = codeAstIndexPath(root);
  if (!fs.existsSync(manifestPath) || !fs.existsSync(astPath)) {
    throw new Error("code index pair not found");
  }
  const manifest = parseManifest(readJson(manifestPath));
  const ast = parseAst(readJson(astPath));
  if (manifest.index_fingerprint !== ast.index_fingerprint) {
    throw new Error(
      `index_fingerprint mismatch: manifest=${manifest.index_fingerprint} ast=${ast.index_fingerprint}`,
    );
  }
  return { manifest, ast };
}

export function tryLoadCodeIndexManifest(root: string): CodeIndexManifest | null {
  const manifestPath = codeIndexManifestPath(root);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return parseManifest(readJson(manifestPath));
  } catch {
    return null;
  }
}
