export type IndexDocMeta = { hash: string; token_count: number };

export type IndexManifest = {
  schema_version: 1;
  index_id: string;
  built_at: string;
  corpus: "docs/canon/**";
  docs: Record<string, IndexDocMeta>;
};

export type Bm25State = {
  schema_version: 1;
  index_id: string;
  /** path → term → tf */
  postings: Record<string, Record<string, number>>;
  /** path → token count */
  doc_lengths: Record<string, number>;
};
