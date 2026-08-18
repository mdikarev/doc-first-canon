// src/code-index/resolvers/index.ts
import type { CodeReference, CodeSymbol, UnresolvedMember } from "../types.js";
import { resolveGoSamePackageReferences } from "./go.js";
import { resolveCSharpNamespaceReferences } from "./csharp.js";

export type CrossFileResolver = (
  unresolved: UnresolvedMember[],
  symbols: CodeSymbol[],
) => CodeReference[];

export const CROSS_FILE_RESOLVERS: ReadonlyMap<string, CrossFileResolver> = new Map([
  ["go", resolveGoSamePackageReferences],
  ["c-sharp", resolveCSharpNamespaceReferences],
]);
