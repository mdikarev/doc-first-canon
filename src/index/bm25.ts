import { tokenize } from "./tokenize.js";
import type { Bm25State } from "./types.js";

const K1 = 1.2;
const B = 0.75;

/**
 * Okapi BM25 (k1=1.2, b=0.75).
 *
 * idf(t) = ln(1 + (N - df + 0.5) / (df + 0.5))
 *
 * Per-term contribution for a doc d:
 *   idf(t) * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * |d| / avgdl))
 *
 * `df` (documents containing t), `avgdl` (average doc length), and `N`
 * (document count) are derived from `postings` + `doc_lengths` at score
 * time rather than stored, so `fromJSON` needs no extra precomputed state.
 */
export class Bm25Index {
  private constructor(
    private readonly indexId: string,
    /** path → term → tf */
    private readonly postings: Record<string, Record<string, number>>,
    /** path → token count */
    private readonly docLengths: Record<string, number>,
  ) {}

  static build(
    docs: Array<{ path: string; text: string }>,
    indexId: string,
  ): Bm25Index {
    const postings: Record<string, Record<string, number>> = {};
    const docLengths: Record<string, number> = {};

    for (const { path, text } of docs) {
      const tokens = tokenize(text);
      const tf: Record<string, number> = {};
      for (const token of tokens) {
        tf[token] = (tf[token] ?? 0) + 1;
      }
      postings[path] = tf;
      docLengths[path] = tokens.length;
    }

    return new Bm25Index(indexId, postings, docLengths);
  }

  static fromJSON(state: Bm25State): Bm25Index {
    return new Bm25Index(state.index_id, state.postings, state.doc_lengths);
  }

  toJSON(): Bm25State {
    return {
      schema_version: 1,
      index_id: this.indexId,
      postings: this.postings,
      doc_lengths: this.docLengths,
    };
  }

  documentCount(): number {
    return Object.keys(this.docLengths).length;
  }

  tokenCount(path: string): number {
    return this.docLengths[path] ?? 0;
  }

  score(query: string): Array<{ path: string; score: number }> {
    const queryTerms = [...new Set(tokenize(query))];
    const paths = Object.keys(this.docLengths);
    const N = paths.length;
    if (queryTerms.length === 0 || N === 0) {
      return [];
    }

    const avgdl =
      paths.reduce((sum, path) => sum + this.docLengths[path]!, 0) / N;

    const dfByTerm = new Map<string, number>();
    for (const term of queryTerms) {
      let df = 0;
      for (const path of paths) {
        if ((this.postings[path]?.[term] ?? 0) > 0) df += 1;
      }
      dfByTerm.set(term, df);
    }

    const results: Array<{ path: string; score: number }> = [];
    for (const path of paths) {
      const docLen = this.docLengths[path]!;
      let score = 0;
      for (const term of queryTerms) {
        const tf = this.postings[path]?.[term] ?? 0;
        if (tf === 0) continue;
        const df = dfByTerm.get(term)!;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const numerator = tf * (K1 + 1);
        const denominator = tf + K1 * (1 - B + (B * docLen) / avgdl);
        score += (idf * numerator) / denominator;
      }
      if (score > 0) {
        results.push({ path, score });
      }
    }

    results.sort((a, b) => b.score - a.score || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return results;
  }
}
