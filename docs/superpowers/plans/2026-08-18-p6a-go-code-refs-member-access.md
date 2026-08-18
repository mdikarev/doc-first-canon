# P6a-Go Code-refs Member-Access Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `Type.method`-named member-access reference edges in the Go code-index extractor for bindings initialized from composite/pointer struct literals (`x := &T{}`, `x := T{}`, `var x = T{}`), plus a same-package resolution pass — unblocking `code-index search --refs Type.method` for Go.

**Architecture:** In `src/code-index/extractors/go.ts`, two new per-file CST passes: `collectCompositeLiteralBindings` maps a local binding to its literal type (`T` or `reader.Handle`), and `collectMemberAccessEdges` emits `import`-kind edges named `<Type>.<member>` for `selector_expression`s whose object is such a binding. Same-file types and qualified imports resolve inside the extractor; unqualified types not declared in the file surface as `unresolvedMembers` and are resolved by a new deterministic post-processing pass `resolveGoSamePackageReferences` in `sync.ts`. Query side (`searchCodeIndex`) is unchanged — refs matching is already exact `r.name === effective`.

**Tech Stack:** TypeScript (NodeNext ESM), `@vscode/tree-sitter-wasm` Go grammar, `node:test` + `tsx`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-18-p6a-go-code-refs-member-access-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Index schema unchanged: `schema_version` 1, `ReferenceKind = anchor | import | binding`, `CodePack` shape untouched.
- Deterministic output: identical corpus → identical `code-ast-index.json` bytes; file ordering derives from `listSourceFiles` (`discovery.ts:109` sorts), symbols sorted per file.
- No name resolution / type inference beyond the same-package package-identity check.
- No new dependencies; no `grammar-versions.ts` bump (P6 shipped without one — extractor-output change only).
- Canon-first: living canon (`docs/canon/**`) must be updated via `canon-write` and the initiative status via `canon-future-plan` BEFORE application code; a substantial canon write waits for explicit user go-ahead.
- Tests run with `npm test` (`tsx --test tests/**/*.test.ts`); single-file: `npx tsx --test <file>`; typecheck via `npm run build` (`tsc`).
- `doc-canon validate` must pass after every canon edit; `doc-canon index` after a substantive canon write.

---

### Task 1: Canon-first — living canon + initiative status (no application code)

**Files:**
- Modify: `docs/canon/GLOSSARY.md` (via canon-write)
- Modify: `docs/canon/CLI.md` (via canon-write)
- Modify: `docs/canon/ARCHITECTURE.md` (via canon-write)
- Modify: `docs/canon/future_plans/p6a-go-code-refs-member-access.md` (via canon-future-plan)
- Modify: `docs/canon/future_plans/INDEX.md` (via canon-future-plan)

**Interfaces:**
- Consumes: the approved spec (`2026-08-18-p6a-go-code-refs-member-access-design.md`); canon skills `canon-write` and `canon-future-plan`.
- Produces: validated living canon describing the Go member-access behavior, and P6a-Go status set to `implementing`. Nothing for later tasks to import — documentation only.

- [ ] **Step 1: Load the canon skills**

Invoke the `canon-write` and `canon-future-plan` skills and follow them exactly. They own all `docs/canon/**` edits — do not hand-edit canon.

- [ ] **Step 2: Update living canon (canon-write)**

Scout → Expand first (`doc-canon search "member-access reference"`), then deep-read `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` sections affected. From registered templates, update:

- `GLOSSARY.md` — the `Member-access reference` term: add the Go pattern — a binding initialized from a composite/pointer literal (`x := &T{}` / `x := T{}` / `var x = T{}`) resolves `x.method()` / `x.field` to a `<Type>.<member>`-named edge; `<Type>` is the unqualified type name; imported `reader.Handle{}` resolves through the import edge map to the imported file; same-package types resolve via the sync post-processing pass.
- `CLI.md` — the `code-index search --refs` section: note `--refs Class.method` now matches Go constructor-backed member accesses (same-file, qualified-import, and same-package), query stays exact/case-sensitive.
- `ARCHITECTURE.md` — the code AST index building-block block: add Go composite-literal binding + member-access edges and the same-package resolution pass.

- [ ] **Step 3: Validate + index**

Run `doc-canon validate`; expected: valid. Then run `doc-canon index` (one-shot) to refresh the search index. If a watch holds the lock, surface it and rely on the watch.

- [ ] **Step 4: Set P6a-Go status to implementing (canon-future-plan)**

Follow the canon-future-plan skill: set `p6a-go-code-refs-member-access.md` status to `implementing`, keep the file's required headings (`Intent`, `In scope`, `Out of scope`, `Absorbs into`, `Open questions`), resolve the initiative's open questions per the spec Decisions (`:=`/`var x = T{}` with initializer count; `&T{}` counts; same-file + qualified-import + same-package covered; same-package via post-processing). Update the `future_plans/INDEX.md` Initiatives table row for P6a-Go. Run `doc-canon validate`; expected: valid.

- [ ] **Step 5: STOP — wait for user go-ahead**

This was a substantial canon write. Do NOT start Task 2 until the user explicitly says to proceed with implementation.

- [ ] **Step 6: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): P6a-Go member-access Go pattern; status implementing"
```

---

### Task 2: Go extractor — composite-literal binding + member-access edges

**Files:**
- Modify: `src/code-index/types.ts` (add `UnresolvedMember`, `ExtractResult`)
- Modify: `src/code-index/extractors/go.ts` (new passes, wire into `extractFile`)
- Modify: `src/code-index/extractors/index.ts` (dispatcher return type)
- Test: `tests/code-index-extractor-go.test.ts`

**Interfaces:**
- Consumes: existing `walkSymbols`, `collectImportEdges`, `collectAnchorAndBindingRefs`, `resolveImportPath`, `posixJoin`, `Node`/`WalkCtx` from `go.ts`.
- Produces:
  - `types.ts`: `export type UnresolvedMember = { file: string; typeName: string; memberName: string; line: number };` and `export type ExtractResult = { symbols: CodeSymbol[]; references: CodeReference[]; unresolvedMembers?: UnresolvedMember[] };`
  - `go.ts`: `extractFile` returns `Promise<ExtractResult>`; `collectCompositeLiteralBindings` (private), `collectImportedPackages` (private), `collectMemberAccessEdges` (private). Later tasks consume only `extractFile`'s `unresolvedMembers` field.

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/code-index-extractor-go.test.ts`:

```ts
describe("extractFile (go) member-access references", () => {
  it("emits same-file edges for := &T{}, := T{}, and var x = T{} bindings", async () => {
    const text = `package main

type Handle struct {
	Field int
}

func main() {
	x := &Handle{}
	y := Handle{}
	var v = Handle{}
	x.Score("q")
	_ = y
	_ = v
	_ = x
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references
      .filter((r) => r.kind === "import" && r.name.includes("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Score", to: "main.go" }],
    );
  });

  it("emits property-read edges for struct fields", async () => {
    const text = `package main

type Handle struct {
	Field int
}

func main() {
	x := &Handle{}
	_ = x.Field
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Field", to: "main.go" }],
    );
  });

  it("resolves qualified imported types through the import edge map", async () => {
    const text = `package main

import "./reader"

func main() {
	h := &reader.Handle{}
	h.Score("q")
}`;
    const known = new Set(["main.go", "reader.go"]);
    const { references } = await extractFile("main.go", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Score", to: "reader.go" }],
    );
  });

  it("emits no edge for factory calls, slice/map literals, or uninitialized var", async () => {
    const text = `package main

func NewT() *Handle { return nil }

func main() {
	x := NewT()
	y := []Handle{}
	z := map[string]Handle{}
	var w Handle
	x.Score("q")
	_ = y
	_ = z
	_ = w
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("surfaces same-package candidates in unresolvedMembers", async () => {
    const text = `package main

func main() {
	x := &Handle{}
	x.Score("q")
}`;
    const { unresolvedMembers } = await extractFile("main.go", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "main.go", typeName: "Handle", memberName: "Score", line: 5 },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-extractor-go.test.ts`
Expected: the new tests FAIL — no member-access edges, `unresolvedMembers` is `undefined`.

- [ ] **Step 3: Add the types**

In `src/code-index/types.ts`, after the `CodeReference` type:

```ts
export type UnresolvedMember = {
  file: string;
  typeName: string;
  memberName: string;
  line: number;
};

export type ExtractResult = {
  symbols: CodeSymbol[];
  references: CodeReference[];
  unresolvedMembers?: UnresolvedMember[];
};
```

- [ ] **Step 4: Implement the Go extractor passes**

In `src/code-index/extractors/go.ts`:

Add the import type:

```ts
import type { CodeReference, CodeSymbol, ExtractResult, SymbolKind } from "../types.js";
```

Add a binding type and the three passes before `collectAnchorAndBindingRefs`:

```ts
type CompositeBinding = { typeName: string; packageName: string | null };

function compositeLiteralIn(expr: Node): Node | null {
  const inner = expr.type === "expression_list" ? expr.namedChildren[0] : expr;
  if (!inner) return null;
  if (inner.type === "composite_literal") return inner;
  if (inner.type === "unary_expression") {
    return inner.namedChildren.find((c) => c.type === "composite_literal") ?? null;
  }
  return null;
}

function literalTypeName(lit: Node): CompositeBinding | null {
  const typeNode = lit.childForFieldName("type");
  if (!typeNode) return null;
  if (typeNode.type === "type_identifier") {
    return { typeName: typeNode.text, packageName: null };
  }
  if (typeNode.type === "qualified_type") {
    const pkg = typeNode.namedChildren.find((c) => c.type === "package_identifier");
    const type = typeNode.namedChildren.find((c) => c.type === "type_identifier");
    if (pkg && type) return { typeName: type.text, packageName: pkg.text };
  }
  return null;
}

function collectCompositeLiteralBindings(root: Node): Map<string, CompositeBinding> {
  const bindings = new Map<string, CompositeBinding>();
  const visit = (node: Node): void => {
    if (node.type === "short_var_declaration") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      const name = left?.namedChildren.find((c) => c.type === "identifier");
      if (name && right) {
        const lit = compositeLiteralIn(right);
        const type = lit ? literalTypeName(lit) : null;
        if (name.text && type) bindings.set(name.text, type);
      }
    } else if (node.type === "var_spec") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");
      if (name && value) {
        const lit = compositeLiteralIn(value);
        const type = lit ? literalTypeName(lit) : null;
        if (name.text && type) bindings.set(name.text, type);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}

function collectImportedPackages(root: Node, ctx: WalkCtx): Map<string, string> {
  const imported = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "import_declaration") {
      for (const spec of node.namedChildren) {
        if (spec.type !== "import_spec") continue;
        const pathNode = spec.childForFieldName("path");
        if (!pathNode) continue;
        const source = pathNode.text.replace(/^`|^"|"$|`$/g, "");
        if (source.startsWith("./") || source.startsWith("../")) {
          const alias = spec.childForFieldName("name")?.text;
          const name = alias ?? source.slice(source.lastIndexOf("/") + 1);
          const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
          if (resolved) imported.set(name, resolved);
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return imported;
}

function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  bindings: Map<string, CompositeBinding>,
  importedPackages: Map<string, string>,
  unresolved: UnresolvedMember[],
): void {
  const typeSymbolNames = new Set(
    ctx.symbols
      .filter((s) => s.kind === "struct" || s.kind === "interface" || s.kind === "type")
      .map((s) => s.name),
  );
  const visit = (node: Node): void => {
    if (node.type === "selector_expression") {
      const object = node.namedChildren.find((c) => c.type === "identifier");
      const field = node.childForFieldName("field");
      if (object && field?.type === "field_identifier") {
        const binding = bindings.get(object.text);
        if (binding) {
          const line = node.startPosition.row + 1;
          const member = field.text;
          if (binding.packageName !== null) {
            const to = importedPackages.get(binding.packageName);
            if (to !== undefined) {
              ctx.references.push({
                kind: "import",
                from: ctx.file,
                to,
                name: `${binding.typeName}.${member}`,
                line,
              });
            }
          } else if (typeSymbolNames.has(binding.typeName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${binding.typeName}.${member}`,
              line,
            });
          } else {
            unresolved.push({
              file: ctx.file,
              typeName: binding.typeName,
              memberName: member,
              line,
            });
          }
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}
```

Update the `extractFile` tail of `go.ts` — replace:

```ts
    collectImportEdges(tree.rootNode, ctxRefs);
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    ctxRefs.references.sort(
```

with:

```ts
    collectImportEdges(tree.rootNode, ctxRefs);
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    const bindings = collectCompositeLiteralBindings(tree.rootNode);
    const importedPackages = collectImportedPackages(tree.rootNode, ctxRefs);
    const unresolvedMembers: UnresolvedMember[] = [];
    collectMemberAccessEdges(tree.rootNode, ctxRefs, bindings, importedPackages, unresolvedMembers);
    ctxRefs.references.sort(
```

and replace the final return of `extractFile`:

```ts
    return { symbols: ctx.symbols, references: ctxRefs.references };
```

with:

```ts
    return { symbols: ctx.symbols, references: ctxRefs.references, unresolvedMembers };
```

Change `extractFile`'s declared return type to `Promise<ExtractResult>`.

- [ ] **Step 5: Update the dispatcher return type**

In `src/code-index/extractors/index.ts`, import `ExtractResult` and change the dispatcher:

```ts
export async function extractFile(
  rel: string,
  text: string,
  knownFiles: Set<string>,
): Promise<ExtractResult> {
```

The individual per-language extractors still declare `Promise<{ symbols; references }>`; that stays assignable to `Promise<ExtractResult>` because `unresolvedMembers` is optional — no change needed in the other extractors.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-extractor-go.test.ts`
Expected: all tests PASS, including the new member-access describe block.

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/code-index/types.ts src/code-index/extractors/go.ts src/code-index/extractors/index.ts tests/code-index-extractor-go.test.ts
git commit -m "feat: Go composite-literal member-access edges in code-index refs (P6a-Go)"
```

---

### Task 3: Same-package resolution post-processing in sync

**Files:**
- Modify: `src/code-index/sync.ts`
- Test: `tests/code-index-same-package.test.ts` (new)

**Interfaces:**
- Consumes: `UnresolvedMember`, `CodeSymbol`, `CodeReference` from `types.ts`; `unresolvedMembers` produced by Task 2's `extractFile`.
- Produces: `export function resolveGoSamePackageReferences(unresolved: UnresolvedMember[], symbols: CodeSymbol[]): CodeReference[]` — resolved same-package edges, or `[]` when no candidate exists. `syncCodeIndex` appends its output to the AST `references` array.

- [ ] **Step 1: Write the failing unit tests**

Create `tests/code-index-same-package.test.ts`:

```ts
// tests/code-index-same-package.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeSymbol } from "../src/code-index/types.js";
import { resolveGoSamePackageReferences } from "../src/code-index/sync.js";

function moduleSym(file: string, pkg: string): CodeSymbol {
  return { name: pkg, kind: "module", signature: `package ${pkg}`, file, line: 1, endLine: 1, scope: "" };
}

function typeSym(file: string, name: string): CodeSymbol {
  return { name, kind: "struct", signature: `type ${name} struct {}`, file, line: 2, endLine: 2, scope: "" };
}

describe("resolveGoSamePackageReferences", () => {
  it("resolves a same-package type declared in a sibling file", () => {
    const symbols = [moduleSym("main.go", "app"), moduleSym("handle.go", "app"), typeSym("handle.go", "Handle")];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), [
      { kind: "import", from: "main.go", to: "handle.go", name: "Handle.Score", line: 4 },
    ]);
  });

  it("drops a candidate with no same-package type", () => {
    const symbols = [moduleSym("main.go", "app")];
    const unresolved = [{ file: "main.go", typeName: "Missing", memberName: "M", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("drops when two same-named types exist in the package", () => {
    const symbols = [
      moduleSym("main.go", "app"),
      moduleSym("a.go", "app"),
      moduleSym("b.go", "app"),
      typeSym("a.go", "Handle"),
      typeSym("b.go", "Handle"),
    ];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("does not resolve across different package clauses", () => {
    const symbols = [
      moduleSym("main.go", "app"),
      moduleSym("other_test.go", "app_test"),
      typeSym("other_test.go", "Handle"),
    ];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("returns [] for an empty unresolved list", () => {
    assert.deepEqual(resolveGoSamePackageReferences([], []), []);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-same-package.test.ts`
Expected: FAIL — `resolveGoSamePackageReferences` is not exported (TypeScript compile error at import).

- [ ] **Step 3: Implement `resolveGoSamePackageReferences`**

In `src/code-index/sync.ts`, add an import for the types and the function after `computeFingerprint`:

```ts
import type { CodeReference, CodeSymbol, UnresolvedMember } from "./types.js";

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
    const candidates = index.get(`${dir}|${pkg}`)?.get(u.typeName) ?? [];
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
```

- [ ] **Step 4: Wire into `syncCodeIndex`**

In `syncCodeIndex`, replace:

```ts
  const symbols: CodeAstIndex["symbols"] = [];
  const references: CodeAstIndex["references"] = [];
```

with:

```ts
  const symbols: CodeAstIndex["symbols"] = [];
  const references: CodeAstIndex["references"] = [];
  const unresolved: UnresolvedMember[] = [];
```

Inside the per-file loop, after `references.push(...extracted.references);`, add:

```ts
    if (extracted.unresolvedMembers) unresolved.push(...extracted.unresolvedMembers);
```

After the loop, before `const relHashes = ...`, add:

```ts
  references.push(...resolveGoSamePackageReferences(unresolved, symbols));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-same-package.test.ts`
Expected: all PASS.

- [ ] **Step 6: Run the full sync/extractor suite**

Run: `npx tsx --test tests/code-index-sync.test.ts tests/code-index-extractor-go.test.ts tests/code-index-extractor.test.ts`
Expected: all PASS (determinism tests in `code-index-sync.test.ts` hold — the new edges are deterministic).

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/code-index/sync.ts tests/code-index-same-package.test.ts
git commit -m "feat: same-package resolution for Go member-access refs (P6a-Go)"
```

---

### Task 4: Update existing Go reference test + integration coverage

**Files:**
- Modify: `tests/code-index-extractor-go.test.ts` (existing `emits relative import edges` test)
- Modify: `tests/code-search.test.ts` (new Go refs describe block)
- Test: same files

**Interfaces:**
- Consumes: `extractFile` (Task 2), `syncCodeIndex` + `resolveGoSamePackageReferences` (Task 3), `searchCodeIndex` (unchanged).
- Produces: regression-tightened unit test; Go integration fixtures proving `--refs Type.method` for same-file and same-package.

- [ ] **Step 1: Fix the existing Go unit test that now sees an extra edge**

In `tests/code-index-extractor-go.test.ts`, the test `emits relative import edges and binding refs for local vars` uses `h := &reader.Handle{}; h.Score = 1`. With Task 2, this now emits a `Handle.Score` member-access edge, so `imports.length` becomes 2. Replace its assertions:

```ts
    const imports = references.filter((r) => r.kind === "import");
    assert.equal(imports.length, 1);
    assert.equal(imports[0].to, "reader.go");
    assert.equal(imports[0].name, "reader");
```

with:

```ts
    const imports = references.filter((r) => r.kind === "import");
    assert.ok(imports.some((r) => r.to === "reader.go" && r.name === "reader"));
    assert.ok(imports.some((r) => r.to === "reader.go" && r.name === "Handle.Score"));
    assert.equal(imports.length, 2);
```

- [ ] **Step 2: Write the failing integration tests**

Append to `tests/code-search.test.ts`:

```ts
describe("searchCodeIndex (go refs)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "go.mod", "module example.com/app\n\ngo 1.22\n");
    write(repo, "main.go", `package main

type Handle struct{}

func (h *Handle) Score(q string) int { return len(q) }

func main() {
	x := &Handle{}
	x.Score("q")
}
`);
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode matches Go same-file constructor-backed member-access edges", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Handle.Score" });
    assert.equal(pack.mode, "refs");
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Handle.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Handle.Score member-access hit");
    assert.equal(hit.from, "main.go");
    assert.equal(hit.to, "main.go");
    assert.equal(hit.line, 9);
  });

  it("refs mode resolves Go same-package types across files", async () => {
    write(repo, "handle.go", "package main\n\ntype Reader struct{}\n\nfunc (r *Reader) Open() {}\n");
    write(repo, "main.go", `package main

func main() {
	r := &Reader{}
	r.Open()
}
`);
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Reader.Open" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Reader.Open",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Reader.Open same-package hit");
    assert.equal(hit.from, "main.go");
    assert.equal(hit.to, "handle.go");
    assert.equal(hit.line, 4);
  });
});
```

- [ ] **Step 3: Run the tests to verify the integration tests fail**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: the two new Go refs tests FAIL (no `Handle.Score` / `Reader.Open` hit).

- [ ] **Step 4: Run to verify the fixed unit test passes**

Run: `npx tsx --test tests/code-index-extractor-go.test.ts`
Expected: all PASS including the updated `emits relative import edges` test.

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add tests/code-index-extractor-go.test.ts tests/code-search.test.ts
git commit -m "test: Go member-access refs unit + integration coverage (P6a-Go)"
```

---

### Task 5: Full regression + repo index rebuild

**Files:**
- Run: full test suite; `doc-canon` index rebuild for this repo
- No source edits unless a regression surfaces (then stop and investigate with systematic-debugging)

**Interfaces:**
- Consumes: all Tasks 1–4 deliverables.
- Produces: green full suite; deterministic repo index.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass. Pay attention to determinism asserts (`code-index-sync.test.ts`, `code-search.test.ts`, `code-index-dogfood.test.ts`) — they must hold unchanged.

- [ ] **Step 2: Rebuild this repo's code index and verify determinism**

Run: `doc-canon code-index build` twice; the second run must report fresh/no rewrite. Then `git status` — the `.doc-canon/code-ast-index.json` and `code-index-manifest.json` may be untracked/ignored; confirm the build output is deterministic (identical bytes across two runs).

Note: this repo has no Go sources under the index roots, so the dogfood proves rebuild determinism only; the temp fixtures in Task 4 prove the edges.

- [ ] **Step 3: Commit (only if the repo index is tracked and changed)**

```bash
git status
git add -A
git commit -m "chore: rebuild code index (P6a-Go)"
```

If `git status` shows nothing staged and the index artifacts are ignored, skip the commit and proceed.

---

### Task 6: Absorb P6a-Go + canon audit

**Files:**
- Modify: `docs/canon/future_plans/p6a-go-code-refs-member-access.md` (via canon-future-plan)
- Modify: `docs/canon/future_plans/INDEX.md` (via canon-future-plan)
- Possibly: `docs/canon/DISCREPANCIES.md` (via canon-audit)

**Interfaces:**
- Consumes: shipped implementation (Tasks 2–4), living canon updated in Task 1, green suite (Task 5).
- Produces: P6a-Go marked `absorbed`; closing canon audit.

- [ ] **Step 1: Absorb via canon-future-plan**

Invoke the `canon-future-plan` skill. Confirm the living canon (GLOSSARY/CLI/ARCHITECTURE) was already updated in Task 1. If not, stop and run `canon-write` first. Then set P6a-Go status to `absorbed`, update the `future_plans/INDEX.md` row and ordering note. Run `doc-canon validate`; expected: valid.

- [ ] **Step 2: Closing canon audit**

Invoke the `canon-audit` skill. Run a semantic pass over the member-access topic (GLOSSARY/CLI/ARCHITECTURE + the shipped Go code) until open decisions are cleared or unreproduced drift is marked stale. Confirm the initiative's open questions are resolved in the absorbed file. Record any findings in `DISCREPANCIES.md`; run `doc-canon validate`.

- [ ] **Step 3: Final full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): absorb P6a-Go member-access resolution"
```

---

## Self-Review Notes (filled during plan authoring)

**Spec coverage:** Every spec section maps to a task — canon-first (T1), extractor passes + edge shape (T2), same-package post-processing + wiring (T3), regression + integration + existing-test fix (T4), determinism/rebuild (T5), absorb/audit (T6). Non-goals (factory calls, slice/map literals, `var x T`, chained access, cross-package) are asserted in T2 tests. Query-side unchanged by design (no task needed beyond T4 asserting it works).

**Placeholder scan:** All steps carry concrete code, exact file paths, exact commands, and expected outcomes. No TBD/TODO/"handle edge cases" prose.

**Type consistency:** `UnresolvedMember` and `ExtractResult` are introduced once in T2 and consumed identically in T2/T3 (`{ file, typeName, memberName, line }`). `resolveGoSamePackageReferences(unresolved, symbols)` signature is defined in T3 and used in the same task; T4 only exercises it through `syncCodeIndex`/`searchCodeIndex`. Go extractor symbol kinds checked are exactly `struct | interface | type` in both T2 (same-file) and T3 (same-package).
