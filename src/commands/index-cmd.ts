import { resolveRoot } from "../paths.js";
import {
  isPidAlive,
  readWatchPid,
  stopWatchPid,
} from "../index/pid-lock.js";
import { syncCanonIndex } from "../index/sync.js";
import { watchCanonIndex } from "../index/watch.js";

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
    const intervalMs = opts.interval === undefined ? 2000 : Number(opts.interval);
    if (!Number.isFinite(intervalMs) || intervalMs < 200) {
      console.error("error: --interval must be a finite number of at least 200 ms");
      return 1;
    }
    return watchCanonIndex(root, intervalMs);
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
