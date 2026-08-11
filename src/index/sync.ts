import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Bm25Index } from "./bm25.js";
import { contentHash } from "./hash.js";
import { loadIndexPair, saveIndexPair, tryLoadManifest } from "./io.js";
import { listCanonMarkdown } from "./list.js";
import type { IndexDocMeta, IndexManifest } from "./types.js";

export type SyncResult = {
  status: "fresh" | "updated";
  indexed: number;
  changed: string[];
};

export async function syncCanonIndex(root: string): Promise<SyncResult> {
  const paths = listCanonMarkdown(root);
  const docs = paths.map((docPath) => ({
    path: docPath,
    text: fs.readFileSync(path.join(root, docPath), "utf8"),
  }));
  const hashes = new Map(docs.map((doc) => [doc.path, contentHash(doc.text)]));

  let previousDocs: Record<string, IndexDocMeta> = {};
  if (tryLoadManifest(root)) {
    try {
      previousDocs = loadIndexPair(root).manifest.docs;
    } catch {
      // Corrupt or mismatched artifacts are rebuilt from the current corpus.
    }
  }

  const changed = [
    ...paths.filter((docPath) => previousDocs[docPath]?.hash !== hashes.get(docPath)),
    ...Object.keys(previousDocs).filter((docPath) => !hashes.has(docPath)),
  ];

  if (changed.length === 0) {
    return { status: "fresh", indexed: paths.length, changed: [] };
  }

  const indexId = randomUUID();
  const bm25 = Bm25Index.build(docs, indexId);
  const manifest: IndexManifest = {
    schema_version: 1,
    index_id: indexId,
    built_at: new Date().toISOString(),
    corpus: "docs/canon/**",
    docs: Object.fromEntries(
      paths.map((docPath) => [
        docPath,
        { hash: hashes.get(docPath)!, token_count: bm25.tokenCount(docPath) },
      ]),
    ),
  };
  saveIndexPair(root, manifest, bm25.toJSON());

  return { status: "updated", indexed: paths.length, changed };
}
