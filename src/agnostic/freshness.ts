// src/agnostic/freshness.ts
export function isFresh(
  manifestFiles: Record<string, { hash: string }>,
  live: Record<string, string>,
): boolean {
  const manifestPaths = Object.keys(manifestFiles).sort();
  const livePaths = Object.keys(live).sort();
  if (manifestPaths.length !== livePaths.length) return false;
  for (let i = 0; i < manifestPaths.length; i++) {
    if (manifestPaths[i] !== livePaths[i]) return false;
    const p = manifestPaths[i]!;
    if (manifestFiles[p]!.hash !== live[p]) return false;
  }
  return true;
}
