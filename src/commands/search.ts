import { resolveRoot } from "../paths.js";
import { searchCanon, SearchError } from "../search/search.js";
import { refreshStaleIndex } from "./auto-reindex.js";
import { appendProbe } from "../probe-log.js";

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
    const runSearch = () => searchCanon(root, query, { maxHits, snippetLines });
    let served = runSearch();
    const reindexed = await refreshStaleIndex(root, "doc", served.freshness);
    if (reindexed) {
      served = runSearch();
      if (!served.warnings.includes("auto_reindexed")) {
        served.warnings = [...served.warnings, "auto_reindexed"];
      }
    }
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "doc",
      query: query.trim(),
      hits: served.hits.length,
      freshness: served.freshness,
      reindexed,
    });

    if (opts.json) {
      console.log(JSON.stringify(served));
    } else {
      if (reindexed) {
        console.error("warning: auto_reindexed (stale index rebuilt before serving)");
      }
      if (served.freshness === "stale") {
        console.error("warning: index_stale (run doc-canon index to refresh)");
      }
      if (served.hits.length === 0) {
        console.log("no hits");
      }
      for (const hit of served.hits) {
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
