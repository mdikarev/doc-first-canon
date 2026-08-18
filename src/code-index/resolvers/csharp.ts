// src/code-index/resolvers/csharp.ts
import type { CodeReference, CodeSymbol, UnresolvedMember } from "../types.js";

export function resolveCSharpNamespaceReferences(
  unresolved: UnresolvedMember[],
  symbols: CodeSymbol[],
): CodeReference[] {
  if (unresolved.length === 0) return [];
  const nsByFile = new Map<string, string>();
  for (const s of symbols) {
    if (s.kind === "module" && !nsByFile.has(s.file)) nsByFile.set(s.file, s.name);
  }
  const index = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    if (s.kind !== "class" && s.kind !== "interface" && s.kind !== "struct") continue;
    const ns = nsByFile.get(s.file);
    if (!ns) continue;
    const key = `${ns}|${s.name}`;
    const arr = index.get(key);
    if (arr) arr.push(s);
    else index.set(key, [s]);
  }
  const out: CodeReference[] = [];
  for (const u of unresolved) {
    const ns = nsByFile.get(u.file);
    if (!ns) continue;
    const candidates = index
      .get(`${ns}|${u.typeName}`)
      ?.filter((s) => s.file !== u.file) ?? [];
    const distinct = [...new Map(candidates.map((s) => [s.file, s] as const)).values()];
    if (distinct.length === 1) {
      out.push({
        kind: "import",
        from: u.file,
        to: distinct[0].file,
        name: `${u.typeName}.${u.memberName}`,
        line: u.line,
      });
    }
  }
  return out;
}
