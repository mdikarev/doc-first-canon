// src/commands/auto-reindex.ts
import { isPidAlive, readWatchPid } from "../index/pid-lock.js";
import { readCodeIndexWatchPid } from "../code-index/pid-lock.js";
import { syncCanonIndex } from "../index/sync.js";
import { syncCodeIndex } from "../code-index/sync.js";

export type IndexKind = "doc" | "code";

export function watchOwnsIndex(root: string, kind: IndexKind): boolean {
  const pid = kind === "doc" ? readWatchPid(root) : readCodeIndexWatchPid(root);
  return pid !== null && isPidAlive(pid);
}

/** Rebuilds a stale index when no watch owns it; returns true iff it rebuilt. */
export async function refreshStaleIndex(
  root: string,
  kind: IndexKind,
  freshness: "fresh" | "stale",
): Promise<boolean> {
  if (freshness !== "stale") return false;
  if (watchOwnsIndex(root, kind)) return false;
  if (kind === "doc") {
    try {
      await syncCanonIndex(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; run doc-canon index manually`);
    }
  } else {
    try {
      await syncCodeIndex(root);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`${message}; run doc-canon code-index build manually`);
    }
  }
  return true;
}
