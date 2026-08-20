import fs from "node:fs";
import path from "node:path";
import { Bm25Index } from "./bm25.js";
import { contentHash } from "./hash.js";
import { loadIndexPair } from "./io.js";
import { listCanonMarkdown } from "./list.js";
import type { IndexManifest } from "./types.js";

export type CanonIndexHandle = {
  score(query: string): Array<{ path: string; score: number }>;
  manifest: IndexManifest;
  liveHashes(): Record<string, string>;
};

export function openCanonIndex(root: string): CanonIndexHandle {
  const { manifest, bm25 } = loadIndexPair(root);
  const index = Bm25Index.fromJSON(bm25);
  return {
    score: (query) => index.score(query),
    manifest,
    liveHashes: () => {
      const out: Record<string, string> = {};
      for (const rel of listCanonMarkdown(root)) {
        const abs = path.join(root, ...rel.split("/"));
        const prev = manifest.docs[rel];
        if (
          prev !== undefined &&
          typeof prev.size === "number" &&
          typeof prev.mtime_ms === "number"
        ) {
          try {
            const st = fs.statSync(abs);
            if (st.size === prev.size && st.mtimeMs === prev.mtime_ms) {
              out[rel] = prev.hash;
              continue;
            }
          } catch {
            // Fall through: hashing surfaces the real file error.
          }
        }
        out[rel] = contentHash(fs.readFileSync(abs, "utf8"));
      }
      return out;
    },
  };
}