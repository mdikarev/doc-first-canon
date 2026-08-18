// src/code-index/reader.ts
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { loadCodeIndexPair } from "./io.js";
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
      const out: Record<string, string> = {};
      for (const rel of files) {
        out[rel] = contentHash(fs.readFileSync(path.join(vcsRoot, rel), "utf8"));
      }
      return out;
    },
  };
}
