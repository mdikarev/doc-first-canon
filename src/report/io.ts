import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { docCanonDir } from "../paths.js";
import type { Report } from "./types.js";

export function readReport(root: string): Report | null {
  const reportPath = path.join(docCanonDir(root), "report.json");
  if (!existsSync(reportPath)) return null;
  try {
    return JSON.parse(readFileSync(reportPath, "utf8")) as Report;
  } catch (error) {
    console.warn(
      `warning: Invalid ${reportPath}; ignoring it: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
}

export function writeReport(root: string, report: Report): void {
  const outputDirectory = docCanonDir(path.resolve(root));
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    path.join(outputDirectory, "report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8",
  );
}
