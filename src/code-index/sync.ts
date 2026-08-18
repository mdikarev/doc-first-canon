// src/code-index/sync.ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { extractFile, grammarForFile } from "./extractors/index.js";
import { GRAMMAR_VERSIONS } from "./grammar-versions.js";
import { saveCodeIndexPair, tryLoadCodeIndexManifest } from "./io.js";
import type { CodeAstIndex, CodeIndexManifest, CodeSyncResult } from "./types.js";

export function computeFingerprint(relHashes: Array<[string, string]>): string {
  const lines = relHashes
    .map(([rel, hash]) => `${rel}:${hash}`)
    .sort()
    .join("\n");
  const hex = createHash("sha256").update(lines, "utf8").digest("hex");
  return `sha256:${hex}`;
}

export async function syncCodeIndex(root: string): Promise<CodeSyncResult> {
  const config = loadCodeIndexConfig(root);
  const { vcsRoot, roots } = discoverSourceRoots(root, config);
  const ignoreGlobs = config.ignore ?? [];
  const files = listSourceFiles(vcsRoot, roots, ignoreGlobs);

  const previous = tryLoadCodeIndexManifest(vcsRoot);
  const grammarBumped =
    previous !== null &&
    JSON.stringify(previous.grammar_versions) !== JSON.stringify(GRAMMAR_VERSIONS);

  const hashes = new Map<string, string>();
  for (const rel of files) {
    hashes.set(rel, contentHash(fs.readFileSync(path.join(vcsRoot, rel), "utf8")));
  }

  const changed = [
    ...files.filter((rel) => previous?.files[rel]?.hash !== hashes.get(rel)),
    ...Object.keys(previous?.files ?? {}).filter((rel) => !hashes.has(rel)),
  ];
  if (previous !== null && !grammarBumped && changed.length === 0) {
    return { status: "fresh", indexed: files.length, changed: [] };
  }

  const symbols: CodeAstIndex["symbols"] = [];
  const references: CodeAstIndex["references"] = [];
  const knownFiles = new Set(files);
  const fileMeta: CodeIndexManifest["files"] = {};
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const text = fs.readFileSync(abs, "utf8");
    const hash = hashes.get(rel)!;
    const extracted = await extractFile(rel, text, knownFiles);
    symbols.push(...extracted.symbols);
    references.push(...extracted.references);
    fileMeta[rel] = {
      hash,
      language: grammarForFile(rel),
      symbols: extracted.symbols.length,
    };
  }

  const relHashes = [...hashes.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const fingerprint = computeFingerprint(relHashes);
  const corpus = roots.map((r) => (r === "" ? "**" : `${r}/**`)).join(", ");

  const manifest: CodeIndexManifest = {
    schema_version: 1,
    index_fingerprint: fingerprint,
    corpus,
    grammar_versions: { ...GRAMMAR_VERSIONS },
    roots,
    files: fileMeta,
  };
  const ast: CodeAstIndex = {
    schema_version: 1,
    index_fingerprint: fingerprint,
    symbols,
    references,
  };
  saveCodeIndexPair(vcsRoot, manifest, ast);

  return { status: "updated", indexed: files.length, changed: [...changed].sort() };
}
