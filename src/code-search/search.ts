// src/code-search/search.ts
import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import { findVcsRoot } from "../code-index/discovery.js";
import { openCodeIndex } from "../code-index/reader.js";
import { isFresh } from "../agnostic/freshness.js";
import { centeredWindow, declarationWindow } from "./snippets.js";
import { tokenize } from "../index/tokenize.js";
import {
  CodeSearchError,
  type CodePack,
  type CodeRefHit,
  type CodeSearchHit,
  type CodeSearchOptions,
} from "./types.js";

export {
  CodeSearchError,
  type CodePack,
  type CodeRefHit,
  type CodeSearchHit,
  type CodeSearchOptions,
  type CodeSearchSnippet,
} from "./types.js";

const DEFAULTS = {
  maxHits: 10,
  snippetLines: 4,
  maxSnippetLinesTotal: 120,
} as const;

type MatchClass = 0 | 1 | 2 | 3;

function matchClass(name: string, signature: string, query: string): MatchClass | null {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const tokens = [...new Set(tokenize(q))];
  if (tokens.length === 0) return null;
  if (tokens.every((t) => n.includes(t))) return 2;
  if (tokens.every((t) => signature.toLowerCase().includes(t))) return 3;
  return null;
}

export function searchCodeIndex(
  root: string,
  query: string,
  options: CodeSearchOptions = {},
): CodePack {
  const refsMode = options.refs !== undefined;
  const effective = (refsMode ? options.refs! : query).trim();
  if (!effective) {
    throw new CodeSearchError("empty_query", "query must be non-empty");
  }

  let vcsRoot: string;
  let handle;
  try {
    vcsRoot = findVcsRoot(root);
    handle = openCodeIndex(vcsRoot);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CodeSearchError(
      "code_index_missing",
      `code index missing (${detail}); run: doc-canon code-index build`,
    );
  }

  const maxHits = options.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options.snippetLines ?? DEFAULTS.snippetLines;

  const live = handle.liveHashes();
  const fresh = isFresh(handle.manifest.files, live);
  const freshness = fresh ? "fresh" : "stale";
  const warnings = fresh ? [] : ["code_index_stale"];

  if (refsMode) {
    const refs = handle
      .references()
      .filter((r) => r.name === effective)
      .sort((a, b) => {
        if (a.from < b.from) return -1;
        if (a.from > b.from) return 1;
        return a.line - b.line;
      })
      .slice(0, maxHits);

    const hits: CodeRefHit[] = [];
    let usedLines = 0;
    for (const ref of refs) {
      const abs = path.join(vcsRoot, ...ref.from.split("/"));
      let content: string;
      try {
        content = fs.readFileSync(abs, "utf8");
      } catch {
        hits.push({
          file: ref.from,
          line: ref.line,
          refKind: ref.kind,
          name: ref.name,
          from: ref.from,
          to: ref.to,
          snippets: [],
        });
        continue;
      }
      const window = centeredWindow(content, ref.line, snippetLines);
      const n = window === null ? 0 : window.text.split("\n").length;
      hits.push({
        file: ref.from,
        line: ref.line,
        refKind: ref.kind,
        name: ref.name,
        from: ref.from,
        to: ref.to,
        snippets: window !== null && usedLines + n <= DEFAULTS.maxSnippetLinesTotal ? [window] : [],
      });
      if (window !== null) usedLines += n;
    }

    return { query: effective, mode: "refs", freshness, warnings, hits };
  }

  const symbols = handle
    .symbols()
    .filter((s) => matchClass(s.name, s.signature, effective) !== null)
    .filter((s) => options.kind === undefined || s.kind === options.kind)
    .filter((s) => options.file === undefined || micromatch.isMatch(s.file, options.file))
    .sort((a, b) => {
      const ca = matchClass(a.name, a.signature, effective)!;
      const cb = matchClass(b.name, b.signature, effective)!;
      if (ca !== cb) return ca - cb;
      if (a.file < b.file) return -1;
      if (a.file > b.file) return 1;
      return a.line - b.line;
    })
    .slice(0, maxHits);

  const hits: CodeSearchHit[] = [];
  let usedLines = 0;
  for (const sym of symbols) {
    const abs = path.join(vcsRoot, ...sym.file.split("/"));
    let content: string;
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch {
      hits.push({
        file: sym.file,
        line: sym.line,
        endLine: sym.endLine,
        kind: sym.kind,
        name: sym.name,
        signature: sym.signature,
        snippets: [],
      });
      continue;
    }
    const window = declarationWindow(content, sym.line, sym.endLine, snippetLines, options.body ?? false);
    const n = window === null ? 0 : window.text.split("\n").length;
    hits.push({
      file: sym.file,
      line: sym.line,
      endLine: sym.endLine,
      kind: sym.kind,
      name: sym.name,
      signature: sym.signature,
      snippets: window !== null && usedLines + n <= DEFAULTS.maxSnippetLinesTotal ? [window] : [],
    });
    if (window !== null) usedLines += n;
  }

  return { query: effective, mode: "symbols", freshness, warnings, hits };
}
