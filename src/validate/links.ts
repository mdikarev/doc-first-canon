import fs from "node:fs";
import path from "node:path";
import type { ValidationIssue } from "./types.js";

const MARKDOWN_LINK_RE = /(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function findBrokenCanonLinks(
  markdown: string,
  sourcePath: string,
  canonRoot: string,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    const href = match[1]!;
    if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;

    const targetWithoutAnchor = href.split("#", 1)[0]!;
    if (!targetWithoutAnchor.toLowerCase().endsWith(".md")) continue;

    const target = path.resolve(path.dirname(sourcePath), targetWithoutAnchor);
    const relative = path.relative(canonRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (!fs.existsSync(target)) {
      const sourceRelative = path.relative(canonRoot, sourcePath);
      issues.push({
        message: `${sourceRelative} links to missing ${href}`,
        kind: "consistency",
        paths: [sourceRelative, targetWithoutAnchor],
        severity: "error",
      });
    }
  }
  return issues;
}
