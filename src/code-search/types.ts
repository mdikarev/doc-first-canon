// src/code-search/types.ts
import type { ReferenceKind, SymbolKind } from "../code-index/types.js";

export type CodeSearchSnippet = { start_line: number; text: string };

export type CodeSearchHit = {
  file: string;
  line: number;
  endLine: number;
  kind: string;
  name: string;
  signature: string;
  snippets: CodeSearchSnippet[];
};

export type CodeRefHit = {
  file: string; // = ref.from (referencing file, posix relative)
  line: number;
  refKind: ReferenceKind;
  name: string;
  from: string;
  to: string;
  snippets: CodeSearchSnippet[];
};

export type CodePack = {
  query: string;
  mode: "symbols" | "refs";
  freshness: "fresh" | "stale";
  warnings: string[];
  hits: CodeSearchHit[] | CodeRefHit[];
};

export type CodeSearchOptions = {
  maxHits?: number;
  snippetLines?: number;
  refs?: string;
  kind?: SymbolKind;
  file?: string;
};

export class CodeSearchError extends Error {
  readonly code: "empty_query" | "code_index_missing";
  constructor(code: CodeSearchError["code"], message: string) {
    super(message);
    this.name = "CodeSearchError";
    this.code = code;
  }
}
