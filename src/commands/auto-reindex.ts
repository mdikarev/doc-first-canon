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
    await syncCanonIndex(root);
  } else {
    await syncCodeIndex(root);
  }
  return true;
}
