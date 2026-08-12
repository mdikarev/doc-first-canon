export type PackSnippet = { start_line: number; text: string };
export type PackHit = { path: string; score: number; snippets: PackSnippet[] };
export type PackResult = {
  query: string;
  index_id: string;
  freshness: "fresh" | "stale";
  warnings: string[];
  hits: PackHit[];
};

export type SearchCanonOptions = {
  maxHits?: number;
  snippetLines?: number;
  maxWindowsPerHit?: number;
  maxSnippetLinesTotal?: number;
};

export class SearchError extends Error {
  readonly code: "empty_query" | "index_unavailable";
  constructor(code: SearchError["code"], message: string) {
    super(message);
    this.name = "SearchError";
    this.code = code;
  }
}
