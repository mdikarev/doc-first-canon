import { acquireWatchPid, releaseWatchPid } from "./pid-lock.js";
import { syncCanonIndex } from "./sync.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isMissingCanon(error: unknown): boolean {
  return /docs\/canon not found/i.test(errorMessage(error));
}

export async function watchCanonIndex(
  root: string,
  intervalMs: number,
): Promise<number> {
  try {
    acquireWatchPid(root);
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
    releaseWatchPid(root);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    resolveDone(code);
  };
  const onSigint = () => finish(0);
  const onSigterm = () => finish(0);
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    const first = await syncCanonIndex(root);
    if (first.status === "updated") {
      console.log(`index updated: ${first.indexed} docs`);
    }
  } catch (error) {
    console.error(`error: ${errorMessage(error)}`);
    finish(1);
    return done;
  }

  timer = setInterval(() => {
    void syncCanonIndex(root)
      .then((result) => {
        if (result.status === "updated") {
          console.log(
            `index updated: ${result.indexed} docs (changed: ${result.changed.length})`,
          );
        }
      })
      .catch((error: unknown) => {
        console.error(`error: ${errorMessage(error)}`);
        if (isMissingCanon(error)) finish(1);
      });
  }, intervalMs);

  return done;
}
