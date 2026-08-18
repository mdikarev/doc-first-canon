// src/commands/code-index-cmd.ts
import { resolveRoot } from "../paths.js";
import { isPidAlive } from "../index/pid-lock.js";
import {
  readCodeIndexWatchPid,
  stopCodeIndexWatchPid,
} from "../code-index/pid-lock.js";
import { syncCodeIndex } from "../code-index/sync.js";
import { watchCodeIndex } from "../code-index/watch.js";

export type CodeIndexOptions = {
  watch?: boolean;
  stop?: boolean;
  interval?: string;
};

export async function codeIndexBuild(
  rootFlag: string,
  opts: CodeIndexOptions,
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
    const result = stopCodeIndexWatchPid(root);
    console.log(result.stopped ? `stopped pid ${result.pid}` : "not running");
    return 0;
  }
  if (opts.watch) {
    const intervalMs = opts.interval === undefined ? 2000 : Number(opts.interval);
    if (!Number.isFinite(intervalMs) || intervalMs < 200) {
      console.error("error: --interval must be a finite number of at least 200 ms");
      return 1;
    }
    return watchCodeIndex(root, intervalMs);
  }

  const watchPid = readCodeIndexWatchPid(root);
  if (watchPid !== null && isPidAlive(watchPid)) {
    console.error(`watch running (pid ${watchPid}); stop it or rely on watch`);
    return 1;
  }

  try {
    const result = await syncCodeIndex(root);
    console.log(
      `code-index ${result.status}: ${result.indexed} files` +
        (result.changed.length ? ` (changed: ${result.changed.length})` : ""),
    );
    return 0;
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
