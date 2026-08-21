// src/scout/types.ts
import type { PackSnippet } from "../search/types.js";

export type ScoutVerdict = "sufficient" | "need_more";

export type ScoutDocHit = {
  path: string;
  role: string;
  score: number;
  snippets: PackSnippet[];
};

export type ScoutCodeHit = {
  file: string;
  line: number;
  kind: string;
  name: string;
};

export type ScoutManifest = {
  query: string;
  verdict: ScoutVerdict;
  reason: string;
  docs: ScoutDocHit[];
  code?: ScoutCodeHit[];
  warnings: string[];
};

export type ScoutOptions = {
  maxHits?: number;
  snippetLines?: number;
  /** false = skip the code-index probe (--no-code). */
  code?: boolean;
};
