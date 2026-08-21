// src/commands/scout.ts
import { resolveRoot } from "../paths.js";
import { SearchError } from "../search/search.js";
import { buildScoutManifest } from "../scout/build.js";

export type ScoutCliOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
  code?: boolean;
};

export async function scoutCanonCli(
  rootFlag: string,
  query: string | undefined,
  opts: ScoutCliOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (query === undefined || query.trim() === "") {
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
    const manifest = await buildScoutManifest(root, query.trim(), {
      maxHits,
      snippetLines,
      code: opts.code === false ? false : undefined,
    });

    if (opts.json) {
      console.log(JSON.stringify(manifest));
      return 0;
    }

    for (const warning of manifest.warnings) {
      console.error(`warning: ${warning}`);
    }
    console.log(`verdict: ${manifest.verdict} (${manifest.reason})`);
    for (const hit of manifest.docs) {
      console.log(`${hit.path}  score=${hit.score}  role=${hit.role}`);
      for (const snip of hit.snippets) {
        console.log(`  L${snip.start_line}:`);
        for (const line of snip.text.split("\n")) {
          console.log(`    ${line}`);
        }
      }
    }
    if (manifest.code) {
      for (const hit of manifest.code) {
        console.log(`code: ${hit.file}  L${hit.line}  ${hit.kind}  ${hit.name}`);
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
