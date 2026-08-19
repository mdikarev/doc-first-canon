export type SymbolKind =
  | "class"
  | "interface"
  | "enum"
  | "struct"
  | "trait"
  | "function"
  | "method"
  | "property"
  | "module"
  | "const"
  | "type";

export type ReferenceKind = "anchor" | "import" | "binding";

export type CodeSymbol = {
  name: string;
  kind: SymbolKind;
  signature: string;
  file: string;
  line: number;
  endLine: number;
  scope: string;
};

export type CodeReference = {
  kind: ReferenceKind;
  from: string;
  to: string;
  name: string;
  line: number;
};

export type UnresolvedMember = {
  file: string;
  typeName: string;
  memberName: string;
  line: number;
  namespaces?: string[];
};

export type ExtractResult = {
  symbols: CodeSymbol[];
  references: CodeReference[];
  unresolvedMembers?: UnresolvedMember[];
};

export type CodeIndexFileMeta = {
  hash: string;
  language: string;
  symbols: number;
};

export type CodeIndexManifest = {
  schema_version: 1;
  index_fingerprint: string;
  corpus: string;
  grammar_versions: Record<string, string>;
  roots: string[];
  files: Record<string, CodeIndexFileMeta>;
};

export type CodeAstIndex = {
  schema_version: 1;
  index_fingerprint: string;
  symbols: CodeSymbol[];
  references: CodeReference[];
};

export type CodeIndexConfig = {
  roots?: string[];
  ignore?: string[];
  languages?: Record<string, string>;
};

export type CodeSyncResult = {
  status: "fresh" | "updated";
  indexed: number;
  changed: string[];
};

export type CodeIndexHandle = {
  symbols(): CodeSymbol[];
  references(): CodeReference[];
  manifest: CodeIndexManifest;
  liveHashes(): Record<string, string>;
};
