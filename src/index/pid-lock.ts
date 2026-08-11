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
  const existingPid = readWatchPid(root);
  if (existingPid !== null && isPidAlive(existingPid)) {
    throw new Error(`watch already running (pid ${existingPid})`);
  }

  fs.mkdirSync(docCanonDir(root), { recursive: true });
  fs.writeFileSync(indexWatchPidPath(root), `${process.pid}\n`);
}

export function releaseWatchPid(root: string): void {
  fs.rmSync(indexWatchPidPath(root), { force: true });
}

export function stopWatchPid(root: string): { stopped: boolean; pid?: number } {
  const pid = readWatchPid(root);
  try {
    if (pid !== null && isPidAlive(pid)) {
      process.kill(pid, "SIGTERM");
      return { stopped: true, pid };
    }
    return { stopped: false };
  } finally {
    releaseWatchPid(root);
  }
}
