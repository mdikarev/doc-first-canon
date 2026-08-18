// src/code-index/extractors/index.ts
import {
  extractFile as extractTsFile,
  grammarForFile as tsGrammarForFile,
} from "./typescript.js";
import {
  extractFile as extractGoFile,
  grammarForFile as goGrammarForFile,
} from "./go.js";
import {
  extractFile as extractCsFile,
  grammarForFile as csGrammarForFile,
} from "./csharp.js";
import {
  extractFile as extractRsFile,
  grammarForFile as rsGrammarForFile,
} from "./rust.js";
import {
  extractFile as extractPyFile,
  grammarForFile as pyGrammarForFile,
} from "./python.js";
import type { CodeReference, CodeSymbol } from "../types.js";

export function grammarForFile(rel: string): string {
  if (rel.endsWith(".go")) return goGrammarForFile(rel);
  if (rel.endsWith(".cs")) return csGrammarForFile(rel);
  if (rel.endsWith(".rs")) return rsGrammarForFile(rel);
  if (rel.endsWith(".py")) return pyGrammarForFile(rel);
  return tsGrammarForFile(rel);
}

export async function extractFile(
  rel: string,
  text: string,
  knownFiles: Set<string>,
): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }> {
  if (rel.endsWith(".go")) return extractGoFile(rel, text, knownFiles);
  if (rel.endsWith(".cs")) return extractCsFile(rel, text, knownFiles);
  if (rel.endsWith(".rs")) return extractRsFile(rel, text, knownFiles);
  if (rel.endsWith(".py")) return extractPyFile(rel, text, knownFiles);
  return extractTsFile(rel, text, knownFiles);
}
