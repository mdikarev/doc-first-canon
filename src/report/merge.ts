import type { Finding, Report } from "./types.js";

export function nextFindingId(findings: Finding[]): string {
  let max = 0;
  for (const finding of findings) {
    const match = /^F-(\d+)$/.exec(finding.id);
    if (match) {
      max = Math.max(max, Number.parseInt(match[1], 10));
    }
  }
  return `F-${String(max + 1).padStart(3, "0")}`;
}

export function mergeCliFindings(
  existing: Report | null,
  cliFindings: Finding[],
): Report {
  const skillFindings = existing?.findings.filter((f) => f.source === "skill") ?? [];
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    findings: [...skillFindings, ...cliFindings],
  };
}
