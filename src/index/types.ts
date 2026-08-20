export type IndexDocMeta = {
  hash: string;
  token_count: number;
  /** Stat snapshot used to skip re-hashing unchanged files (optional; absent in pre-0.7 manifests). */
  size?: number;
  mtime_ms?: number;
};

export type IndexManifest = {
  schema_version: 1;
  index_id: string;
  built_at: string;
  corpus: "docs/canon/**";
  docs: Record<string, IndexDocMeta>;
  tokenizer_version?: string;
};

export type Bm25State = {
  schema_version: 2;
  index_id: string;
  /** path → term → tf */
  postings: Record<string, Record<string, number>>;
  /** path → token count */
  doc_lengths: Record<string, number>;
  /** path → heading tokens */
  heading_terms?: Record<string, string[]>;
};