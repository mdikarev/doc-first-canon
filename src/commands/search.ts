import { resolveRoot } from "../paths.js";
import { searchCanon, SearchError } from "../search/search.js";

export type SearchCliOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
};

export async function searchCanonCli(
  rootFlag: string,
  query: string | undefined,
  opts: SearchCliOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (query === undefined) {
    console.error("error: query required");
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
    const pack = searchCanon(root, query, { maxHits, snippetLines });
    if (opts.json) {
      console.log(JSON.stringify(pack));
    } else {
      if (pack.freshness === "stale") {
        console.error("warning: index_stale (run doc-canon index to refresh)");
      }
      if (pack.hits.length === 0) {
        console.log("no hits");
      }
      for (const hit of pack.hits) {
        console.log(`${hit.path}  score=${hit.score}`);
        for (const snip of hit.snippets) {
          console.log(`  L${snip.start_line}:`);
          for (const line of snip.text.split("\n")) {
            console.log(`    ${line}`);
          }
        }
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof SearchError) {
      console.error(`error: ${error.message}`);
      return 1;
    }
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
