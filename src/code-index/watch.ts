// src/code-index/watch.ts
import { acquireCodeIndexWatchPid, releaseCodeIndexWatchPid } from "./pid-lock.js";
import { syncCodeIndex } from "./sync.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function watchCodeIndex(
  root: string,
  intervalMs: number,
): Promise<number> {
  try {
    acquireCodeIndexWatchPid(root);
  } catch (error) {
    console.error(`error: ${errorMessage(error)}`);
    return 1;
  }

  let timer: NodeJS.Timeout | undefined;
  let finished = false;
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (code: number): void => {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    releaseCodeIndexWatchPid(root);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    resolveDone(code);
  };
  const onSigint = () => finish(0);
  const onSigterm = () => finish(0);
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    const first = await syncCodeIndex(root);
    if (first.status === "updated") {
      console.log(`code-index updated: ${first.indexed} files`);
    }
  } catch (error) {
    console.error(`error: ${errorMessage(error)}`);
    finish(1);
    return done;
  }

  timer = setInterval(() => {
    void syncCodeIndex(root)
      .then((result) => {
        if (result.status === "updated") {
          console.log(
            `code-index updated: ${result.indexed} files (changed: ${result.changed.length})`,
          );
        }
      })
      .catch((error: unknown) => {
        console.error(`error: ${errorMessage(error)}`);
        if (/VCS root|\.git/.test(errorMessage(error))) finish(1);
      });
  }, intervalMs);

  return done;
}
