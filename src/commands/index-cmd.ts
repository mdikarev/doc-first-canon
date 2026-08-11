import { resolveRoot } from "../paths.js";
import {
  isPidAlive,
  readWatchPid,
  stopWatchPid,
} from "../index/pid-lock.js";
import { syncCanonIndex } from "../index/sync.js";

export type IndexOptions = {
  watch?: boolean;
  stop?: boolean;
  interval?: string;
};

export async function indexCanon(
  rootFlag: string,
  opts: IndexOptions,
): Promise<number> {
  if (opts.watch && opts.stop) {
    console.error("error: --watch and --stop are mutually exclusive");
    return 1;
  }
  if (opts.interval !== undefined && !opts.watch) {
    console.error("error: --interval requires --watch");
    return 1;
  }

  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (opts.stop) {
    const result = stopWatchPid(root);
    console.log(result.stopped ? `stopped pid ${result.pid}` : "not running");
    return 0;
  }
  if (opts.watch) {
    console.error("error: --watch not implemented yet");
    return 1;
  }

  const watchPid = readWatchPid(root);
  if (watchPid !== null && isPidAlive(watchPid)) {
    console.error(`watch running (pid ${watchPid}); stop it or rely on watch`);
    return 1;
  }

  try {
    const result = await syncCanonIndex(root);
    console.log(
      `index ${result.status}: ${result.indexed} docs` +
        (result.changed.length ? ` (changed: ${result.changed.length})` : ""),
    );
    return 0;
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
