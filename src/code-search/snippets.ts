// src/code-search/snippets.ts
import type { CodeSearchSnippet } from "./types.js";

export function declarationWindow(
  content: string,
  line: number,
  endLine: number,
  snippetLines: number,
  body = false,
): CodeSearchSnippet | null {
  const lines = content.split("\n");
  const start = Math.max(1, line);
  if (start > lines.length) return null;
  const capped = body ? endLine : Math.min(endLine, start + snippetLines - 1);
  const end = Math.min(Math.max(capped, start), lines.length);
  if (end < start) return null;
  return { start_line: start, text: lines.slice(start - 1, end).join("\n") };
}

export function centeredWindow(
  content: string,
  line: number,
  snippetLines: number,
): CodeSearchSnippet | null {
  const lines = content.split("\n");
  const halfBefore = Math.floor((snippetLines - 1) / 2);
  let start = line - halfBefore;
  let end = start + snippetLines - 1;
  if (start < 1) {
    end += 1 - start;
    start = 1;
  }
  if (end > lines.length) {
    start -= end - lines.length;
    end = lines.length;
    if (start < 1) start = 1;
  }
  if (start < 1 || lines.length === 0) return null;
  return { start_line: start, text: lines.slice(start - 1, end).join("\n") };
}
