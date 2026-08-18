import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Bm25Index } from "./bm25.js";
import { contentHash } from "./hash.js";
import { loadIndexPair, saveIndexPair, tryLoadManifest } from "./io.js";
import { listCanonMarkdown } from "./list.js";
import type { IndexDocMeta, IndexManifest } from "./types.js";

export const TOKENIZER_VERSION = "1";

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

  let previousManifest: IndexManifest | null = null;
  let previousDocs: Record<string, IndexDocMeta> = {};
  let loadedValidPair = false;
  if (tryLoadManifest(root)) {
    try {
      previousManifest = loadIndexPair(root).manifest;
      previousDocs = previousManifest.docs;
      loadedValidPair = true;
    } catch {
      // Corrupt or mismatched artifacts are rebuilt from the current corpus.
    }
  }
  const tokenizerChanged = previousManifest?.tokenizer_version !== TOKENIZER_VERSION;

  const changed = [
    ...paths.filter((docPath) => previousDocs[docPath]?.hash !== hashes.get(docPath)),
    ...Object.keys(previousDocs).filter((docPath) => !hashes.has(docPath)),
  ];

  if (loadedValidPair && !tokenizerChanged && changed.length === 0) {
    return { status: "fresh", indexed: paths.length, changed: [] };
  }

  const indexId = randomUUID();
  const bm25 = Bm25Index.build(docs, indexId);
  const manifest: IndexManifest = {
    schema_version: 1,
    index_id: indexId,
    built_at: new Date().toISOString(),
    corpus: "docs/canon/**",
    tokenizer_version: TOKENIZER_VERSION,
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
