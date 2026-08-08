export interface MarkdownHeading {
  level: number;
  text: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const CLOSING_ATX_RE = /\s+#+\s*$/;
const PLACEHOLDER_HEADING_RE = /^<.+>$/;

function normalizeHeadingText(raw: string): string {
  return raw.trim().replace(CLOSING_ATX_RE, "");
}

export function extractMarkdownHeadings(md: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  for (const line of md.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (!match) continue;
    headings.push({ level: match[1].length, text: normalizeHeadingText(match[2]) });
  }
  return headings;
}

export function requiredHeadingsFromTemplate(templateMd: string): string[] {
  return extractMarkdownHeadings(templateMd)
    .filter(
      (h) => h.level <= 3 && !PLACEHOLDER_HEADING_RE.test(h.text),
    )
    .map((h) => h.text);
}

export function assertRequiredHeadings(
  docMd: string,
  required: string[],
): string[] {
  const present = new Set(extractMarkdownHeadings(docMd).map((h) => h.text));
  return required.filter((text) => !present.has(text));
}
