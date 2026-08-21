// src/code-index/reader.ts
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { loadCodeIndexManifest } from "./io.js";
import { tryLoadCodeIndexStats } from "./stats.js";
import { computeContentFingerprint, openCodeStore } from "./store.js";
import type { CodeIndexHandle, CodeIndexManifest, CodeReference, CodeSymbol } from "./types.js";

export function liveHashes(root: string, manifest: CodeIndexManifest): Record<string, string> {
  const config = loadCodeIndexConfig(root);
  const { vcsRoot, roots } = discoverSourceRoots(root, config);
  const files = listSourceFiles(vcsRoot, roots, config.ignore ?? []);
  const stats = tryLoadCodeIndexStats(vcsRoot);
  const canTrust = stats !== null && stats.fingerprint === manifest.index_fingerprint;
  const out: Record<string, string> = {};
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const cached = canTrust ? stats.files[rel] : undefined;
    const prev = manifest.files[rel];
    if (cached !== undefined && prev !== undefined) {
      try {
        const st = fs.statSync(abs);
        if (st.size === cached.size && st.mtimeMs === cached.mtime_ms) { out[rel] = prev.hash; continue; }
      } catch { /* fall through */ }
    }
    out[rel] = contentHash(fs.readFileSync(abs, "utf8"));
  }
  return out;
}

export function openCodeIndex(root: string): CodeIndexHandle {
  const manifest = loadCodeIndexManifest(root);
  openCodeStore(root).close(); // identity/version check only (cheap)

  let verified = false;
  const verify = (): void => {
    if (verified) return;
    const db = openCodeStore(root);
    try {
      const fp = computeContentFingerprint(db);
      if (fp !== manifest.content_fingerprint) {
        throw new Error(`content_fingerprint mismatch: manifest=${manifest.content_fingerprint} store=${fp}`);
      }
    } finally { db.close(); }
    verified = true;
  };

  return {
    symbols: (): CodeSymbol[] => {
      verify();
      const db = openCodeStore(root);
      try {
        const rows = db.prepare("SELECT name, kind, signature, file, line, end_line, scope FROM symbols ORDER BY file, line").all() as Array<Record<string, unknown>>;
        return rows.map((r) => ({ name: r.name, kind: r.kind, signature: r.signature, file: r.file, line: r.line, endLine: r.end_line, scope: r.scope })) as CodeSymbol[];
      } finally { db.close(); }
    },
    references: (): CodeReference[] => {
      verify();
      const db = openCodeStore(root);
      try {
        const rows = db.prepare("SELECT kind, from_file, to_file, name, line FROM refs ORDER BY from_file, line").all() as Array<Record<string, unknown>>;
        return rows.map((r) => ({ kind: r.kind, from: r.from_file, to: r.to_file, name: r.name, line: r.line })) as CodeReference[];
      } finally { db.close(); }
    },
    manifest,
    liveHashes: () => liveHashes(root, manifest),
  };
}
