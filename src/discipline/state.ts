// src/discipline/state.ts
import fs from "node:fs";
import path from "node:path";
import { listCanonMarkdown } from "../index/list.js";
import { contentHash } from "../index/hash.js";
import { tryLoadManifest } from "../index/io.js";
import { indexManifestPath } from "../index/paths.js";
import { findVcsRoot } from "../code-index/discovery.js";
import { openCodeIndex } from "../code-index/reader.js";
import { codeIndexManifestPath } from "../code-index/paths.js";
import type { CodeIndexHandle } from "../code-index/types.js";
import { lastProbeByKind, type ProbeEntry } from "../probe-log.js";

export interface KindState {
  indexExists: boolean;
  changed: string[];
  lastProbe: ProbeEntry | null;
  unprobed: boolean;
  corrupt: boolean;
}

export interface DisciplineState {
  doc: KindState;
  code: KindState;
}

function notApplicable(): KindState {
  return { indexExists: false, changed: [], lastProbe: null, unprobed: false, corrupt: false };
}

function corrupt(): KindState {
  return { indexExists: true, changed: [], lastProbe: null, unprobed: false, corrupt: true };
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
  if (!fs.existsSync(indexManifestPath(root))) {
    // No index → not-applicable (nothing to enforce).
    return notApplicable();
  }
  try {
    const manifest = tryLoadManifest(root);
    if (manifest === null) {
      // Manifest exists but is unreadable → corrupt, not not-applicable.
      return corrupt();
    }
    const paths = listCanonMarkdown(root);
    const hashes = new Set(paths);
    const changed = [
      ...paths.filter(
        (p) => manifest.docs[p]?.hash !== contentHash(fs.readFileSync(path.join(root, p), "utf8")),
      ),
      // Deleted canon docs: manifest keys absent from the on-disk set are changed.
      ...Object.keys(manifest.docs).filter((docPath) => !hashes.has(docPath)),
    ];
    const lastProbe = lastProbeByKind(root, "doc");
    return {
      indexExists: true,
      changed,
      lastProbe,
      unprobed: changedAfterProbe(changed, root, lastProbe),
      corrupt: false,
    };
  } catch {
    // Fail-soft toward the gate: with the manifest present, any state-computation
    // error (missing docs/canon, unreadable file) means the index cannot be verified.
    return corrupt();
  }
}

export function computeCodeState(root: string): KindState {
  let vcsRoot: string;
  try {
    vcsRoot = findVcsRoot(root);
  } catch {
    // No VCS root → not-applicable.
    return notApplicable();
  }
  if (!fs.existsSync(codeIndexManifestPath(vcsRoot))) {
    // No code index → not-applicable.
    return notApplicable();
  }
  let handle: CodeIndexHandle;
  try {
    handle = openCodeIndex(vcsRoot);
  } catch {
    // Manifest exists but the index pair is unreadable → corrupt.
    return corrupt();
  }
  try {
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
      corrupt: false,
    };
  } catch {
    // Fail-soft toward the gate: a live-hash error (unreadable code-index.json
    // config, missing source root, unreadable file) means the index cannot be
    // verified — report corrupt instead of crashing discipline/check.
    return corrupt();
  }
}

export function computeDisciplineState(root: string): DisciplineState {
  return { doc: computeDocState(root), code: computeCodeState(root) };
}
