// src/search/snippets.ts
import { tokenize } from "../index/tokenize.js";

export type SnippetWindow = { start_line: number; text: string };

export function extractSnippetWindows(
  content: string,
  query: string,
  opts: { snippetLines: number; maxWindows: number },
): SnippetWindow[] {
  const lines = content.split("\n");
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0 || opts.maxWindows <= 0 || opts.snippetLines <= 0) {
    return [];
  }

  const matchLines: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const lineTokens = new Set(tokenize(lines[i]!));
    if (terms.some((t) => lineTokens.has(t))) {
      matchLines.push(i + 1);
    }
  }

  const windows: SnippetWindow[] = [];
  const covered = new Set<number>();

  for (const matchLine of matchLines) {
    if (windows.length >= opts.maxWindows) break;

    const halfBefore = Math.floor((opts.snippetLines - 1) / 2);
    let start = matchLine - halfBefore;
    let end = start + opts.snippetLines - 1;
    if (start < 1) {
      end += 1 - start;
      start = 1;
    }
    if (end > lines.length) {
      start -= end - lines.length;
      end = lines.length;
      if (start < 1) start = 1;
    }

    let overlaps = false;
    for (let line = start; line <= end; line++) {
      if (covered.has(line)) {
        overlaps = true;
        break;
      }
    }
    if (overlaps) continue;

    for (let line = start; line <= end; line++) covered.add(line);
    windows.push({
      start_line: start,
      text: lines.slice(start - 1, end).join("\n"),
    });
  }

  return windows;
}
