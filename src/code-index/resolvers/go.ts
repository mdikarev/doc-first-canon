// src/code-index/resolvers/go.ts
import type { CodeReference, CodeSymbol, UnresolvedMember } from "../types.js";

export function resolveGoSamePackageReferences(
  unresolved: UnresolvedMember[],
  symbols: CodeSymbol[],
): CodeReference[] {
  if (unresolved.length === 0) return [];
  const pkgByFile = new Map<string, string>();
  for (const s of symbols) {
    if (s.kind === "module") pkgByFile.set(s.file, s.name);
  }
  const index = new Map<string, Map<string, CodeSymbol[]>>();
  for (const s of symbols) {
    if (s.kind !== "struct" && s.kind !== "interface" && s.kind !== "type") continue;
    const pkg = pkgByFile.get(s.file);
    if (!pkg) continue;
    const dir = s.file.includes("/") ? s.file.slice(0, s.file.lastIndexOf("/")) : "";
    const key = `${dir}|${pkg}`;
    let byName = index.get(key);
    if (!byName) {
      byName = new Map();
      index.set(key, byName);
    }
    const arr = byName.get(s.name) ?? [];
    arr.push(s);
    byName.set(s.name, arr);
  }
  const out: CodeReference[] = [];
  for (const u of unresolved) {
    const pkg = pkgByFile.get(u.file);
    if (!pkg) continue;
    const dir = u.file.includes("/") ? u.file.slice(0, u.file.lastIndexOf("/")) : "";
    const candidates = index
      .get(`${dir}|${pkg}`)
      ?.get(u.typeName)
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
