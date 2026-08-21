// src/code-search/search.ts
import fs from "node:fs";
import path from "node:path";
import micromatch from "micromatch";
import type { DatabaseSync } from "node:sqlite";
import { findVcsRoot } from "../code-index/discovery.js";
import { liveHashes } from "../code-index/reader.js";
import { tryLoadCodeIndexManifest } from "../code-index/io.js";
import { openCodeStore } from "../code-index/store.js";
import { isFresh } from "../agnostic/freshness.js";
import { centeredWindow, declarationWindow } from "./snippets.js";
import { tokenize } from "../index/tokenize.js";
import type { CodeIndexManifest, CodeSymbol } from "../code-index/types.js";
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

function symbolCandidates(db: DatabaseSync, query: string, opts: CodeSearchOptions, files: string[]): CodeSymbol[] {
  const qLower = query.toLowerCase();
  const tokens = [...new Set(tokenize(query))];
  if (tokens.length === 0) return [];
  const params: string[] = [];
  const clauses: string[] = [];

  // class 0/1 — exact + prefix over the pre-folded name (b-tree index).
  // Prefix pattern is bound as a whole ("prefix%") so SQLite's LIKE optimization
  // can range-scan symbols_name_lower (the "? || '%'" form forces a full scan).
  clauses.push("s.name_lower = ?", "s.name_lower LIKE ?");
  params.push(qLower, qLower + "%");

  // class 2/3 — every token a substring of name_lower or signature_lower.
  const ftsTokens = tokens.filter((t) => t.length >= 3);
  const likeTokens = tokens.filter((t) => t.length < 3);
  const sub: string[] = [];
  if (ftsTokens.length > 0) {
    sub.push("s.id IN (SELECT rowid FROM symbols_fts WHERE symbols_fts MATCH ?)");
    params.push(ftsTokens.map((t) => `"${t}"`).join(" "));
  }
  for (const t of likeTokens) {
    sub.push("(s.name_lower LIKE ? OR s.signature_lower LIKE ?)");
    params.push(`%${t}%`, `%${t}%`);
  }
  if (sub.length > 0) clauses.push("(" + sub.join(" AND ") + ")");

  let sql = "SELECT s.name, s.kind, s.signature, s.file, s.line, s.end_line, s.scope FROM symbols s WHERE (" +
    clauses.map((c) => `(${c})`).join(" OR ") + ")";

  if (opts.kind !== undefined) { sql += " AND s.kind = ?"; params.push(opts.kind); }
  if (opts.file !== undefined) {
    const matched = files.filter((f) => micromatch.isMatch(f, opts.file!));
    if (matched.length === 0) return [];
    sql += ` AND s.file IN (${matched.map(() => "?").join(", ")})`;
    params.push(...matched);
  }
  sql += " ORDER BY s.file, s.line, s.id";

  const rows = db.prepare(sql).all(...params) as Array<Record<string, unknown>>;
  return rows.map((r) => ({ name: r.name, kind: r.kind, signature: r.signature, file: r.file, line: r.line, endLine: r.end_line, scope: r.scope })) as CodeSymbol[];
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
  let manifest: CodeIndexManifest | null = null;
  let store: DatabaseSync | null = null;
  try {
    vcsRoot = findVcsRoot(root);
    manifest = tryLoadCodeIndexManifest(vcsRoot);
    if (manifest === null) throw new Error("code index manifest not found");
    store = openCodeStore(vcsRoot);
    store.exec("PRAGMA case_sensitive_like = ON;");
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new CodeSearchError(
      "code_index_missing",
      `code index missing (${detail}); run: doc-canon code-index build`,
    );
  }

  // The only non-throwing exit above assigns both manifest and store.
  const db = store!;
  const m = manifest!;

  const maxHits = options.maxHits ?? DEFAULTS.maxHits;
  const snippetLines = options.snippetLines ?? DEFAULTS.snippetLines;

  try {
    const live = liveHashes(vcsRoot, m);
    const fresh = isFresh(m.files, live);
    const freshness = fresh ? "fresh" : "stale";
    const warnings = fresh ? [] : ["code_index_stale"];

    if (refsMode) {
      const refs = db.prepare(
        "SELECT kind, from_file, to_file, name, line FROM refs WHERE name = ? ORDER BY from_file, line, rowid LIMIT ?",
      ).all(effective, maxHits) as Array<Record<string, unknown>>;

      const hits: CodeRefHit[] = [];
      let usedLines = 0;
      for (const ref of refs) {
        const from = ref.from_file as string;
        const to = ref.to_file as string;
        const refKind = ref.kind as CodeRefHit["refKind"];
        const name = ref.name as string;
        const line = ref.line as number;
        const abs = path.join(vcsRoot, ...from.split("/"));
        let content: string;
        try {
          content = fs.readFileSync(abs, "utf8");
        } catch {
          hits.push({
            file: from,
            line,
            refKind,
            name,
            from,
            to,
            snippets: [],
          });
          continue;
        }
        const window = centeredWindow(content, line, snippetLines);
        const n = window === null ? 0 : window.text.split("\n").length;
        hits.push({
          file: from,
          line,
          refKind,
          name,
          from,
          to,
          snippets: window !== null && usedLines + n <= DEFAULTS.maxSnippetLinesTotal ? [window] : [],
        });
        if (window !== null) usedLines += n;
      }

      return { query: effective, mode: "refs", freshness, warnings, hits };
    }

    const symbols = symbolCandidates(db, effective, options, Object.keys(m.files))
      .filter((s) => matchClass(s.name, s.signature, effective) !== null)
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
  } finally {
    db.close();
  }
}
