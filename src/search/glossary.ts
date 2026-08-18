// src/search/glossary.ts
import fs from "node:fs";
import path from "node:path";
import { parseContractMarkdown } from "../contract/parse.js";
import { tokenize } from "../index/tokenize.js";
import { canonDir, contractPath } from "../paths.js";

export type GlossaryEntry = { term: string; tokens: string[] };

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const CLOSING_ATX_RE = /\s+#+\s*$/;

export function parseGlossary(text: string): Map<string, GlossaryEntry> {
  const entries = new Map<string, GlossaryEntry>();
  let inTerms = false;
  let currentTerm: string | null = null;
  const bodyTokens: string[] = [];

  const flush = (): void => {
    if (currentTerm !== null) {
      const tokens = [...new Set([...tokenize(currentTerm), ...bodyTokens])];
      entries.set(currentTerm, { term: currentTerm, tokens });
    }
    bodyTokens.length = 0;
  };

  for (const line of text.split("\n")) {
    const match = HEADING_RE.exec(line);
    if (match) {
      const level = match[1]!.length;
      const headingText = match[2]!.trim().replace(CLOSING_ATX_RE, "");
      if (level === 2) {
        flush();
        inTerms = headingText === "Terms";
        currentTerm = null;
      } else if (inTerms && level === 3) {
        flush();
        currentTerm = headingText;
      } else if (inTerms && level < 3) {
        flush();
        inTerms = false;
        currentTerm = null;
      }
    } else if (inTerms && currentTerm !== null && line.trim() !== "") {
      bodyTokens.push(...tokenize(line));
    }
  }
  flush();
  return entries;
}

export function loadGlossary(root: string): Map<string, GlossaryEntry> | null {
  try {
    const markdown = fs.readFileSync(contractPath(root), "utf8");
    const contract = parseContractMarkdown(markdown);
    const glossary = contract.sections.find((section) => section.role === "glossary");
    if (!glossary) return null;
    const glossaryFile = path.resolve(canonDir(root), glossary.path);
    const glossaryRelative = path.relative(canonDir(root), glossaryFile);
    if (
      glossaryRelative === ".." ||
      glossaryRelative.startsWith(`..${path.sep}`) ||
      path.isAbsolute(glossaryRelative)
    ) {
      return null;
    }
    return parseGlossary(fs.readFileSync(glossaryFile, "utf8"));
  } catch {
    return null;
  }
}

export function expandGlossaryQuery(
  query: string,
  glossary: Map<string, GlossaryEntry> | null,
): string {
  if (!glossary || glossary.size === 0) return query;
  const terms = tokenize(query);
  if (terms.length === 0) return query;
  const extra: string[] = [];
  for (const term of terms) {
    for (const entry of glossary.values()) {
      if (entry.tokens.includes(term)) {
        extra.push(...entry.tokens);
      }
    }
  }
  if (extra.length === 0) return query;
  return `${query} ${extra.join(" ")}`;
}
