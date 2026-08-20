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
import { saveCodeIndexStats, tryLoadCodeIndexStats } from "./stats.js";
import { CROSS_FILE_RESOLVERS } from "./resolvers/index.js";
import type { CodeAstIndex, CodeIndexManifest, CodeReference, CodeSymbol, CodeSyncResult, UnresolvedMember } from "./types.js";

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

  // Stat fast path: with a stats cache matching the previous fingerprint,
  // files whose (size, mtime_ms) are unchanged reuse the manifest hash without
  // being read or hashed. Changed files are content-hashed and compared, so a
  // touch/checkout with identical content does not trigger a rebuild.
  const statsCache = tryLoadCodeIndexStats(vcsRoot);
  const canTrustStats =
    previous !== null &&
    statsCache !== null &&
    statsCache.fingerprint === previous.index_fingerprint;

  const hashes = new Map<string, string>();
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const cached = canTrustStats ? statsCache.files[rel] : undefined;
    const prevMeta = previous?.files[rel];
    if (cached !== undefined && prevMeta !== undefined) {
      try {
        const st = fs.statSync(abs);
        if (st.size === cached.size && st.mtimeMs === cached.mtime_ms) {
          hashes.set(rel, prevMeta.hash);
          continue;
        }
      } catch {
        // Fall through to hashing; readFileSync surfaces the real error.
      }
    }
    hashes.set(rel, contentHash(fs.readFileSync(abs, "utf8")));
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
  const unresolvedByLanguage = new Map<string, UnresolvedMember[]>();
  const knownFiles = new Set(files);
  const fileMeta: CodeIndexManifest["files"] = {};
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const text = fs.readFileSync(abs, "utf8");
    const hash = hashes.get(rel)!;
    const extracted = await extractFile(rel, text, knownFiles);
    symbols.push(...extracted.symbols);
    references.push(...extracted.references);
    if (extracted.unresolvedMembers) {
      const language = grammarForFile(rel);
      const bucket = unresolvedByLanguage.get(language) ?? [];
      bucket.push(...extracted.unresolvedMembers);
      unresolvedByLanguage.set(language, bucket);
    }
    fileMeta[rel] = {
      hash,
      language: grammarForFile(rel),
      symbols: extracted.symbols.length,
    };
  }

  for (const [language, resolver] of CROSS_FILE_RESOLVERS) {
    const bucket = unresolvedByLanguage.get(language);
    if (bucket) references.push(...resolver(bucket, symbols));
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
  saveCodeIndexStats(vcsRoot, {
    fingerprint,
    files: Object.fromEntries(
      files.map((rel) => {
        const st = fs.statSync(path.join(vcsRoot, rel));
        return [rel, { size: st.size, mtime_ms: st.mtimeMs }];
      }),
    ),
  });

  return { status: "updated", indexed: files.length, changed: [...changed].sort() };
}