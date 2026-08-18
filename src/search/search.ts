import fs from "node:fs";
import path from "node:path";
import { isFresh } from "../agnostic/freshness.js";
import { openCanonIndex } from "../index/reader.js";
import { extractSnippetWindows } from "./snippets.js";
import {
  SearchError,
  type PackHit,
  type PackResult,
  type SearchCanonOptions,
} from "./types.js";

export {
  SearchError,
  type PackHit,
  type PackResult,
  type PackSnippet,
  type SearchCanonOptions,
} from "./types.js";

const DEFAULTS = {
  maxHits: 10,
  snippetLines: 4,
  maxWindowsPerHit: 2,
  maxSnippetLinesTotal: 120,
} as const;

export function searchCanon(
  root: string,
  query: string,
  options?: SearchCanonOptions,
): PackResult {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new SearchError("empty_query", "query must be non-empty");
  }

  let handle;
  try {
    handle = openCanonIndex(root);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new SearchError(
      "index_unavailable",
      `index unavailable (${detail}); run: doc-canon index`,
    );
  }

  const maxHits = options?.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options?.snippetLines ?? DEFAULTS.snippetLines;
  const maxWindowsPerHit = options?.maxWindowsPerHit ?? DEFAULTS.maxWindowsPerHit;
  const maxSnippetLinesTotal =
    options?.maxSnippetLinesTotal ?? DEFAULTS.maxSnippetLinesTotal;

  const live = handle.liveHashes();
  const fresh = isFresh(handle.manifest.docs, live);
  const freshness = fresh ? "fresh" : "stale";
  const warnings = fresh ? [] : ["index_stale"];

  const ranked = handle.score(trimmed).slice(0, maxHits);
  const hits: PackHit[] = [];
  let usedLines = 0;

  for (const { path: rel, score } of ranked) {
    const abs = path.join(root, ...rel.split("/"));
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      continue;
    }

    const windows = extractSnippetWindows(content, trimmed, {
      snippetLines,
      maxWindows: maxWindowsPerHit,
    });

    const snippets: PackHit["snippets"] = [];
    for (const w of windows) {
      const n = w.text.split("\n").length;
      if (usedLines + n > maxSnippetLinesTotal) break;
      snippets.push(w);
      usedLines += n;
    }

    hits.push({ path: rel, score, snippets });
  }

  return {
    query: trimmed,
    index_id: handle.manifest.index_id,
    freshness,
    warnings,
    hits,
  };
}
