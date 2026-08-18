// src/commands/code-index-search-cmd.ts
import { resolveRoot } from "../paths.js";
import {
  CodeSearchError,
  searchCodeIndex,
  type CodeRefHit,
  type CodeSearchHit,
} from "../code-search/search.js";
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

  const maxHits = Number(opts.maxHits ?? "10");
  const snippetLines = Number(opts.snippetLines ?? "4");
  if (!Number.isFinite(maxHits) || maxHits < 1) {
    console.error("error: --max-hits must be a positive number");
    return 1;
  }
  if (!Number.isFinite(snippetLines) || snippetLines < 1) {
    console.error("error: --snippet-lines must be a positive number");
    return 1;
  }

  try {
    const pack = searchCodeIndex(root, query ?? "", {
      maxHits,
      snippetLines,
      refs: opts.refs,
      kind: opts.kind as SymbolKind | undefined,
      file: opts.file,
    });

    if (opts.json) {
      console.log(JSON.stringify(pack));
      return 0;
    }

    if (pack.freshness === "stale") {
      console.error("warning: code_index_stale (run doc-canon code-index build to refresh)");
    }
    if (pack.hits.length === 0) {
      console.log("no hits");
      return 0;
    }
    if (pack.mode === "refs") {
      for (const hit of pack.hits as CodeRefHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.refKind}  ${hit.name}  → ${hit.to}`, hit.snippets);
      }
    } else {
      for (const hit of pack.hits as CodeSearchHit[]) {
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
