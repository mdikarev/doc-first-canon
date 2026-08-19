// src/discipline/state.ts
import fs from "node:fs";
import path from "node:path";
import { listCanonMarkdown } from "../index/list.js";
import { contentHash } from "../index/hash.js";
import { tryLoadManifest } from "../index/io.js";
import { findVcsRoot } from "../code-index/discovery.js";
import { openCodeIndex } from "../code-index/reader.js";
import { lastProbeByKind, type ProbeEntry } from "../probe-log.js";

export interface KindState {
  indexExists: boolean;
  changed: string[];
  lastProbe: ProbeEntry | null;
  unprobed: boolean;
}

export interface DisciplineState {
  doc: KindState;
  code: KindState;
}

function changedAfterProbe(
  changed: string[],
  baseDir: string,
  probe: ProbeEntry | null,
): boolean {
  if (changed.length === 0) return false;
  if (probe === null) return true;
  const probeTs = Date.parse(probe.ts);
  if (Number.isNaN(probeTs)) return true;
  return changed.some((rel) => {
    try {
      return fs.statSync(path.join(baseDir, rel)).mtimeMs > probeTs;
    } catch {
      return true;
    }
  });
}

export function computeDocState(root: string): KindState {
  const manifest = tryLoadManifest(root);
  if (manifest === null) {
    return { indexExists: false, changed: [], lastProbe: null, unprobed: false };
  }
  const paths = listCanonMarkdown(root);
  const changed = paths.filter(
    (p) => manifest.docs[p]?.hash !== contentHash(fs.readFileSync(path.join(root, p), "utf8")),
  );
  const lastProbe = lastProbeByKind(root, "doc");
  return {
    indexExists: true,
    changed,
    lastProbe,
    unprobed: changedAfterProbe(changed, root, lastProbe),
  };
}

export function computeCodeState(root: string): KindState {
  try {
    const vcsRoot = findVcsRoot(root);
    const handle = openCodeIndex(vcsRoot);
    const live = handle.liveHashes();
    const manifestFiles = handle.manifest.files;
    const changed = [
      ...Object.keys(manifestFiles).filter((rel) => manifestFiles[rel]!.hash !== live[rel]),
      ...Object.keys(live).filter((rel) => manifestFiles[rel] === undefined),
    ];
    const lastProbe = lastProbeByKind(root, "code");
    return {
      indexExists: true,
      changed,
      lastProbe,
      unprobed: changedAfterProbe(changed, vcsRoot, lastProbe),
    };
  } catch {
    return { indexExists: false, changed: [], lastProbe: null, unprobed: false };
  }
}

export function computeDisciplineState(root: string): DisciplineState {
  return { doc: computeDocState(root), code: computeCodeState(root) };
}
