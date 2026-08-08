import { resolveRoot } from "../paths.js";
import { readReport } from "../report/io.js";

export function printReport(root: string): number {
  const resolvedRoot = resolveRoot(process.cwd(), root);
  const report = readReport(resolvedRoot);
  if (!report) {
    console.error("No valid .doc-canon/report.json found");
    return 1;
  }
  console.log(JSON.stringify(report, null, 2));
  return 0;
}
