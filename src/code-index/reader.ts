// src/code-index/reader.ts
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { loadCodeIndexPair } from "./io.js";
import { tryLoadCodeIndexStats } from "./stats.js";
import type { CodeIndexHandle } from "./types.js";

export function openCodeIndex(root: string): CodeIndexHandle {
  const { manifest, ast } = loadCodeIndexPair(root);
  return {
    symbols: () => ast.symbols,
    references: () => ast.references,
    manifest,
    liveHashes: () => {
      const config = loadCodeIndexConfig(root);
      const { vcsRoot, roots } = discoverSourceRoots(root, config);
      const files = listSourceFiles(vcsRoot, roots, config.ignore ?? []);
      const stats = tryLoadCodeIndexStats(vcsRoot);
      const canTrust =
        stats !== null && stats.fingerprint === manifest.index_fingerprint;
      const out: Record<string, string> = {};
      for (const rel of files) {
        const abs = path.join(vcsRoot, rel);
        const cached = canTrust ? stats.files[rel] : undefined;
        const prev = manifest.files[rel];
        if (cached !== undefined && prev !== undefined) {
          try {
            const st = fs.statSync(abs);
            if (st.size === cached.size && st.mtimeMs === cached.mtime_ms) {
              out[rel] = prev.hash;
              continue;
            }
          } catch {
            // Fall through to hashing.
          }
        }
        out[rel] = contentHash(fs.readFileSync(abs, "utf8"));
      }
      return out;
    },
  };
}