# Code Index Quality Slice (A+B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the code AST index actually useful on real ESM code — real import edges, cross-file call-site edges, multi-token name/signature search, `--body` snippet windows, and `.worktrees` excluded by default.

**Architecture:** Four independent changes to the shipped P2a/P2b code index: (1) `resolveImportPath` gains ESM-extension substitution (`.js`→`.ts` etc.), (2) the TS extractor emits `import`-kind call-site edges for imported-name usages, (3) symbol search tokenizes the query and matches against `name` + `signature`, (4) a `--body` flag widens snippet windows to `endLine`, plus `.worktrees` added to default ignore globs. No index schema change, no CodePack shape change, no name resolution, hash-driven determinism untouched.

**Tech Stack:** TypeScript (ESM, `.js` import extensions in source), `node:test` + `tsx`, tree-sitter WASM (`@vscode/tree-sitter-wasm`), `micromatch`.

**Spec:** [`docs/superpowers/specs/2026-08-18-code-index-quality-refs-search-design.md`](../specs/2026-08-18-code-index-quality-refs-search-design.md)

## Global Constraints

- ESM: source imports use `.js` extensions (`import { x } from "../y.js"`). Never write `.ts`-extension imports in new code.
- `ReferenceKind` stays `"anchor" | "import" | "binding"` — do NOT add a new kind. Index schema and `CodePack` shape are frozen.
- Determinism is a hard invariant: identical index + identical live corpus + identical query/flags → byte-identical JSON. All sorting must be stable and fully specified.
- Tests: full suite `npm test`; single file `npx tsx --test tests/<file>.test.ts`. Every code task is TDD — failing test first.
- Reuse existing helpers: `tokenize` (`src/index/tokenize.ts`), `isIgnored` / `DEFAULT_EXCLUDES` (`src/agnostic/ignore.ts`), `VCS_INDEXABLE_EXTENSIONS` (`src/code-index/grammar-versions.ts`).
- No behavior changes to Go/Rust/C#/Python extractors, `doc-canon search` (canon BM25), refs-mode query semantics (exact, case-sensitive), freshness, or pack-size caps.
- Canon-first: Task 1 must land (and be validated) before any application code; execution STOPS after Task 1 for an explicit user go-ahead.

---

### Task 1: Canon-first — living canon + DISCREPANCIES

**Files:**
- Modify: `docs/canon/GLOSSARY.md`
- Modify: `docs/canon/CLI.md`
- Modify: `docs/canon/ARCHITECTURE.md`
- Modify: `docs/canon/DISCREPANCIES.md`

**Interfaces:**
- Consumes: canon-write skill (`.claude/skills/canon-write/SKILL.md`) — do NOT hand-edit `docs/canon/**`.
- Produces: canon text describing the new behavior for Tasks 2–6; a DISCREPANCIES entry recording the found divergence.

- [ ] **Step 1: Load the canon-write skill and review current canon**

Load `.claude/skills/canon-write/SKILL.md` via the skill tool. Read the current `docs/canon/GLOSSARY.md`, `CLI.md`, `ARCHITECTURE.md` to find the exact passages describing code-index references/search.

- [ ] **Step 2: Update GLOSSARY via canon-write**

Under the `code-ast-index` / `Syntactic reference` terms, change the wording so `import` edges now state they (a) resolve ESM `.js`/`.jsx`/`.mjs`/`.cjs` specifiers to their TS/TSX sources and (b) include call-site edges — identifier usages of imported names emit an `import`-kind edge to the definition file. Keep `ReferenceKind = anchor | import | binding`.

- [ ] **Step 3: Update CLI via canon-write**

`code-index search` section: document symbol-mode matching as tokenized (every query token is a case-insensitive substring of `name` or, falling back, `signature`; ordering exact > prefix > name-tokens > signature-tokens, tie-break file then line); add the `--body` flag (symbol mode only; `--body` + `--refs` fails closed).

- [ ] **Step 4: Update ARCHITECTURE via canon-write**

Code AST index building block: document ESM-extension resolution in `resolveImportPath` and `.worktrees` in default ignore excludes (with note that this is code discovery only; the canon corpus `docs/canon/**` is unaffected).

- [ ] **Step 5: Record the divergence in DISCREPANCIES via canon-write**

Entry: docs promised import edges; the shipped index carried zero on this repo because `resolveImportPath` never substituted `.js` → `.ts`; resolved by this slice (bugfix). Status: resolved by this slice.

- [ ] **Step 6: Validate the canon**

Run: `doc-canon validate`
Expected: exit 0, no findings.

- [ ] **Step 7: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): document code-index refs/search quality slice (A+B)"
```

- [ ] **Step 8: STOP — wait for explicit user go-ahead before Task 2**

Per AGENTS.md canon-first, application code starts only after the user confirms. Do not proceed to Task 2 until the user says go.

---

### Task 2: ESM-extension resolution in `resolveImportPath`

**Files:**
- Modify: `src/code-index/extractors/typescript.ts:213-229` (`resolveImportPath`)
- Test: `tests/code-index-references.test.ts`

**Interfaces:**
- Consumes: `extractFile(rel: string, text: string, knownFiles: Set<string>): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }>` (existing).
- Produces: `resolveImportPath` that resolves `.js`/`.jsx`/`.mjs`/`.cjs` specifiers to TS/TSX sources. Task 3 builds on this: call-site edges rely on import edges existing.

- [ ] **Step 1: Write the failing test**

Append to `tests/code-index-references.test.ts` inside the `extractFile references` describe block:

```ts
it("resolves ESM .js-extension specifiers to TS sources", async () => {
  const text = `import { Reader } from "./reader.js";
export function open(): Reader {
  return new Reader();
}`;
  const known = new Set(["src/reader.ts", "src/open.ts"]);
  const { references } = await extractFile("src/open.ts", text, known);
  const atStatement = references.find((r) => r.kind === "import" && r.line === 1);
  assert.deepEqual(atStatement, {
    kind: "import",
    from: "src/open.ts",
    to: "src/reader.ts",
    name: "Reader",
    line: 1,
  });
});

it("resolves index.js and .mjs/.cjs specifiers", async () => {
  const text = `import { a } from "./dir/index.js";
import { b } from "./util.mjs";
import { c } from "./shim.cjs";`;
  const known = new Set(["src/dir/index.ts", "src/util.mts", "src/shim.cts", "src/x.ts"]);
  const { references } = await extractFile("src/x.ts", text, known);
  const imports = references.filter((r) => r.kind === "import");
  const byName = Object.fromEntries(imports.map((r) => [r.name, r]));
  assert.equal(byName.a?.to, "src/dir/index.ts");
  assert.equal(byName.b?.to, "src/util.mts");
  assert.equal(byName.c?.to, "src/shim.cts");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: the two new tests FAIL (the `.js` specifier resolves to nothing, so no import edge is emitted).

- [ ] **Step 3: Implement the substitution pass**

Replace the body of `resolveImportPath` in `src/code-index/extractors/typescript.ts` and add the substitution helper just above it:

```ts
const ESM_EXT_SOURCES: ReadonlyArray<[string, readonly string[]]> = [
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
];

function pushEsmSubstitutions(base: string, out: string[]): void {
  for (const [ext, replacements] of ESM_EXT_SOURCES) {
    if (!base.endsWith(ext)) continue;
    const stem = base.slice(0, -ext.length);
    for (const repl of replacements) out.push(`${stem}${repl}`);
  }
}

function resolveImportPath(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const base = pathPosixJoin(dir, specifier);
  const candidates: string[] = [base];
  for (const ext of VCS_INDEXABLE_EXTENSIONS) {
    candidates.push(`${base}${ext}`, `${base}/index${ext}`);
  }
  pushEsmSubstitutions(base, candidates);
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}
```

First candidate wins (deterministic): exact base, then appended extensions, then ESM substitutions. Extensionless behavior is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: all tests in the file PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code-index/extractors/typescript.ts tests/code-index-references.test.ts
git commit -m "fix: resolve ESM .js import specifiers in code index extractor"
```

---

### Task 3: Call-site edges for imported-name usages

**Files:**
- Modify: `src/code-index/extractors/typescript.ts` (new `collectCallSiteEdges`; wire into `extractFile` around `:340-341`)
- Modify: `tests/code-index-references.test.ts` (update the existing import-edges test; add a call-site test)

**Interfaces:**
- Consumes: `import`-kind references produced by `collectImportEdges` (now resolving correctly after Task 2).
- Produces: additional `{ kind: "import", from, to, name, line }` edges at identifier-usage sites whose name matches an imported name. Task 7's dogfood verification and the whole `--refs` value depend on these.

- [ ] **Step 1: Update the existing fixture test for the new edges**

In `tests/code-index-references.test.ts`, the test `"extracts import edges resolved against knownFiles"` currently asserts exactly 4 edges. The call-site pass will add edges for `Reader` and `openReader` used in the body. Replace its assertion with the full list (import-statement edges first, then call-site edges — the sort is stable, key `name + to`):

```ts
assert.deepEqual(
  imports.map((r) => ({ name: r.name, to: r.to, from: r.from, line: r.line })),
  [
    { name: "NS", to: "src/ns.ts", from: "src/run.ts", line: 2 },
    { name: "Reader", to: "src/reader.ts", from: "src/run.ts", line: 1 },
    { name: "Reader", to: "src/reader.ts", from: "src/run.ts", line: 5 },
    { name: "def", to: "src/def.ts", from: "src/run.ts", line: 3 },
    { name: "openReader", to: "src/reader.ts", from: "src/run.ts", line: 1 },
    { name: "openReader", to: "src/reader.ts", from: "src/run.ts", line: 5 },
  ],
);
```

- [ ] **Step 2: Add the call-site test**

Append to the same describe block:

```ts
it("emits call-site edges for imported-name usages", async () => {
  const text = `import { openReader } from "./reader.js";
export function run(): number {
  const r: Reader = openReader();
  return openReader().score("q");
}`;
  const known = new Set(["src/reader.ts", "src/run.ts"]);
  const { references } = await extractFile("src/run.ts", text, known);
  const callSites = references.filter((r) => r.kind === "import" && r.line > 1);
  assert.deepEqual(
    callSites.map((r) => ({ name: r.name, to: r.to, line: r.line })),
    [
      { name: "openReader", to: "src/reader.ts", line: 3 },
      { name: "openReader", to: "src/reader.ts", line: 4 },
    ],
  );
});

it("does not emit call-site edges for same-file symbols", async () => {
  const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
  const { references } = await extractFile("src/reader.ts", text, new Set());
  assert.equal(references.filter((r) => r.kind === "import").length, 0);
});
```

- [ ] **Step 3: Run the tests to verify the new ones fail**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: `"emits call-site edges…"` and `"does not emit call-site edges…"` FAIL; the updated import-edges test may fail too (no call-site edges emitted yet).

- [ ] **Step 4: Implement the call-site pass**

Add after `collectAnchorAndBindingRefs` (before `collectBindingNames`):

```ts
function collectCallSiteEdges(root: Node, ctx: WalkCtx, importedNames: Map<string, string>): void {
  const visit = (node: Node): void => {
    if (
      (node.type === "identifier" ||
        node.type === "type_identifier" ||
        node.type === "property_identifier" ||
        node.type === "shorthand_property_identifier") &&
      !isImportContext(node)
    ) {
      const name = node.text;
      const line = node.startPosition.row + 1;
      const to = importedNames.get(name);
      if (to !== undefined && !ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        ctx.references.push({ kind: "import", from: ctx.file, to, name, line });
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}
```

Wire it into `extractFile`, between the `collectAnchorAndBindingRefs` call and the sort:

```ts
    collectImportEdges(tree.rootNode, ctxRefs);
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    const importedNames = new Map<string, string>();
    for (const r of ctxRefs.references) {
      if (r.kind === "import") importedNames.set(r.name, r.to);
    }
    collectCallSiteEdges(tree.rootNode, ctxRefs, importedNames);
    ctxRefs.references.sort(
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: all tests PASS.

- [ ] **Step 6: Run the full suite (regression check)**

Run: `npm test`
Expected: PASS. The dogfood test (`code-index-dogfood.test.ts`) uses `.some()` over import refs, so extra call-site edges are fine; the search refs tests (`tests/code-search.test.ts`) assert `hits.length >= 1` / presence, not exact counts.

- [ ] **Step 7: Commit**

```bash
git add src/code-index/extractors/typescript.ts tests/code-index-references.test.ts
git commit -m "feat: emit call-site edges for imported-name usages"
```

---

### Task 4: Multi-token name/signature matching in symbol search

**Files:**
- Modify: `src/code-search/search.ts:32-41` (`matchClass`) and `:122-135` (symbols filter/sort)
- Test: `tests/code-search.test.ts`

**Interfaces:**
- Consumes: `tokenize(text: string): string[]` from `src/index/tokenize.js`; `CodeSearchOptions` (existing).
- Produces: `matchClass(name: string, signature: string, query: string): 0 | 1 | 2 | 3 | null` — exact name (0) > name prefix (1) > every token in name (2) > every token in signature (3). Task 5's `--body` reuses the same search path.

- [ ] **Step 1: Write the failing tests**

Append to the `searchCodeIndex` describe block in `tests/code-search.test.ts`:

```ts
it("multi-token query matches symbols whose name contains every token", async () => {
  write(repo, "src/search.ts", "export function searchCodeIndex(root: string): string { return root; }");
  await syncCodeIndex(repo);
  const pack = searchCodeIndex(repo, "search code index");
  const names = (pack.hits as { name: string }[]).map((h) => h.name);
  assert.ok(names.includes("searchCodeIndex"));
});

it("multi-token query falls back to signature tokens", async () => {
  write(repo, "src/token.ts", "export function normalize(doc: string): string[] { return doc.split(' '); }");
  await syncCodeIndex(repo);
  const pack = searchCodeIndex(repo, "normalize doc");
  const names = (pack.hits as { name: string }[]).map((h) => h.name);
  assert.ok(names.includes("normalize"));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: the two new tests FAIL (whole-query substring against `name` returns no hits).

- [ ] **Step 3: Implement multi-token matching**

Add the import at the top of `src/code-search/search.ts`:

```ts
import { tokenize } from "../index/tokenize.js";
```

Replace `matchClass`:

```ts
type MatchClass = 0 | 1 | 2 | 3;

function matchClass(name: string, signature: string, query: string): MatchClass | null {
  const n = name.toLowerCase();
  const q = query.toLowerCase();
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  const tokens = [...new Set(tokenize(q))];
  if (tokens.length === 0) return null;
  if (tokens.every((t) => n.includes(t))) return 2;
  if (tokens.every((t) => signature.toLowerCase().includes(t))) return 3;
  return null;
}
```

Update the symbols filter and sort to pass `signature`:

```ts
  const symbols = handle
    .symbols()
    .filter((s) => matchClass(s.name, s.signature, effective) !== null)
    .filter((s) => options.kind === undefined || s.kind === options.kind)
    .filter((s) => options.file === undefined || micromatch.isMatch(s.file, options.file))
    .sort((a, b) => {
      const ca = matchClass(a.name, a.signature, effective)!;
      const cb = matchClass(b.name, b.signature, effective)!;
      if (ca !== cb) return ca - cb;
      if (a.file < b.file) return -1;
      if (a.file > b.file) return 1;
      return a.line - b.line;
    })
    .slice(0, maxHits);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-search.test.ts`
Expected: all tests PASS (single-token queries still behave: exact > prefix > substring via buckets 0, 1, 2).

- [ ] **Step 5: Commit**

```bash
git add src/code-search/search.ts tests/code-search.test.ts
git commit -m "feat: multi-token name/signature matching in code search"
```

---

### Task 5: `--body` snippet windows

**Files:**
- Modify: `src/code-search/types.ts:34-40` (`CodeSearchOptions`)
- Modify: `src/code-search/snippets.ts:4-16` (`declarationWindow`)
- Modify: `src/code-search/search.ts:156` (call site)
- Modify: `src/commands/code-index-search-cmd.ts` (`--body` validation + pass-through)
- Modify: `src/cli.ts:157` (add option after `--refs`)
- Test: `tests/code-search.test.ts`, `tests/code-index-cli.test.ts`

**Interfaces:**
- Consumes: `CodeSearchOptions` (adds `body?: boolean`); `declarationWindow` (adds `body` param).
- Produces: `--body` CLI flag; symbol-mode snippets run to `endLine` when set; `--body` + `--refs` fails closed with exit 1.

- [ ] **Step 1: Write the failing tests**

Append to `tests/code-search.test.ts`:

```ts
it("body option widens the snippet window to endLine", async () => {
  write(repo, "src/wide.ts", "export function wide(): number {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}");
  await syncCodeIndex(repo);
  const pack = searchCodeIndex(repo, "wide", { body: true });
  const hit = pack.hits[0] as { snippets: { text: string }[] };
  assert.ok(hit.snippets[0]!.text.split("\n").length >= 5);
});
```

Append to `tests/code-index-cli.test.ts` (after the existing three tests):

```ts
it("--body with --refs fails closed", () => {
  const r = spawnSync(
    "node",
    [bin, "code-index", "search", "--refs", "Reader", "--body", "--root", repo],
    { cwd: repoRoot, encoding: "utf8" },
  );
  assert.notEqual(r.status, 0);
  assert.match(r.stderr + r.stdout, /--body/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/code-search.test.ts tests/code-index-cli.test.ts`
Expected: `body option widens…` FAILS (window capped at `snippetLines`); the CLI test FAILS (`--body` is currently an unknown option).

- [ ] **Step 3: Implement**

`src/code-search/types.ts` — add to `CodeSearchOptions`:

```ts
  body?: boolean;
```

`src/code-search/snippets.ts` — change `declarationWindow`:

```ts
export function declarationWindow(
  content: string,
  line: number,
  endLine: number,
  snippetLines: number,
  body = false,
): CodeSearchSnippet | null {
  const lines = content.split("\n");
  const start = Math.max(1, line);
  if (start > lines.length) return null;
  const capped = body ? endLine : Math.min(endLine, start + snippetLines - 1);
  const end = Math.min(Math.max(capped, start), lines.length);
  if (end < start) return null;
  return { start_line: start, text: lines.slice(start - 1, end).join("\n") };
}
```

`src/code-search/search.ts:156` — pass `body` through:

```ts
    const window = declarationWindow(content, sym.line, sym.endLine, snippetLines, options.body ?? false);
```

`src/commands/code-index-search-cmd.ts` — add `body?: boolean;` to `CodeIndexSearchOptions`; after the `--refs`/`--kind`/`--file` validation block add:

```ts
  if (opts.body && opts.refs !== undefined) {
    console.error("error: --body cannot be combined with --refs");
    return 1;
  }
```

and pass it through in the `searchCodeIndex` call:

```ts
      body: opts.body,
```

`src/cli.ts` — after the `--refs` option (line 157) add:

```ts
  .option("--body", "show the full declaration body to endLine")
```

and add `body?: boolean;` to the action's opts type.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx tsx --test tests/code-search.test.ts tests/code-index-cli.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/code-search/types.ts src/code-search/snippets.ts src/code-search/search.ts src/commands/code-index-search-cmd.ts src/cli.ts tests/code-search.test.ts tests/code-index-cli.test.ts
git commit -m "feat: --body snippet windows in code search"
```

---

### Task 6: Exclude `.worktrees` from code discovery

**Files:**
- Modify: `src/agnostic/ignore.ts:3-9` (`DEFAULT_EXCLUDES`)
- Test: `tests/code-index-discovery.test.ts`

**Interfaces:**
- Consumes: `isIgnored(repoRelativePath, ignoreGlobs)` (existing), consulted by `listSourceFiles` and `liveHashes()`.
- Produces: `.worktrees/**` excluded from code discovery by default (canon index unaffected — its corpus is `docs/canon/**`).

- [ ] **Step 1: Write the failing test**

Append to the `code-index discovery` describe block in `tests/code-index-discovery.test.ts`:

```ts
it("default ignore excludes .worktrees", () => {
  write(repo, "package.json", "{}");
  write(repo, "src/index.ts", "export const x = 1;");
  write(repo, ".worktrees/feat/src/other.ts", "export const y = 1;");
  const { vcsRoot, roots } = discoverSourceRoots(repo, {});
  assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/index.ts"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/code-index-discovery.test.ts`
Expected: the new test FAILS (`.worktrees/feat/src/other.ts` is currently listed).

- [ ] **Step 3: Implement**

In `src/agnostic/ignore.ts`, add `.worktrees` to `DEFAULT_EXCLUDES`:

```ts
const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".doc-canon",
  ".worktrees",
] as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test tests/code-index-discovery.test.ts`
Expected: all tests PASS.

- [ ] **Step 5: Run the full suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/agnostic/ignore.ts tests/code-index-discovery.test.ts
git commit -m "fix: exclude .worktrees from code index discovery"
```

---

### Task 7: Dogfood rebuild, verification, and canon-audit

**Files:**
- No source changes. Verification only.
- Consumes: all Tasks 1–6.

- [ ] **Step 1: Build and rebuild this repo's own index**

Run: `npm run build && doc-canon code-index build`
Expected: index rebuilt; output no longer lists any `.worktrees/` files (Task 6).

- [ ] **Step 2: Verify real import edges and call-site edges exist**

Run: `doc-canon code-index search --refs openCanonIndex --json`
Expected: hits include `src/search/search.ts` (both the import-statement line 4 and the call site at line 40). Compare against the pre-fix result (zero hits) to confirm the fix.

- [ ] **Step 3: Verify `--body` and multi-token on the live repo**

Run:
```bash
doc-canon code-index search "sync index" --json
doc-canon code-index search "syncCanonIndex" --body --json
```
Expected: first returns `syncCanonIndex` (multi-token: tokens `sync`/`index` both in the name); second returns a snippet window running past 4 lines to `endLine`.

- [ ] **Step 4: Verify the whole suite once more**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Load and run canon-audit**

Load `.claude/skills/canon-audit/SKILL.md` via the skill tool and follow it to close the slice — confirm living canon matches the shipped behavior (import edges incl. call sites, `--body`, multi-token, `.worktrees` exclude), the DISCREPANCIES entry status is consistent, and no new divergences were introduced. Commit any canon refinements it produces.

- [ ] **Step 6: Final commit if the audit changed anything**

```bash
git add -A
git commit -m "docs(canon): audit code index quality slice (A+B)"
```
(If the audit produced no changes, skip this step.)
