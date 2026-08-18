# Code-refs member-access resolution (P6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit `import`-kind member-access edges (`Class.method`) for local bindings initialized from `new <Identifier>(...)` in the TypeScript/JavaScript code extractor, unblocking `--refs Class.method`.

**Architecture:** In `src/code-index/extractors/typescript.ts`, build a per-file map of `const` binding → constructor type name from `new_expression` initializers, make the imported-names map alias-inclusive, and add a `collectMemberAccessEdges` pass that walks `member_expression` nodes (calls and field reads) whose object is such a binding and emits `{ kind: "import", name: "<Type>.<member>", to: <class file> }`. Refs-mode matching in `searchCodeIndex` already does exact `r.name === effective`, so no search/CLI/schema change is needed.

**Tech Stack:** TypeScript, tree-sitter WASM (`@vscode/tree-sitter-wasm`), node:test + `tsx`. No new dependencies.

**Spec:** [`docs/superpowers/specs/2026-08-18-p6-code-refs-member-access-design.md`](../specs/2026-08-18-p6-code-refs-member-access-design.md) — the plan argues from the spec; executors read both. Canon changes go through `canon-write` / `canon-future-plan` skills, never by hand-editing `docs/canon/**`.

## Global Constraints

- Do not edit `docs/canon/**` directly — use the `canon-write` skill for living sections and the `canon-future-plan` skill for `future_plans/` initiatives.
- Canon-first: Task 1 (canon updates) must be followed by an explicit user go-ahead gate before any application code (Task 2+).
- No index schema change: `ReferenceKind` stays `anchor | import | binding`; `CodeAstIndex` and `CodePack` shapes unchanged.
- No new runtime dependencies.
- Determinism preserved: pure functions over the CST; final reference sort unchanged (`from`, `line`, `name`, `kind`, `to`).
- Repo convention: source imports use `.js`-extension ESM specifiers; tests run with `npx tsx --test tests/**/*.test.ts`.
- Commit per task with repo-style messages (`feat:`, `test:`, `docs(canon):`, etc.).
- TS/JS only in v1; other languages are separate P6a draft initiatives (no code).

---

### Task 1: Canon-first updates (GLOSSARY, CLI, ARCHITECTURE, future_plans)

**Files:**
- Modify: `docs/canon/GLOSSARY.md` (via `canon-write`)
- Modify: `docs/canon/CLI.md` (via `canon-write`)
- Modify: `docs/canon/ARCHITECTURE.md` (via `canon-write`)
- Modify: `docs/canon/future_plans/p6-code-refs-member-access.md` (via `canon-future-plan`)
- Create: `docs/canon/future_plans/p6a-go-code-refs-member-access.md` (via `canon-future-plan`)
- Create: `docs/canon/future_plans/p6a-rust-code-refs-member-access.md` (via `canon-future-plan`)
- Create: `docs/canon/future_plans/p6a-csharp-code-refs-member-access.md` (via `canon-future-plan`)
- Create: `docs/canon/future_plans/p6a-python-code-refs-member-access.md` (via `canon-future-plan`)
- Modify: `docs/canon/future_plans/INDEX.md` (via `canon-future-plan`)

**Interfaces:**
- Consumes: the spec's Decisions table (aliases covered, same-file covered, TS/JS only).
- Produces: the canon vocabulary (`Member-access reference` term) and P6a draft initiatives that Task 5's absorption and the closing audit reference.

- [ ] **Step 1: Load and follow the canon-write skill**

Run the `skill` tool to load `canon-write`. Announce usage. Apply the edits below through `canon-write`'s documented workflow.

- [ ] **Step 2: Add the `Member-access reference` term to GLOSSARY**

Append this term in alphabetical position (after `Member-access reference` requires it near `member-access`; place it right before `### migrate`):

```markdown
### Member-access reference
A syntactic `import`-kind reference edge from a member usage (`obj.method()` call or `obj.field` read) on a local binding initialized from `new <Type>(...)` to the type's file, named `<Type>.<member>` using the canonical imported name. `<Type>` may be an imported name (direct or aliased `import { X as Y }` — the edge always carries canonical `X`) or a same-file class declaration. Resolved syntactically with no name resolution: factory-returned bindings (`openCanonIndex()`), namespace-member constructors (`new NS.Class()`), chained objects (`h.get().build()`), and reassigned bindings get no member-access edge.
```

Also update the `Syntactic reference` term's closing sentence to append: `and member-access references — `obj.method()` / `obj.field` on `new Type()`-initialized bindings link to `<Type>.<member>` in the type's file (canonical name, aliases resolved).`

- [ ] **Step 3: Update the `code-ast-index` glossary term**

In the `code-ast-index` term, after the sentence ending `...emit an `import`-kind edge to the definition file.`, append: ` Member-access references extend this: a local binding initialized from `new <Type>(...)` emits `<Type>.<member>` edges for its `obj.method()`/`obj.field` usages (canonical name; aliased and same-file constructors included).`

- [ ] **Step 4: Update CLI.md `code-index search` description**

In the `code-index search` row (the `--refs <name>` fragment) and the capability bullet that describes refs mode, add that `--refs` accepts `Class.method` and matches member-access edges for constructor-backed instances. Suggested wording for the row fragment: `...`--refs <name>` for syntactic references (anchor/import/binding, incl. `Class.method` member-access edges for `new Type()`-initialized bindings)...`.

- [ ] **Step 5: Update ARCHITECTURE.md code AST index building block**

In the `**Code AST index**` building-block paragraph, after the sentence describing call-site edges (`...identifier usages of imported names emit an `import`-kind edge to the definition file`), append: ` member-access edges extend this — a local binding initialized from `new <Type>(...)` (imported, aliased, or same-file) emits `<Type>.<member>` edges for its `obj.method()`/`obj.field` usages, canonical name, syntactic only`.

- [ ] **Step 6: Run `doc-canon validate`**

Run: `npx tsx src/cli.ts validate --root .`
Expected: exit 0 (all canon checks pass: headings, INDEX↔contract, stamp, future-plans index agreement).

- [ ] **Step 7: Mark P6 `implementing` and add P6a drafts via canon-future-plan**

Load the `canon-future-plan` skill and use it to:
- Change `docs/canon/future_plans/p6-code-refs-member-access.md` status to `implementing`, and replace its `## Open questions` section with `## Open questions` *Resolved by the design spec* (language scope: TS/JS v1 + per-language drafts; same-file constructors: covered; aliases: covered).
- Create four draft initiatives, each following the `FUTURE_PLAN` template (Status/Focus/Depends/Unblocks metadata bullets + `Intent`/`In scope`/`Out of scope`/`Absorbs into`/`Open questions`):

`p6a-go-code-refs-member-access.md`:
```markdown
# P6a-Go — Go code-refs member-access slice

- **Status:** draft
- **Focus:** Go slice of P6: member-access call-site edges for local bindings initialized from composite-literal/pointer structs (`x := &T{}` / `x := T{}`), syntactically, in the Go extractor — unblocks `--refs Type.method` for Go.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Go (Go extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Go constructor-backed members; fewer `code_miss` probes

## Intent

P6 ships member-access resolution for the TS/JS `new <Type>(...)` pattern. Go constructors are not a `new` keyword: struct literals (`T{...}`), pointer literals (`&T{...}`), and constructor functions (`func NewT() *T`). This slice extends the cheap syntactic tier for the composite-literal pattern: `x := &T{}` + `x.method()` emits a `T.method`-named member-access edge. Constructor-function patterns need the binding's type, which is not syntactic — out of scope here.

## In scope

- Composite-literal/pointer-literal bindings: `x := &T{}` / `x := T{}` where `T` is a same-file or same-package type — `T.method`-named edges
- Same-file and same-package resolution only (no cross-package type inference)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Constructor-function bindings (`x := NewT()`) — needs type info, not syntactic
- Cross-package/imported-type resolution beyond the import edge map
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md` (code AST index — Go member-access), `CLI.md` (`code-index search --refs`), `GLOSSARY.md` (member-access reference — Go pattern).

## Open questions

- Whether `:=` short declarations, `var x T`, and `&T{}` forms all count in v1
- Package-internal `T` resolution when multiple packages share the same name
- Exact tree-sitter-go node types for composite/pointer literals — locked in extractor tests
```

`p6a-rust-code-refs-member-access.md`:
```markdown
# P6a-Rust — Rust code-refs member-access slice

- **Status:** draft
- **Focus:** Rust slice of P6: member-access call-site edges for local bindings initialized from `Type::new()` / `Type::default()` associated-function calls, syntactically — unblocks `--refs Type.method` for Rust.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Rust (Rust extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Rust constructor-backed members

## Intent

Rust construction uses associated functions (`Type::new()`) rather than a `new` keyword. This slice extends the cheap syntactic tier: `let x = Type::new();` + `x.method()` emits a `Type.method`-named member-access edge when `Type` is same-file or an imported name. Requires the associated-function-call CST pattern (`scoped_identifier` callee in a `call_expression`).

## In scope

- `let`/`const` bindings initialized from `Type::new()` / `Type::new(...)` / `Type::default()` — `Type.method`-named edges
- Same-file types and imported names via the import edge map
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Generic type params, trait-associated constructors, `Arc::new`/`Box::new` wrapping (object type differs from the wrapper)
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — Rust pattern).

## Open questions

- Whether `Arc::new(x)`, `Box::new(x)`, `Rc::new(x)` wrappers should resolve to the inner type — needs type info, likely out of v1
- Path-qualified calls (`mod::Type::new()`) and imported-path resolution
- Exact tree-sitter-rust node types — locked in extractor tests
```

`p6a-csharp-code-refs-member-access.md`:
```markdown
# P6a-CSharp — C# code-refs member-access slice

- **Status:** draft
- **Focus:** C# slice of P6: member-access call-site edges for local bindings initialized from `new Type(...)` object-creation expressions, syntactically — unblocks `--refs Type.method` for C#.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-CSharp (C# extractor, absorbed)
- **Unblocks:** `--refs Type.method` for C# constructor-backed members

## Intent

C# uses `new Type(...)` like TS/JS, but the CST shape differs (`object_creation_expression` with `type` and `argument_list` children). This slice mirrors P6's constructor-binding + member-access passes in the C# extractor: `var x = new Type();` + `x.method()` emits a `Type.method`-named edge for same-file or imported `Type`.

## In scope

- `new Type(...)`-initialized local bindings (`var`/explicit-typed) — `Type.method`-named edges
- Same-file types and imported names (via the C# extractor's `using` import handling)
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- `target-typed new` (`new()` without an explicit type), generics, nullable/array constructions
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — C# pattern).

## Open questions

- Whether target-typed `new()` (no type name in the CST) is ever resolvable syntactically — likely not in v1
- `using`-alias and namespace-qualified type resolution
- Exact tree-sitter-csharp node types — locked in extractor tests
```

`p6a-python-code-refs-member-access.md`:
```markdown
# P6a-Python — Python code-refs member-access slice

- **Status:** draft
- **Focus:** Python slice of P6: member-access call-site edges for local bindings initialized from `Type(...)` constructor calls, syntactically — unblocks `--refs Type.method` for Python.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Python (Python extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Python constructor-backed members

## Intent

Python has no `new` keyword; construction is a bare call `x = Type(...)`. Distinguishing a constructor call from any other call is not syntactic without type info. This slice proposes the limited syntactic rule: a binding whose initializer is a call whose callee is a capitalized, same-file-imported class name emits `Type.method` edges for its member usages. If the heuristic proves too noisy, the slice may scope down to imported names only.

## In scope

- `x = Type(...)` bindings where `Type` resolves to a same-file class or an imported name — `Type.method`-named edges
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Capitalization heuristics that cannot be grounded syntactically (a `Type` that is actually a function)
- Factory functions, `functools`, decorators, dynamic dispatch; name resolution / type inference

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — Python pattern).

## Open questions

- Whether the capitalized-callee heuristic is reliable enough or should be imported-names-only
- `from x import Type` alias handling in the Python extractor
- Exact tree-sitter-python node types — locked in extractor tests
```

- [ ] **Step 8: Update future_plans/INDEX.md**

Via `canon-future-plan`, add rows after P6:
```markdown
| 6a-go | Go code-refs member-access slice | draft | [p6a-go-code-refs-member-access.md](p6a-go-code-refs-member-access.md) |
| 6a-rust | Rust code-refs member-access slice | draft | [p6a-rust-code-refs-member-access.md](p6a-rust-code-refs-member-access.md) |
| 6a-csharp | C# code-refs member-access slice | draft | [p6a-csharp-code-refs-member-access.md](p6a-csharp-code-refs-member-access.md) |
| 6a-python | Python code-refs member-access slice | draft | [p6a-python-code-refs-member-access.md](p6a-python-code-refs-member-access.md) |
```
Update the P6 row status from `draft` to `implementing`, and append a sentence to the trailing prose noting P6 is `implementing` with per-language P6a-{go,rust,csharp,python} drafts following the P2a language-slice precedent.

- [ ] **Step 9: Re-run validate and commit**

Run: `npx tsx src/cli.ts validate --root .`
Expected: exit 0. Then commit:

```bash
git add docs/canon
git commit -m "docs(canon): P6 implementing; add P6a language member-access drafts"
```

**GATE — STOP.** This was a substantial canon change. Per canon-first (AGENTS.md), wait for the user's explicit go-ahead before starting Task 2. Do not begin application code without it.

---

### Task 2: Alias-inclusive imported-names map in the TS extractor

**Files:**
- Modify: `src/code-index/extractors/typescript.ts`
- Test: `tests/code-index-references.test.ts`

**Interfaces:**
- Consumes: existing `resolveImportPath`, `WalkCtx`, `Node` from `../parser.js`.
- Produces: `collectImportedNames(root: Node, ctx: WalkCtx): Map<string, { to: string; canonical: string }>` — used by `collectCallSiteEdges` (Task 3 modifies) and `collectMemberAccessEdges` (Task 4).

- [ ] **Step 1: Write the failing test for alias-aware call-site edges**

Append to `tests/code-index-references.test.ts` (inside the existing `describe("extractFile references")` block):

```ts
it("maps aliased import names to their canonical definition", async () => {
  const text = `import { openReader as open } from "./reader.js";
export function run(): void {
  open();
}`;
  const known = new Set(["src/reader.ts", "src/run.ts"]);
  const { references } = await extractFile("src/run.ts", text, known);
  const callSites = references.filter((r) => r.kind === "import" && r.line > 1);
  assert.deepEqual(
    callSites.map((r) => ({ name: r.name, to: r.to })),
    [{ name: "openReader", to: "src/reader.ts" }],
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: FAIL — no call-site edge emitted for `open` (alias not in the imported-names map), so `callSites` is empty.

- [ ] **Step 3: Implement `collectImportedNames`**

In `src/code-index/extractors/typescript.ts`, add this function after `collectImportEdges` (keep `collectImportNames` unchanged — import-statement edges still carry the canonical name):

```ts
function collectImportedNames(
  root: Node,
  ctx: WalkCtx,
): Map<string, { to: string; canonical: string }> {
  const imported = new Map<string, { to: string; canonical: string }>();
  const visit = (node: Node): void => {
    if (node.type === "import_statement") {
      const sourceNode = node.namedChildren.find((c) => c.type === "string");
      const source = sourceNode?.text.replace(/['"]/g, "") ?? "";
      if (source.startsWith("./") || source.startsWith("../")) {
        const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
        if (resolved) {
          const visitSpec = (n: Node): void => {
            if (n.type === "import_specifier") {
              const name = n.childForFieldName("name")?.text;
              const alias = n.childForFieldName("alias")?.text;
              if (name) imported.set(name, { to: resolved, canonical: name });
              if (alias && alias !== name) {
                imported.set(alias, { to: resolved, canonical: name });
              }
              return;
            }
            if (n.type === "namespace_import") {
              const id = n.namedChildren.find((c) => c.type === "identifier");
              if (id) imported.set(id.text, { to: resolved, canonical: id.text });
              return;
            }
            if (n.type === "identifier") {
              imported.set(n.text, { to: resolved, canonical: n.text });
              return;
            }
            for (const c of n.namedChildren) visitSpec(c);
          };
          visitSpec(node);
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return imported;
}
```

- [ ] **Step 4: Wire the map into `extractFile`**

In `extractFile`, replace the block that builds `importedNames` from references:

```ts
const importedNames = new Map<string, string>();
for (const r of ctxRefs.references) {
  if (r.kind === "import") importedNames.set(r.name, r.to);
}
```

with:

```ts
const importedNames = collectImportedNames(tree.rootNode, ctxRefs);
```

(Do not modify `collectCallSiteEdges` in this task — Task 3 adjusts it for the new map shape. The build will be type-broken until Task 3; that is expected mid-plan.)

- [ ] **Step 5: Run the full references test file**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: FAIL to compile/type-check (map shape mismatch in `collectCallSiteEdges`), which is resolved in Task 3. Note this is an intentional mid-plan broken state.

---

### Task 3: Update `collectCallSiteEdges` for the enriched map

**Files:**
- Modify: `src/code-index/extractors/typescript.ts`
- Test: `tests/code-index-references.test.ts`

**Interfaces:**
- Consumes: `collectImportedNames` (Task 2).
- Produces: `collectCallSiteEdges(root, ctx, importedNames: Map<string, { to: string; canonical: string }>)` — emits canonical-name edges for alias usages; unchanged edge shape.

- [ ] **Step 1: Update `collectCallSiteEdges` signature and body**

Change the signature to:

```ts
function collectCallSiteEdges(
  root: Node,
  ctx: WalkCtx,
  importedNames: Map<string, { to: string; canonical: string }>,
): void {
```

and replace the body's map lookup:

```ts
      const to = importedNames.get(name);
      if (to !== undefined && !ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        ctx.references.push({ kind: "import", from: ctx.file, to, name, line });
      }
```

with:

```ts
      const entry = importedNames.get(name);
      if (entry !== undefined && !ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        ctx.references.push({ kind: "import", from: ctx.file, to: entry.to, name: entry.canonical, line });
      }
```

This makes alias usages (`open()`) emit edges named with the canonical imported name (`openReader`).

- [ ] **Step 2: Run the failing alias test — expect pass now**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: the alias test from Task 2 passes; all pre-existing tests pass unchanged (extensionless fixtures, namespace, default imports, call-site edges for direct names).

- [ ] **Step 3: Commit**

```bash
git add src/code-index/extractors/typescript.ts tests/code-index-references.test.ts
git commit -m "feat: alias-aware imported-name map for code-index call-site edges"
```

---

### Task 4: Constructor bindings + member-access edges

**Files:**
- Modify: `src/code-index/extractors/typescript.ts`
- Test: `tests/code-index-references.test.ts`

**Interfaces:**
- Consumes: `collectImportedNames` map (Task 2/3), `ctx.symbols`.
- Produces: `collectConstructorBindings(root): Map<string, string>` (binding → constructor type name); `collectMemberAccessEdges(root, ctx, constructorBindings, importedNames, symbolNames)` emitting `{ kind: "import", name: "<canonical>.<member>", to }` edges.

- [ ] **Step 1: Write failing unit tests**

Append to `tests/code-index-references.test.ts`:

```ts
it("emits member-access edges for constructor-backed imported bindings", async () => {
  const text = `import { Bm25Index } from "./bm25.js";
export function run(): void {
  const h = new Bm25Index();
  h.build("q");
  const v = h.score;
}`;
  const known = new Set(["src/index/bm25.ts", "src/run.ts"]);
  const { references } = await extractFile("src/run.ts", text, known);
  const members = references
    .filter((r) => r.kind === "import" && r.name.includes("."))
    .sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(
    members.map((r) => ({ name: r.name, to: r.to, from: r.from })),
    [
      { name: "Bm25Index.build", to: "src/index/bm25.ts", from: "src/run.ts" },
      { name: "Bm25Index.score", to: "src/index/bm25.ts", from: "src/run.ts" },
    ],
  );
});

it("emits member-access edges for same-file class constructors", async () => {
  const text = `export class Reader {
  score(q: string): number { return q.length; }
}
export function run(): void {
  const r = new Reader();
  r.score("q");
}`;
  const { references } = await extractFile("src/reader.ts", text, new Set());
  const members = references.filter((r) => r.kind === "import" && r.name === "Reader.score");
  assert.deepEqual(
    members.map((r) => ({ name: r.name, to: r.to })),
    [{ name: "Reader.score", to: "src/reader.ts" }],
  );
});

it("resolves aliased constructors to canonical member names", async () => {
  const text = `import { Bm25Index as BM } from "./bm25.js";
const h = new BM();
h.build("q");`;
  const known = new Set(["src/index/bm25.ts", "src/run.ts"]);
  const { references } = await extractFile("src/run.ts", text, known);
  const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
  assert.deepEqual(
    members.map((r) => ({ name: r.name, to: r.to })),
    [{ name: "Bm25Index.build", to: "src/index/bm25.ts" }],
  );
});

it("does not emit member-access edges for factory, namespace, or chained objects", async () => {
  const text = `import * as NS from "./ns.js";
export function run(): void {
  const h = openCanonIndex();
  h.score("q");
  const ns = new NS.Bm25Index();
  ns.build();
  const chained = new Chained();
  chained.get().run();
}`;
  const known = new Set(["src/ns.ts", "src/run.ts"]);
  const { references } = await extractFile("src/run.ts", text, known);
  const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
  assert.equal(members.length, 0);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: FAIL — no member-access edges emitted (no `collectMemberAccessEdges` pass yet), so the `members` arrays are empty.

- [ ] **Step 3: Implement `collectConstructorBindings`**

Add after `collectCallSiteEdges`:

```ts
function collectConstructorBindings(root: Node): Map<string, string> {
  const bindings = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "lexical_declaration") {
      for (const child of node.namedChildren) {
        if (child.type !== "variable_declarator") continue;
        const name = child.childForFieldName("name")?.text;
        const value = child.childForFieldName("value");
        if (name && value?.type === "new_expression") {
          const ctor = value.childForFieldName("constructor");
          if (ctor?.type === "identifier") bindings.set(name, ctor.text);
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}
```

- [ ] **Step 4: Implement `collectMemberAccessEdges`**

Add after `collectConstructorBindings`:

```ts
const MEMBER_PROPERTY_TYPES = new Set([
  "property_identifier",
  "identifier",
  "private_property_identifier",
]);

function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  constructorBindings: Map<string, string>,
  importedNames: Map<string, { to: string; canonical: string }>,
): void {
  const symbolNames = new Set(ctx.symbols.map((s) => s.name));
  const visit = (node: Node): void => {
    if (node.type === "member_expression") {
      const object = node.childForFieldName("object");
      const property = node.childForFieldName("property");
      if (
        object &&
        object.type === "identifier" &&
        property &&
        MEMBER_PROPERTY_TYPES.has(property.type)
      ) {
        const binding = object.text;
        const ctorName = constructorBindings.get(binding);
        if (ctorName !== undefined) {
          const imported = importedNames.get(ctorName);
          if (imported !== undefined) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: imported.to,
              name: `${imported.canonical}.${property.text}`,
              line: node.startPosition.row + 1,
            });
          } else if (symbolNames.has(ctorName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${ctorName}.${property.text}`,
              line: node.startPosition.row + 1,
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

- [ ] **Step 5: Wire the passes into `extractFile`**

In `extractFile`, after the existing `collectCallSiteEdges(tree.rootNode, ctxRefs, importedNames);` line, add:

```ts
const constructorBindings = collectConstructorBindings(tree.rootNode);
collectMemberAccessEdges(tree.rootNode, ctxRefs, constructorBindings, importedNames);
```

- [ ] **Step 6: Run the tests — expect all pass**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: all tests pass, including the four new member-access tests and all pre-existing ones.

- [ ] **Step 7: Run the full suite for regressions**

Run: `npx tsx --test tests/**/*.test.ts`
Expected: all tests pass (existing suites unchanged; new edges only add names prior queries never match).

- [ ] **Step 8: Commit**

```bash
git add src/code-index/extractors/typescript.ts tests/code-index-references.test.ts
git commit -m "feat: constructor-backed member-access edges in code-index refs (P6)"
```

---

### Task 5: Integration test — `--refs Class.method` returns the call site

**Files:**
- Modify: `tests/code-search.test.ts`

**Interfaces:**
- Consumes: `searchCodeIndex` from `../src/code-search/search.js`, `syncCodeIndex` from `../src/code-index/sync.js`.
- Produces: regression proof that refs mode matches dotted member names end-to-end.

- [ ] **Step 1: Write the failing integration test**

The existing `beforeEach` already writes `src/reader.ts` (class `Reader` with `score` method) and `src/main.ts` (`import { Reader } from "./reader"; const r = new Reader(); return r.score("x")`) and builds the index. Add this test inside the existing `describe("searchCodeIndex")` block (after the existing `refs mode is case-sensitive and exact` test):

```ts
it("refs mode matches constructor-backed member-access edges (Class.method)", () => {
  const pack = searchCodeIndex(repo, "", { refs: "Reader.score" });
  assert.equal(pack.mode, "refs");
  const hit = pack.hits.find(
    (h) => h.refKind === "import" && h.name === "Reader.score",
  ) as CodeRefHit;
  assert.ok(hit, "expected a Reader.score member-access hit");
  assert.equal(hit.from, "src/main.ts");
  assert.equal(hit.to, "src/reader.ts");
  assert.equal(hit.line, 4);
});
```

Import `type CodeRefHit` at the top of the file if not already imported:

```ts
import { searchCodeIndex, CodeSearchError } from "../src/code-search/search.js";
```

(CodeRefHit is re-exported from `src/code-search/search.js`, so extend that import to include `type CodeRefHit`.)

- [ ] **Step 2: Run the test to verify it fails without the extractor change**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: this new test FAILS if the extractor changes from Task 4 are not present (zero hits) and PASSES with them (the test file's own `syncCodeIndex` rebuild picks up the new edges). Since Tasks 2–4 precede this, expect PASS — if it fails, verify the extractor passes are wired (Task 4 Step 5).

- [ ] **Step 3: Run the full code-search and code-index suites**

Run: `npx tsx --test tests/code-search.test.ts tests/code-index-references.test.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add tests/code-search.test.ts
git commit -m "test: --refs Class.method integration coverage (P6)"
```

---

### Task 6: Rebuild this repo's index and verify determinism

**Files:**
- No source changes; verification only.

**Interfaces:**
- Consumes: the CLI (`src/cli.ts`) via `npx tsx`.

- [ ] **Step 1: Rebuild the code index**

Run: `npx tsx src/cli.ts code-index build --root .`
Expected: exit 0, reports indexed files (fresh build or no-op rebuild).

- [ ] **Step 2: Confirm rebuild determinism**

Run the build twice and diff the artifacts:

```bash
npx tsx src/cli.ts code-index build --root . >/dev/null 2>&1
cp .doc-canon/code-ast-index.json /tmp/p6-a.json
cp .doc-canon/code-index-manifest.json /tmp/p6-m.json
npx tsx src/cli.ts code-index build --root . >/dev/null 2>&1
diff /tmp/p6-a.json .doc-canon/code-ast-index.json
diff /tmp/p6-m.json .doc-canon/code-index-manifest.json
```

Expected: no diffs (byte-identical artifacts).

- [ ] **Step 3: Confirm no false-positive member edges on this repo**

Run: `npx tsx src/cli.ts code-index search --refs "Command.parseAsync" --root .`
Expected: this repo's only `new X()` is `new Command()` from a bare-package import (`commander`), which does not resolve — so `no hits` (or the CLI prints `no hits`, exit 0). This documents the expected v1 limitation (bare-package constructors unresolved), not a bug.

Run: `npx tsx src/cli.ts code-index search --refs "Bm25Index" --root .`
Expected: nonzero hits (import + call-site edges from the A+B slice still present) — confirms no regression in existing refs behavior.

- [ ] **Step 4: Commit (if any artifacts tracked) or leave untracked**

`.doc-canon/**` may be gitignored in this repo; if `git status --short` shows `.doc-canon` changes, leave them untracked (no commit needed).

---

### Task 7: Absorb P6 and close with canon-audit

**Files:**
- Modify: `docs/canon/future_plans/p6-code-refs-member-access.md` (via `canon-future-plan`)
- Modify: `docs/canon/future_plans/INDEX.md` (via `canon-future-plan`)
- Verify: `docs/canon/DISCREPANCIES.md` (via `canon-audit`)

**Interfaces:**
- Consumes: the shipped implementation (Tasks 2–4), the canon updates (Task 1).
- Produces: P6 marked `absorbed`; closing audit confirms no drift.

- [ ] **Step 1: Mark P6 absorbed**

Via `canon-future-plan`, set `docs/canon/future_plans/p6-code-refs-member-access.md` status to `absorbed`, update its `Absorbs into` section to state the outcomes merged (GLOSSARY `Member-access reference` term, CLI `--refs Class.method`, ARCHITECTURE code-index block), and update `future_plans/INDEX.md` (P6 row → `absorbed`; trailing prose sentence). The P6a-{go,rust,csharp,python} drafts stay `draft`.

- [ ] **Step 2: Load and run canon-audit**

Run the `skill` tool to load `canon-audit`. Follow its workflow: build indexes, probe the member-access topic (`--refs Class.method`, glossary terms, CLI/ARCHITECTURE claims), and confirm docs↔code agreement. Any drift found → resolve via the skill's workflow (DISCREPANCIES entry or canon edit); otherwise no new entry.

- [ ] **Step 3: Run validate and the full test suite**

Run: `npx tsx src/cli.ts validate --root .`
Run: `npx tsx --test tests/**/*.test.ts`
Expected: both exit 0 / all pass.

- [ ] **Step 4: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): absorb P6 code-refs member-access resolution"
```
