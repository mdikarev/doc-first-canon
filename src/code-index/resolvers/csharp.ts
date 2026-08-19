// src/code-index/resolvers/csharp.ts
import type { CodeReference, CodeSymbol, UnresolvedMember } from "../types.js";

export function resolveCSharpNamespaceReferences(
  unresolved: UnresolvedMember[],
  symbols: CodeSymbol[],
): CodeReference[] {
  if (unresolved.length === 0) return [];
  const nsByFile = new Map<string, string[]>();
  for (const s of symbols) {
    if (s.kind !== "module") continue;
    const arr = nsByFile.get(s.file);
    if (arr) {
      if (!arr.includes(s.name)) arr.push(s.name);
    } else {
      nsByFile.set(s.file, [s.name]);
    }
  }
  const index = new Map<string, CodeSymbol[]>();
  for (const s of symbols) {
    if (s.kind !== "class" && s.kind !== "interface" && s.kind !== "struct") continue;
    const nss = nsByFile.get(s.file);
    if (!nss) continue;
    for (const ns of nss) {
      const key = `${ns}|${s.name}`;
      const arr = index.get(key);
      if (arr) arr.push(s);
      else index.set(key, [s]);
    }
  }
  const out: CodeReference[] = [];
  for (const u of unresolved) {
    const own = nsByFile.get(u.file) ?? [];
    const target = u.namespaces ?? own;
    const pick = (nss: string[]): CodeSymbol | null => {
      const distinct: CodeSymbol[] = [];
      const seen = new Set<string>();
      for (const ns of nss) {
        for (const s of index.get(`${ns}|${u.typeName}`) ?? []) {
          if (s.file === u.file) continue;
          if (seen.has(s.file)) continue;
          seen.add(s.file);
          distinct.push(s);
        }
      }
      return distinct.length === 1 ? distinct[0] : null;
    };
    const ownInTarget = target.filter((ns) => own.includes(ns));
    const ownFirst = ownInTarget.length > 0 ? pick(ownInTarget) : null;
    const chosen = ownFirst ?? pick(target);
    if (chosen) {
      out.push({
        kind: "import",
        from: u.file,
        to: chosen.file,
        name: `${u.typeName}.${u.memberName}`,
        line: u.line,
      });
    }
  }
  return out;
}
