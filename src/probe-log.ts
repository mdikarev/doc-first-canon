// src/probe-log.ts
import fs from "node:fs";
import path from "node:path";
import { docCanonDir } from "./paths.js";

export type ProbeKind = "doc" | "code";
export type ProbeMode = "symbols" | "refs";

export interface ProbeEntry {
  ts: string;
  kind: ProbeKind;
  query: string;
  mode?: ProbeMode;
  hits: number;
  freshness: "fresh" | "stale";
  reindexed: boolean;
}

export const PROBE_LOG_TRIM = 1000;

export function probeLogPath(root: string): string {
  return path.join(docCanonDir(root), "probe-log.jsonl");
}

export function appendProbe(root: string, entry: ProbeEntry): void {
  try {
    fs.mkdirSync(docCanonDir(root), { recursive: true });
    fs.appendFileSync(probeLogPath(root), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Non-fatal: probe logging must never break search.
  }
}

function isProbeEntry(value: unknown): value is ProbeEntry {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.ts === "string" &&
    (v.kind === "doc" || v.kind === "code") &&
    typeof v.query === "string" &&
    typeof v.hits === "number"
  );
}

export function readProbeLog(root: string): ProbeEntry[] {
  let lines: string[];
  try {
    const raw = fs.readFileSync(probeLogPath(root), "utf8");
    lines = raw.split("\n").filter((l) => l.trim() !== "");
  } catch {
    return [];
  }
  const kept = lines.slice(-PROBE_LOG_TRIM);
  if (kept.length < lines.length) {
    try {
      fs.writeFileSync(probeLogPath(root), `${kept.join("\n")}\n`, "utf8");
    } catch {
      // Trim is best-effort.
    }
  }
  const entries: ProbeEntry[] = [];
  for (const line of kept) {
    try {
      const parsed: unknown = JSON.parse(line);
      // Shape guard: skip parseable-but-malformed lines (e.g. {}), not just bad JSON.
      if (isProbeEntry(parsed)) entries.push(parsed);
    } catch {
      // Skip corrupt lines.
    }
  }
  return entries;
}

export function lastProbeByKind(root: string, kind: ProbeKind): ProbeEntry | null {
  const entries = readProbeLog(root);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.kind === kind) return entries[i]!;
  }
  return null;
}
