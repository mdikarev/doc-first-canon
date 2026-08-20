// src/code-index/stats.ts
// Internal stat cache that lets freshness checks (search, discipline, watch)
// skip re-reading and re-hashing unchanged source files. It is deliberately NOT
// part of the deterministic dual artifact (code-index-manifest + code-ast-index
// stay byte-identical across rebuilds): it is keyed by the manifest fingerprint,
// and readers fall back to full content hashing when it is absent or stale.
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { codeIndexStatsPath } from "./paths.js";

export type CodeIndexStats = {
  fingerprint: string;
  files: Record<string, { size: number; mtime_ms: number }>;
};

export function saveCodeIndexStats(root: string, stats: CodeIndexStats): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  const target = codeIndexStatsPath(root);
  const tmp = `${target}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(stats, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, target);
}

export function tryLoadCodeIndexStats(root: string): CodeIndexStats | null {
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(codeIndexStatsPath(root), "utf8"),
    );
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return null;
    }
    const record = raw as Record<string, unknown>;
    if (
      typeof record.fingerprint !== "string" ||
      typeof record.files !== "object" ||
      record.files === null ||
      Array.isArray(record.files)
    ) {
      return null;
    }
    for (const meta of Object.values(record.files)) {
      if (typeof meta !== "object" || meta === null || Array.isArray(meta)) {
        return null;
      }
      const m = meta as Record<string, unknown>;
      if (typeof m.size !== "number" || typeof m.mtime_ms !== "number") {
        return null;
      }
    }
    return raw as CodeIndexStats;
  } catch {
    return null;
  }
}
