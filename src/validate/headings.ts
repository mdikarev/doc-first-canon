export interface MarkdownHeading {
  level: number;
  text: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;

export function extractMarkdownHeadings(md: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = [];
  for (const line of md.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (!match) continue;
    headings.push({ level: match[1].length, text: match[2].trim() });
  }
  return headings;
}

export function requiredHeadingsFromTemplate(templateMd: string): string[] {
  return extractMarkdownHeadings(templateMd)
    .filter((h) => h.level <= 3)
    .map((h) => h.text);
}

export function assertRequiredHeadings(
  docMd: string,
  required: string[],
): string[] {
  const present = new Set(extractMarkdownHeadings(docMd).map((h) => h.text));
  return required.filter((text) => !present.has(text));
}
