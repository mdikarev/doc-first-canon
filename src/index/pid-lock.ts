import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { indexWatchPidPath } from "./paths.js";

export function readWatchPid(root: string): number | null {
  try {
    const pid = Number.parseInt(fs.readFileSync(indexWatchPidPath(root), "utf8").trim(), 10);
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function isPidAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireWatchPid(root: string): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  const pidPath = indexWatchPidPath(root);
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
      const existingPid = readWatchPid(root);
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

export function releaseWatchPid(root: string): void {
  if (readWatchPid(root) === process.pid) {
    fs.rmSync(indexWatchPidPath(root), { force: true });
  }
}

export function stopWatchPid(root: string): { stopped: boolean; pid?: number } {
  const pid = readWatchPid(root);
  if (pid !== null && isPidAlive(pid)) {
    process.kill(pid, "SIGTERM");
    return { stopped: true, pid };
  }
  fs.rmSync(indexWatchPidPath(root), { force: true });
  return { stopped: false };
}
