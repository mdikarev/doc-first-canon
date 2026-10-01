import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Bm25Index } from "./bm25.js";
import { contentHash } from "./hash.js";
import { loadBm25, saveIndexPair, saveManifestOnly, tryLoadManifest } from "./io.js";
import { listCanonMarkdown } from "./list.js";
import { bm25IndexPath, indexManifestPath } from "./paths.js";
import type { IndexDocMeta, IndexManifest } from "./types.js";

export const TOKENIZER_VERSION = "1";

export type SyncResult = {
  status: "fresh" | "updated";
  indexed: number;
  changed: string[];
};

export async function syncCanonIndex(root: string): Promise<SyncResult> {
  const paths = listCanonMarkdown(root);

  // The manifest is the freshness source of truth. The bm25 artifact is trusted
  // without parsing only when its live stat still matches the manifest commit:
  // the recorded byte size equals the live size AND it was not rewritten after
  // the manifest (mtime ordering). Anything else — size drift, a later mtime, or
  // an old manifest without a recorded size — is deep-validated by parsing.
  // Comparing size (not only mtime) catches corruption that lands in the same
  // mtime tick as the manifest write on 1 ms-granularity filesystems, while the
  // common watch/idempotent tick still skips the full bm25 JSON parse.
  const previousManifest = tryLoadManifest(root);
  const tokenizerChanged = previousManifest?.tokenizer_version !== TOKENIZER_VERSION;

  let validPair = false;
  let pairTrustedByStat = false;
  if (previousManifest !== null) {
    try {
      const manifestMtime = fs.statSync(indexManifestPath(root)).mtimeMs;
      const bm25Stat = fs.statSync(bm25IndexPath(root));
      const recordedSize = previousManifest.bm25_size;
      if (
        typeof recordedSize === "number" &&
        bm25Stat.size === recordedSize &&
        bm25Stat.mtimeMs <= manifestMtime
      ) {
        validPair = true;
        pairTrustedByStat = true;
      } else {
        validPair = loadBm25(root).index_id === previousManifest.index_id;
      }
    } catch {
      // Missing manifest/bm25 artifact → rebuild from the current corpus.
      validPair = false;
      pairTrustedByStat = false;
    }
  }

  // Cheap stat pass: a matching (size, mtime_ms) proves the file is unchanged,
  // so its content is neither read nor hashed. Everything else is a candidate
  // that gets content-confirmed below (touch/checkout changes mtime, not
  // content). Old manifests without stat fields fall back to full hashing.
  const stats = new Map<string, { size: number; mtime_ms: number }>();
  const candidates: string[] = [];
  for (const docPath of paths) {
    const st = fs.statSync(path.join(root, docPath));
    const stat = { size: st.size, mtime_ms: st.mtimeMs };
    stats.set(docPath, stat);
    const prev = previousManifest?.docs[docPath];
    const statMatch =
      prev !== undefined &&
      typeof prev.size === "number" &&
      typeof prev.mtime_ms === "number" &&
      prev.size === stat.size &&
      prev.mtime_ms === stat.mtime_ms;
    if (!statMatch) candidates.push(docPath);
  }

  const changed = [...candidates];
  for (const prevPath of Object.keys(previousManifest?.docs ?? {})) {
    if (!paths.includes(prevPath)) changed.push(prevPath);
  }

  if (changed.length > 0 && previousManifest !== null && !tokenizerChanged) {
    // Content-confirm candidates so a stat-only change with identical content
    // (touch, checkout) does not trigger a rebuild.
    for (const docPath of candidates) {
      const prev = previousManifest.docs[docPath];
      if (prev === undefined) continue; // new doc → changed
      const text = fs.readFileSync(path.join(root, docPath), "utf8");
      if (contentHash(text) === prev.hash) {
        changed.splice(changed.indexOf(docPath), 1);
      }
    }
  }

  if (
    validPair &&
    previousManifest !== null &&
    !tokenizerChanged &&
    changed.length === 0
  ) {
    // Upgrade path: persist per-doc stat snapshots once (manifests written before
    // them forced full hashing) and refresh the recorded bm25 size whenever the
    // pair had to be deep-validated instead of stat-trusted. Subsequent ticks
    // (watch/idempotent) then skip reading, hashing, and parsing entirely. The
    // bm25 artifact is untouched, so the pair stays trusted.
    const needsStatsUpgrade = Object.values(previousManifest.docs).some(
      (meta) => typeof meta.size !== "number" || typeof meta.mtime_ms !== "number",
    );
    const liveBm25Size = fs.statSync(bm25IndexPath(root)).size;
    const needsPairUpgrade =
      !pairTrustedByStat || previousManifest.bm25_size !== liveBm25Size;
    if (needsStatsUpgrade || needsPairUpgrade) {
      saveManifestOnly(root, {
        ...previousManifest,
        bm25_size: liveBm25Size,
        docs: needsStatsUpgrade
          ? Object.fromEntries(
              paths.map((docPath) => {
                const stat = stats.get(docPath)!;
                const prev = previousManifest.docs[docPath];
                return [
                  docPath,
                  {
                    hash: prev.hash,
                    token_count: prev.token_count,
                    size: stat.size,
                    mtime_ms: stat.mtime_ms,
                  },
                ];
              }),
            )
          : previousManifest.docs,
      });
    }
    return { status: "fresh", indexed: paths.length, changed: [] };
  }

  // Full rebuild from the current corpus (deterministic by design).
  const docs = paths.map((docPath) => ({
    path: docPath,
    text: fs.readFileSync(path.join(root, docPath), "utf8"),
  }));
  const hashes = new Map(docs.map((doc) => [doc.path, contentHash(doc.text)]));

  const indexId = randomUUID();
  const bm25 = Bm25Index.build(docs, indexId);
  const manifest: IndexManifest = {
    schema_version: 1,
    index_id: indexId,
    built_at: new Date().toISOString(),
    corpus: "docs/canon/**",
    tokenizer_version: TOKENIZER_VERSION,
    docs: Object.fromEntries(
      paths.map((docPath) => {
        const stat = stats.get(docPath)!;
        const meta: IndexDocMeta = {
          hash: hashes.get(docPath)!,
          token_count: bm25.tokenCount(docPath),
          size: stat.size,
          mtime_ms: stat.mtime_ms,
        };
        return [docPath, meta];
      }),
    ),
  };
  saveIndexPair(root, manifest, bm25.toJSON());

  return { status: "updated", indexed: paths.length, changed };
}