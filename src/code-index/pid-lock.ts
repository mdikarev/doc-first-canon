// src/code-index/pid-lock.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { isPidAlive } from "../index/pid-lock.js";
import { codeIndexWatchPidPath } from "./paths.js";

export function readCodeIndexWatchPid(root: string): number | null {
  try {
    const pid = Number.parseInt(
      fs.readFileSync(codeIndexWatchPidPath(root), "utf8").trim(),
      10,
    );
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function acquireCodeIndexWatchPid(root: string): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  const pidPath = codeIndexWatchPidPath(root);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(pidPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}\n`);
      } finally {
        fs.closeSync(fd);
      }
      return;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existingPid = readCodeIndexWatchPid(root);
      if (existingPid !== null && isPidAlive(existingPid)) {
        throw new Error(`watch already running (pid ${existingPid})`);
      }
      if (attempt === 1) {
        throw new Error("could not acquire watch pid lock");
      }
      fs.rmSync(pidPath, { force: true });
    }
  }
}

export function releaseCodeIndexWatchPid(root: string): void {
  if (readCodeIndexWatchPid(root) === process.pid) {
    fs.rmSync(codeIndexWatchPidPath(root), { force: true });
  }
}

export function stopCodeIndexWatchPid(root: string): { stopped: boolean; pid?: number } {
  const pid = readCodeIndexWatchPid(root);
  if (pid !== null && isPidAlive(pid)) {
    process.kill(pid, "SIGTERM");
    return { stopped: true, pid };
  }
  fs.rmSync(codeIndexWatchPidPath(root), { force: true });
  return { stopped: false };
}
