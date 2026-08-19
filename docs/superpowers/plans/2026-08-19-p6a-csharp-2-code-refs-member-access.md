# P6a-CSharp-2 Code-refs Member-Access Imported-Type Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the C# code-index extractor and its cross-file resolver so member-access edges (`--refs Type.method`) resolve imported types: `using`-directive and `using`-alias imports, namespace-qualified constructors (`new NS.Type()`), and target-typed `new()` with an explicit-type anchor — via a deterministic syntactic project model, no `.csproj`/`.sln` parsing.

**Architecture:** The C# extractor (`src/code-index/extractors/csharp.ts`) gains a `collectUsingDirectives` pass (namespace imports + aliases) and a `collectConstructorBindings` extended to identifier/qualified/alias/explicit-typed-target-typed forms; each binding records `{ typeName, namespaces[] }` where `namespaces` is the resolver search-set. `collectMemberAccessEdges` keeps same-file edges inline and pushes `namespaces` into `UnresolvedMember`. The resolver `resolveCSharpNamespaceReferences` (`src/code-index/resolvers/csharp.ts`) indexes all module symbols per file, resolves own-namespace-first (only within the search-set), then the full search-set, emitting an edge only when exactly one distinct candidate file matches. Query side, schema, `CodePack` shape, `sync.ts`, and `CROSS_FILE_RESOLVERS` are unchanged.

**Tech Stack:** TypeScript (NodeNext ESM), `@vscode/tree-sitter-wasm` C# grammar, `node:test` + `tsx`, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-19-p6a-csharp-2-code-refs-member-access-design.md` — the plan argues from the spec; executors read both.

## Global Constraints

- Index schema unchanged: `schema_version` 1, `ReferenceKind = anchor | import | binding`, `CodePack` shape untouched.
- Deterministic output: identical corpus → identical `code-ast-index.json` bytes; file ordering derives from `listSourceFiles`; symbols sorted per file.
- No name resolution / type inference beyond the syntactic project model (file↔namespace from module symbols + per-file `using` directives).
- No `.csproj`/`.sln` parsing; no new dependencies; no `grammar-versions.ts` bump.
- Canon-first: living canon (`docs/canon/**`) must be updated via `canon-write` and the initiative status via `canon-future-plan` BEFORE application code; a substantial canon write waits for explicit user go-ahead.
- `using static` and `global using` are out of scope — skipped in `collectUsingDirectives`.
- Target-typed `new()` resolves only with an explicit (non-`var`) type; `var w = new();` never emits a binding.
- Edge names carry the canonical type name (last segment, no namespace prefix): `Widget.Score`, `Reader.Get`. `--refs R.Score` (alias form) does not match — documented.
- Tests run with `npm test` (`tsx --test tests/**/*.test.ts`); single-file: `npx tsx --test <file>`; typecheck via `npm run build` (`tsc`).
- `doc-canon validate` must pass after every canon edit.

---

### Task 1: Canon-first — living canon + initiative status (no application code)

**Files:**
- Modify: `docs/canon/GLOSSARY.md` (via canon-write)
- Modify: `docs/canon/CLI.md` (via canon-write)
- Modify: `docs/canon/ARCHITECTURE.md` (via canon-write)
- Modify: `docs/canon/CODE_INDEX.md` (via canon-write)
- Modify: `docs/canon/future_plans/p6a-csharp-2-code-refs-member-access.md` (via canon-future-plan)
- Modify: `docs/canon/future_plans/INDEX.md` (via canon-future-plan)

**Interfaces:**
- Consumes: the approved spec (`2026-08-19-p6a-csharp-2-code-refs-member-access-design.md`); canon skills `canon-write` and `canon-future-plan`.
- Produces: validated living canon describing the C# imported-type member-access behavior, and P6a-CSharp-2 status set to `implementing`. Nothing for later tasks to import — documentation only.

- [ ] **Step 1: Load the canon skills**

Invoke the `canon-write` and `canon-future-plan` skills and follow them exactly. They own all `docs/canon/**` edits — do not hand-edit canon.

- [ ] **Step 2: Update living canon (canon-write)**

Scout → Expand first (`doc-canon search "member-access reference"`), then deep-read `GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md`, `CODE_INDEX.md` sections affected. From registered templates, update:

- `GLOSSARY.md` — the `Member-access reference` term: extend the C# pattern — `using`-directive imports (`using App.Models;`), `using`-alias (`using R = App.Reader;`, edge carries canonical `Reader`), namespace-qualified (`new App.Widget()`), and target-typed `new()` with an explicit type (`Widget w = new();`) now emit edges via a deterministic syntactic project model (file↔namespace from module symbols + per-file `using` names); `using static`/`global using`/`var w = new();` still get no edge.
- `CLI.md` — the `code-index search --refs` section and Refs mode: note `--refs Class.method` now matches C# `using`-imported, `using`-alias (canonical name), namespace-qualified, and explicit-typed target-typed constructor bindings across namespaces; query stays exact/case-sensitive.
- `ARCHITECTURE.md` — the code AST index building-block block: add the C# imported-type resolution via the syntactic project model and the extended `resolveCSharpNamespaceReferences` pass (own-first within the search-set, then using-union).
- `CODE_INDEX.md` — the C# per-language table row (member-access now covers `using`/qualified/alias/explicit-typed `new()`) and the cross-file resolution passes section (C# resolver description update); remove the open question about C# imported-type resolution needing a project model, or mark it resolved.

- [ ] **Step 3: Validate + index**

Run `doc-canon validate`; expected: valid. Then run `doc-canon index` (one-shot) to refresh the search index. If a watch holds the lock, surface it and rely on the watch.

- [ ] **Step 4: Set P6a-CSharp-2 status to implementing (canon-future-plan)**

Follow the canon-future-plan skill: set `p6a-csharp-2-code-refs-member-access.md` status to `implementing`, keep the file's required headings (`Intent`, `In scope`, `Out of scope`, `Absorbs into`, `Open questions`), resolve the initiative's open questions per the spec Decisions (syntactic project model; explicit-type-only target-typed `new()`; `using static`/`global using` excluded; canonical edge names; own-first priority; nested namespaces via all-module-symbols index). Update the `future_plans/INDEX.md` Initiatives table row for P6a-CSharp-2 and the ordering note. Run `doc-canon validate`; expected: valid.

- [ ] **Step 5: STOP — wait for user go-ahead**

This was a substantial canon write. Do NOT start Task 2 until the user explicitly says to proceed with implementation.

- [ ] **Step 6: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): P6a-CSharp-2 imported-type resolution pattern; status implementing"
```

---

### Task 2: types.ts + C# extractor — using directives, extended bindings, namespaces on unresolved

**Files:**
- Modify: `src/code-index/types.ts` (add `namespaces?: string[]` to `UnresolvedMember`)
- Modify: `src/code-index/extractors/csharp.ts` (new `collectUsingDirectives`, extended `collectConstructorBindings`, `collectMemberAccessEdges` pushes `namespaces`)
- Test: `tests/code-index-extractor-csharp.test.ts`

**Interfaces:**
- Consumes: existing `walkSymbols`, `collectAnchorAndBindingRefs`, `collectMemberAccessEdges`, `UnresolvedMember`, `Node`/`WalkCtx` from `csharp.ts`; `CodeSymbol`, `ExtractResult` from `types.ts`.
- Produces:
  - `types.ts`: `UnresolvedMember` gains optional `namespaces?: string[]`.
  - `csharp.ts` (private): `type ConstructorBinding = { typeName: string; namespaces: string[] }`; `type UsingContext = { usings: string[]; aliases: Record<string, string> }`; `collectUsingDirectives(root): UsingContext`; `collectConstructorBindings(root, ownNamespaces, using): Map<string, ConstructorBinding>`; `bindingForTypeNode(type, ownNamespaces, using): ConstructorBinding | null`; `splitQualifiedName(text): { typeName; namespace: string | null }`. Later tasks consume only `extractFile`'s `unresolvedMembers` (now with `namespaces`).

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/code-index-extractor-csharp.test.ts`:

```ts
describe("extractFile (csharp) imported-type member-access", () => {
  it("surfaces using-imported candidates with own+using namespaces", async () => {
    const text = `using App.Models;

namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new Widget();
            w.Score = 5;
        }
    }
}
`;
    const { unresolvedMembers } = await extractFile("src/App/Program.cs", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 10, namespaces: ["App", "App.Models"] },
    ]);
  });

  it("surfaces namespace-qualified candidates with a single qualified namespace", async () => {
    const text = `namespace App
{
    public class Program
    {
        static void Main()
        {
            var q = new App.Models.Widget();
            q.Score = 5;
        }
    }
}
`;
    const { unresolvedMembers } = await extractFile("src/App/Program.cs", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 8, namespaces: ["App.Models"] },
    ]);
  });

  it("resolves using-alias constructors to canonical type + namespace", async () => {
    const text = `using R = App.Reader;

namespace App
{
    public class Program
    {
        static void Main()
        {
            R r = new R();
            r.Get("q");
        }
    }
}
`;
    const { unresolvedMembers } = await extractFile("src/App/Program.cs", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Reader", memberName: "Get", line: 10, namespaces: ["App"] },
    ]);
  });

  it("emits target-typed new() entries only for explicit-typed declarations", async () => {
    const text = `using App.Models;

namespace App
{
    public class Program
    {
        static void Main()
        {
            Widget w = new();
            w.Score = 5;
            var v = new();
            v.Score = 1;
        }
    }
}
`;
    const { unresolvedMembers } = await extractFile("src/App/Program.cs", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 10, namespaces: ["App", "App.Models"] },
    ]);
  });

  it("ignores using static and global using when computing namespaces", async () => {
    const text = `using static System.Math;
global using System.Linq;

namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new Widget();
            w.Score = 5;
        }
    }
}
`;
    const { unresolvedMembers } = await extractFile("src/App/Program.cs", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 11, namespaces: ["App"] },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-extractor-csharp.test.ts`
Expected: the new tests FAIL — `unresolvedMembers` entries lack `namespaces` (deepEqual mismatch) and/or the alias/qualified/typed forms produce no entries.

- [ ] **Step 3: Add the `namespaces` field to `UnresolvedMember`**

In `src/code-index/types.ts`, change:

```ts
export type UnresolvedMember = {
  file: string;
  typeName: string;
  memberName: string;
  line: number;
};
```

to:

```ts
export type UnresolvedMember = {
  file: string;
  typeName: string;
  memberName: string;
  line: number;
  namespaces?: string[];
};
```

- [ ] **Step 4: Implement the extractor passes**

In `src/code-index/extractors/csharp.ts`, add the two new types and helpers above `collectConstructorBindings` (currently near the bottom of the file):

```ts
type ConstructorBinding = { typeName: string; namespaces: string[] };

type UsingContext = { usings: string[]; aliases: Record<string, string> };

function splitQualifiedName(text: string): { typeName: string; namespace: string | null } {
  const lastDot = text.lastIndexOf(".");
  if (lastDot === -1) return { typeName: text, namespace: null };
  return { typeName: text.slice(lastDot + 1), namespace: text.slice(0, lastDot) };
}

function collectUsingDirectives(root: Node): UsingContext {
  const usings: string[] = [];
  const aliases: Record<string, string> = {};
  const visit = (node: Node): void => {
    if (node.type === "using_directive") {
      const isStatic = node.children.some((c) => c.type === "static");
      const isGlobal = node.children.some((c) => c.type === "global");
      if (isStatic || isGlobal) {
        for (const c of node.namedChildren) visit(c);
        return;
      }
      const named = node.namedChildren;
      const first = named[0];
      const last = named[named.length - 1];
      if (first?.type === "identifier" && last?.type === "qualified_name") {
        aliases[first.text] = last.text;
      } else if (first?.type === "qualified_name") {
        usings.push(first.text);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return { usings, aliases };
}

function bindingForTypeNode(
  type: Node,
  ownNamespaces: string[],
  using: UsingContext,
): ConstructorBinding | null {
  if (type.type === "identifier") {
    const alias = using.aliases[type.text];
    if (alias !== undefined) {
      const { typeName, namespace } = splitQualifiedName(alias);
      return typeName ? { typeName, namespaces: namespace ? [namespace] : [] } : null;
    }
    return { typeName: type.text, namespaces: [...ownNamespaces, ...using.usings] };
  }
  if (type.type === "qualified_name") {
    const { typeName, namespace } = splitQualifiedName(type.text);
    return typeName ? { typeName, namespaces: namespace ? [namespace] : [] } : null;
  }
  return null;
}
```

Replace the existing `collectConstructorBindings` function:

```ts
function collectConstructorBindings(root: Node): Map<string, string> {
  const bindings = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name");
      const ctor = node.namedChildren.find((c) => c.type === "object_creation_expression");
      if (name && ctor) {
        const type = ctor.childForFieldName("type");
        if (type?.type === "identifier") bindings.set(name.text, type.text);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}
```

with:

```ts
function collectConstructorBindings(
  root: Node,
  ownNamespaces: string[],
  using: UsingContext,
): Map<string, ConstructorBinding> {
  const bindings = new Map<string, ConstructorBinding>();
  const visit = (node: Node): void => {
    if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name");
      const ctor = node.namedChildren.find((c) => c.type === "object_creation_expression");
      let binding: ConstructorBinding | null = null;
      if (name && ctor) {
        const type = ctor.childForFieldName("type");
        if (type) binding = bindingForTypeNode(type, ownNamespaces, using);
      } else if (name) {
        const implicit = node.namedChildren.find((c) => c.type === "implicit_object_creation_expression");
        if (implicit) {
          const decl = node.parent;
          const declType = decl?.type === "variable_declaration" ? decl.childForFieldName("type") : null;
          if (declType) binding = bindingForTypeNode(declType, ownNamespaces, using);
        }
      }
      if (name && binding) bindings.set(name.text, binding);
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}
```

Replace the existing `collectMemberAccessEdges` function:

```ts
function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  constructorBindings: Map<string, string>,
  unresolved: UnresolvedMember[],
): void {
```

with:

```ts
function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  constructorBindings: Map<string, ConstructorBinding>,
  unresolved: UnresolvedMember[],
): void {
```

and inside its `visit`, replace the edge/unresolved block:

```ts
        const typeName = constructorBindings.get(binding);
        if (typeName !== undefined) {
          const line = node.startPosition.row + 1;
          if (typeSymbolNames.has(typeName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${typeName}.${member.text}`,
              line,
            });
          } else {
            unresolved.push({
              file: ctx.file,
              typeName,
              memberName: member.text,
              line,
            });
          }
        }
```

with:

```ts
        const entry = constructorBindings.get(binding);
        if (entry !== undefined) {
          const line = node.startPosition.row + 1;
          if (typeSymbolNames.has(entry.typeName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${entry.typeName}.${member.text}`,
              line,
            });
          } else {
            unresolved.push({
              file: ctx.file,
              typeName: entry.typeName,
              memberName: member.text,
              line,
              namespaces: entry.namespaces,
            });
          }
        }
```

- [ ] **Step 5: Wire the new passes into `extractFile`**

In `extractFile`, replace:

```ts
    const constructorBindings = collectConstructorBindings(tree.rootNode);
    const unresolvedMembers: UnresolvedMember[] = [];
    collectMemberAccessEdges(tree.rootNode, ctxRefs, constructorBindings, unresolvedMembers);
```

with:

```ts
    const using = collectUsingDirectives(tree.rootNode);
    const ownNamespaces = ctx.symbols.filter((s) => s.kind === "module").map((s) => s.name);
    const constructorBindings = collectConstructorBindings(tree.rootNode, ownNamespaces, using);
    const unresolvedMembers: UnresolvedMember[] = [];
    collectMemberAccessEdges(tree.rootNode, ctxRefs, constructorBindings, unresolvedMembers);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-extractor-csharp.test.ts`
Expected: the new imported-type tests PASS. Note: existing tests `surfaces unresolved candidates in unresolvedMembers` and `emits no edge for namespace-qualified new NS.Type()` will FAIL — they are updated in Task 4.

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 8: Commit**

```bash
git add src/code-index/types.ts src/code-index/extractors/csharp.ts tests/code-index-extractor-csharp.test.ts
git commit -m "feat: C# using/qualified/alias/explicit-typed bindings with namespace search-sets (P6a-CSharp-2)"
```

---

### Task 3: Resolver — all-module-symbols index, own-first then using-union

**Files:**
- Modify: `src/code-index/resolvers/csharp.ts`
- Test: `tests/code-index-csharp-namespace.test.ts`

**Interfaces:**
- Consumes: `UnresolvedMember` (now with `namespaces?: string[]`), `CodeSymbol`, `CodeReference` from `types.ts`; `unresolvedMembers` produced by Task 2's `extractFile`.
- Produces: extended `export function resolveCSharpNamespaceReferences(unresolved: UnresolvedMember[], symbols: CodeSymbol[]): CodeReference[]` — same signature, own-first-within-search-set then full search-set, exactly one distinct candidate file → edge. Registration in `CROSS_FILE_RESOLVERS` and `sync.ts` unchanged.

- [ ] **Step 1: Write the failing unit tests**

Append to `tests/code-index-csharp-namespace.test.ts`:

```ts
describe("resolveCSharpNamespaceReferences (imported types)", () => {
  it("resolves using-imported types via the namespaces search-set", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("resolves namespace-qualified types against a single qualified namespace", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("does not prefer own-namespace candidates outside the qualified search-set", () => {
    const symbols = [
      moduleSym("src/App/Models/Program.cs", "App.Models"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      moduleSym("src/App/Other/Widget.cs", "App.Other"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
      typeSym("src/App/Other/Widget.cs", "Widget", "App.Other"),
    ];
    const unresolved = [
      { file: "src/App/Models/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App.Other"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Models/Program.cs", to: "src/App/Other/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("prefers the own-namespace candidate when it is unique in the search-set", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Widget.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Widget.cs", "Widget", "App"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("resolves nested namespaces via all module symbols of a file", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Inner/Widget.cs", "App"),
      moduleSym("src/App/Inner/Widget.cs", "App.Inner"),
      typeSym("src/App/Inner/Widget.cs", "Widget", "App.Inner"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Inner"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Inner/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("drops when the full search-set has multiple distinct candidate files", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/A/Widget.cs", "App.A"),
      moduleSym("src/App/B/Widget.cs", "App.B"),
      typeSym("src/App/A/Widget.cs", "Widget", "App.A"),
      typeSym("src/App/B/Widget.cs", "Widget", "App.B"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.A", "App.B"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-csharp-namespace.test.ts`
Expected: the new tests FAIL — the current resolver ignores `namespaces` and only matches the file's first module symbol.

- [ ] **Step 3: Rewrite `resolveCSharpNamespaceReferences`**

In `src/code-index/resolvers/csharp.ts`, replace the whole function body:

```ts
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
```

with:

```ts
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-csharp-namespace.test.ts`
Expected: all PASS — the existing v1 same-namespace tests (no `namespaces` field → fallback to own) and the new imported-type tests.

- [ ] **Step 5: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/code-index/resolvers/csharp.ts tests/code-index-csharp-namespace.test.ts
git commit -m "feat: C# resolver own-first/using-union for imported member-access types (P6a-CSharp-2)"
```

---

### Task 4: Update existing C# extractor tests + integration coverage

**Files:**
- Modify: `tests/code-index-extractor-csharp.test.ts` (existing `surfaces unresolved candidates` and `emits no edge for namespace-qualified new NS.Type()` tests)
- Modify: `tests/code-search.test.ts` (new C# imported-type refs describe block)
- Test: same files

**Interfaces:**
- Consumes: `extractFile` (Task 2), `resolveCSharpNamespaceReferences` via `syncCodeIndex` (Task 3), `searchCodeIndex` (unchanged).
- Produces: regression-tightened unit tests; C# integration fixtures proving `--refs Type.method` for using-imported, qualified, alias, and explicit-typed target-typed bindings.

- [ ] **Step 1: Update the existing `surfaces unresolved candidates` test**

In `tests/code-index-extractor-csharp.test.ts`, the test `surfaces unresolved candidates in unresolvedMembers` now sees the `namespaces` field. Replace:

```ts
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 8 },
    ]);
```

with:

```ts
    assert.deepEqual(unresolvedMembers, [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 8, namespaces: ["App"] },
    ]);
```

- [ ] **Step 2: Update the namespace-qualified test to expect an edge**

In `tests/code-index-extractor-csharp.test.ts`, the test `emits no edge for namespace-qualified new NS.Type()` now emits a same-file edge for `new App.Widget()` (Widget declared in the same file). Rename it and replace its assertion:

```ts
  it("emits no edge for namespace-qualified new NS.Type()", async () => {
```

with:

```ts
  it("emits same-file edges for namespace-qualified new App.Widget()", async () => {
```

and replace:

```ts
    const { references } = await extractFile("src/App/Program.cs", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
```

with:

```ts
    const { references } = await extractFile("src/App/Program.cs", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Widget.Score", to: "src/App/Program.cs" }],
    );
```

- [ ] **Step 3: Write the failing integration tests**

Append to `tests/code-search.test.ts`:

```ts
describe("searchCodeIndex (csharp refs imported types)", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(
      repo,
      "src/App/Models/Widget.cs",
      `namespace App.Models
{
    public class Widget
    {
        public int Score { get; set; }
    }
}
`,
    );
    write(
      repo,
      "src/App/Program.cs",
      `using App.Models;

namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new Widget();
            var n = w.Score;
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("refs mode resolves using-imported types across namespaces", () => {
    const pack = searchCodeIndex(repo, "", { refs: "Widget.Score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Widget.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Widget.Score using-imported hit");
    assert.equal(hit.from, "src/App/Program.cs");
    assert.equal(hit.to, "src/App/Models/Widget.cs");
    assert.equal(hit.line, 10);
  });

  it("refs mode resolves namespace-qualified constructors", async () => {
    write(
      repo,
      "src/App/Program.cs",
      `namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new App.Models.Widget();
            var n = w.Score;
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Widget.Score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Widget.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Widget.Score qualified hit");
    assert.equal(hit.from, "src/App/Program.cs");
    assert.equal(hit.to, "src/App/Models/Widget.cs");
    assert.equal(hit.line, 8);
  });

  it("refs mode resolves using-alias constructors to the canonical name", async () => {
    write(
      repo,
      "src/App/Program.cs",
      `using W = App.Models.Widget;

namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new W();
            var n = w.Score;
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Widget.Score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Widget.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Widget.Score alias hit");
    assert.equal(hit.to, "src/App/Models/Widget.cs");
  });

  it("refs mode resolves target-typed new() with an explicit type", async () => {
    write(
      repo,
      "src/App/Program.cs",
      `using App.Models;

namespace App
{
    public class Program
    {
        static void Main()
        {
            Widget w = new();
            var n = w.Score;
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Widget.Score" });
    const hit = pack.hits.find(
      (h) => h.refKind === "import" && h.name === "Widget.Score",
    ) as CodeRefHit;
    assert.ok(hit, "expected a Widget.Score target-typed hit");
    assert.equal(hit.to, "src/App/Models/Widget.cs");
  });

  it("refs mode does not cross namespaces without a using directive", async () => {
    write(
      repo,
      "src/App/Program.cs",
      `namespace App
{
    public class Program
    {
        static void Main()
        {
            var w = new Widget();
            var n = w.Score;
        }
    }
}
`,
    );
    await syncCodeIndex(repo);
    const pack = searchCodeIndex(repo, "", { refs: "Widget.Score" });
    assert.equal(pack.hits.filter((h) => h.refKind === "import" && h.name === "Widget.Score").length, 0);
  });
});
```

- [ ] **Step 4: Run the tests to verify the integration tests fail**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: the new C# imported-type refs tests FAIL (no hits).

- [ ] **Step 5: Run the updated extractor test to verify the fixes pass**

Run: `npx tsx --test tests/code-index-extractor-csharp.test.ts`
Expected: all PASS including the two updated tests from Steps 1–2 and the Task 2 imported-type tests.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: `tsc` exits 0.

- [ ] **Step 7: Commit**

```bash
git add tests/code-index-extractor-csharp.test.ts tests/code-search.test.ts
git commit -m "test: C# imported-type member-access refs unit + integration coverage (P6a-CSharp-2)"
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

Run: `doc-canon code-index build` twice; the second run must report fresh/no rewrite. Confirm the build output is deterministic (identical bytes across two runs).

Note: this repo has no C# sources under the index roots (no `.csproj`), so the dogfood proves rebuild determinism only; the temp fixtures in Task 4 prove the edges.

- [ ] **Step 3: Commit (only if the repo index is tracked and changed)**

```bash
git status
git add -A
git commit -m "chore: rebuild code index (P6a-CSharp-2)"
```

If `git status` shows nothing staged and the index artifacts are ignored, skip the commit and proceed.

---

### Task 6: Absorb P6a-CSharp-2 + canon audit

**Files:**
- Modify: `docs/canon/future_plans/p6a-csharp-2-code-refs-member-access.md` (via canon-future-plan)
- Modify: `docs/canon/future_plans/INDEX.md` (via canon-future-plan)
- Possibly: `docs/canon/DISCREPANCIES.md` (via canon-audit)

**Interfaces:**
- Consumes: shipped implementation (Tasks 2–4), living canon updated in Task 1, green suite (Task 5).
- Produces: P6a-CSharp-2 marked `absorbed`; closing canon audit.

- [ ] **Step 1: Absorb via canon-future-plan**

Invoke the `canon-future-plan` skill. Confirm the living canon (GLOSSARY/CLI/ARCHITECTURE/CODE_INDEX) was already updated in Task 1. If not, stop and run `canon-write` first. Then set P6a-CSharp-2 status to `absorbed`, update the `future_plans/INDEX.md` row and ordering note. Run `doc-canon validate`; expected: valid.

- [ ] **Step 2: Closing canon audit**

Invoke the `canon-audit` skill. Run a semantic pass over the member-access topic (GLOSSARY/CLI/ARCHITECTURE/CODE_INDEX + the shipped C# code) until open decisions are cleared or unreproduced drift is marked stale. Confirm the initiative's open questions are resolved in the absorbed file. Record any findings in `DISCREPANCIES.md`; run `doc-canon validate`.

- [ ] **Step 3: Final full suite**

Run: `npm test`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): absorb P6a-CSharp-2 imported-type resolution"
```

---

## Self-Review Notes (filled during plan authoring)

**Spec coverage:** Every spec section maps to a task — canon-first (T1), `UnresolvedMember.namespaces` + extractor passes (T2), resolver own-first/using-union + nested-namespace index (T3), regression updates + integration (T4), determinism/rebuild (T5), absorb/audit (T6). Non-goals asserted in T2/T4 tests: `using static`/`global using` skipped, `var w = new();` no binding, no cross-namespace without `using`, alias query form carries canonical name, ambiguity drop. Query-side unchanged by design (T4 asserts it works end-to-end).

**Placeholder scan:** All steps carry concrete code, exact file paths, exact commands, and expected outcomes. No TBD/TODO/"handle edge cases" prose. Expected line numbers in fixtures were verified against the CST dumps produced during design (member-access node `startPosition.row + 1`).

**Type consistency:** `ConstructorBinding = { typeName: string; namespaces: string[] }` is defined once in T2 and consumed by `collectConstructorBindings` and `collectMemberAccessEdges` in the same task. `UnresolvedMember.namespaces?: string[]` is introduced in T2, filled in T2, consumed in T3 (resolver `target = u.namespaces ?? own`) and asserted in T2/T4 tests. `resolveCSharpNamespaceReferences(unresolved, symbols)` keeps its signature throughout T3. `splitQualifiedName` and `bindingForTypeNode` are defined and used only within T2.
