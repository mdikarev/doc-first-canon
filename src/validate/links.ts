import fs from "node:fs";
import path from "node:path";

const MARKDOWN_LINK_RE = /(?<!!)\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

export function findBrokenCanonLinks(
  markdown: string,
  sourcePath: string,
  canonRoot: string,
): string[] {
  const broken: string[] = [];
  for (const match of markdown.matchAll(MARKDOWN_LINK_RE)) {
    const href = match[1]!;
    if (/^(?:[a-z]+:|\/|#)/i.test(href)) continue;

    const targetWithoutAnchor = href.split("#", 1)[0]!;
    if (!targetWithoutAnchor.toLowerCase().endsWith(".md")) continue;

    const target = path.resolve(path.dirname(sourcePath), targetWithoutAnchor);
    const relative = path.relative(canonRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) continue;
    if (!fs.existsSync(target)) {
      broken.push(`${path.relative(canonRoot, sourcePath)} links to missing ${href}`);
    }
  }
  return broken;
}
