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
        out[rel] = contentHash(fs.readFileSync(abs, "utf8"));
      }
      return out;
    },
  };
}
