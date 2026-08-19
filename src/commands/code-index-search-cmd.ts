// src/commands/code-index-search-cmd.ts
import { resolveRoot } from "../paths.js";
import {
  CodeSearchError,
  searchCodeIndex,
  type CodeRefHit,
  type CodeSearchHit,
} from "../code-search/search.js";
import { findVcsRoot } from "../code-index/discovery.js";
import { refreshStaleIndex } from "./auto-reindex.js";
import { appendProbe } from "../probe-log.js";
import type { SymbolKind } from "../code-index/types.js";

const SYMBOL_KINDS: readonly SymbolKind[] = [
  "class",
  "interface",
  "enum",
  "struct",
  "trait",
  "function",
  "method",
  "property",
  "module",
  "const",
  "type",
];

export type CodeIndexSearchOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
  kind?: string;
  file?: string;
  refs?: string;
  body?: boolean;
};

function printHitLines(header: string, snippets: { text: string }[]): void {
  console.log(header);
  for (const snip of snippets) {
    for (const line of snip.text.split("\n")) {
      console.log(`    ${line}`);
    }
  }
}

export async function codeIndexSearch(
  rootFlag: string,
  query: string | undefined,
  opts: CodeIndexSearchOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (opts.refs !== undefined) {
    if (query !== undefined) {
      console.error("error: --refs cannot be combined with a positional query");
      return 1;
    }
    if (opts.refs.trim() === "") {
      console.error("error: --refs requires a non-empty name");
      return 1;
    }
    if (opts.kind !== undefined || opts.file !== undefined) {
      console.error("error: --refs cannot be combined with --kind or --file");
      return 1;
    }
  } else if (query === undefined || query.trim() === "") {
    console.error("error: query required");
    return 1;
  }
  if (opts.kind !== undefined && !SYMBOL_KINDS.includes(opts.kind as SymbolKind)) {
    console.error(`error: unknown --kind ${opts.kind}`);
    return 1;
  }
  if (opts.body && opts.refs !== undefined) {
    console.error("error: --body cannot be combined with --refs");
    return 1;
  }

  const maxHits = Number(opts.maxHits ?? "10");
  const snippetLines = Number(opts.snippetLines ?? "4");
  if (!Number.isInteger(maxHits) || maxHits < 1) {
    console.error("error: --max-hits must be a positive integer");
    return 1;
  }
  if (!Number.isInteger(snippetLines) || snippetLines < 1) {
    console.error("error: --snippet-lines must be a positive integer");
    return 1;
  }

  try {
    const runSearch = () =>
      searchCodeIndex(root, query ?? "", {
        maxHits,
        snippetLines,
        refs: opts.refs,
        kind: opts.kind as SymbolKind | undefined,
        file: opts.file,
        body: opts.body,
      });
    let served = runSearch();
    const vcsRoot = findVcsRoot(root);
    const reindexed = await refreshStaleIndex(vcsRoot, "code", served.freshness);
    if (reindexed) {
      served = runSearch();
      if (!served.warnings.includes("auto_reindexed")) {
        served.warnings = [...served.warnings, "auto_reindexed"];
      }
    }
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "code",
      query: (opts.refs ?? query ?? "").trim(),
      mode: opts.refs !== undefined ? "refs" : "symbols",
      hits: served.hits.length,
      freshness: served.freshness,
      reindexed,
    });

    if (opts.json) {
      console.log(JSON.stringify(served));
      return 0;
    }

    if (reindexed) {
      console.error("warning: auto_reindexed (stale code index rebuilt before serving)");
    }
    if (served.freshness === "stale") {
      console.error("warning: code_index_stale (run doc-canon code-index build to refresh)");
    }
    if (served.hits.length === 0) {
      console.log("no hits");
      return 0;
    }
    if (served.mode === "refs") {
      for (const hit of served.hits as CodeRefHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.refKind}  ${hit.name}  → ${hit.to}`, hit.snippets);
      }
    } else {
      for (const hit of served.hits as CodeSearchHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.kind}  ${hit.name}`, hit.snippets);
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof CodeSearchError) {
      console.error(`error: ${error.message}`);
      return 1;
    }
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
