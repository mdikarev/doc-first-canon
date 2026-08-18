# P2a Slice 1 (TypeScript/JavaScript) — Code AST Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first vertical slice of the P2a code AST index: `doc-canon code-index build` (+ `--watch`/`--stop`) that discovers TypeScript/JavaScript source roots, extracts symbols and syntactic references via pinned tree-sitter WASM, and writes a byte-deterministic dual artifact with hash-driven freshness.

**Subsequent slices:** Go, C#, Rust, and Python follow as separate vertical slices reusing the slice-1 pipeline shape (`src/code-index/*`). **GDScript is dropped** — out of scope for the whole P2a initiative; do not plan for it. This plan implements slice 1 only.

**Architecture:** Mirror the canon index pipeline (`src/index/*`) in a new `src/code-index/*` layer: discovery → config → listing → tree-sitter WASM extraction into a shared `CodeSymbol`/`CodeReference` model → `syncCodeIndex` (hash diff, full rebuild, atomic dual artifact) → `openCodeIndex` reader facade → CLI command with separate pid-lock watch. Byte-determinism replaces `index_id`/`built_at` with a deterministic `index_fingerprint`.

**Tech Stack:** Node.js ≥20, TypeScript ESM, `commander`, `micromatch`, `@vscode/tree-sitter-wasm` (pinned, CJS interop via `createRequire`).

**Spec:** [`docs/superpowers/specs/2026-08-18-p2a-code-ast-index-design.md`](../specs/2026-08-18-p2a-code-ast-index-design.md)

## Global Constraints

- Node.js ≥20, ESM (`"type": "module"`), TypeScript strict (`tsconfig.json` target ES2022, module NodeNext).
- `@vscode/tree-sitter-wasm` pinned to an **exact** version in `package.json` (no `^`/`~`).
- Code index artifacts: `.doc-canon/code-index-manifest.json` + `.doc-canon/code-ast-index.json`, both **byte-deterministic** (no `index_id`, no `built_at`).
- Watch pid file: `.doc-canon/code-index-watch.pid` (separate from the canon `index-watch.pid`).
- Config: `.doc-canon/code-index.json` with `roots`, `ignore`, `languages`; precedence **explicit config > manifests > extension scan**.
- Ignore default set: `node_modules`, `vendor`, `.venv`, `bin`, `obj`, `target`, `dist`, `build`, `coverage`, `.git`, `*.min.js`, `*.d.ts` — additive overrides via config.
- Relative paths in artifacts are posix (`/`), relative to the **VCS root**.
- The code index is fully independent of the canon contract (never reads `CANON_CONTRACT.md`).
- Every task ends with `npm test` green and a commit.
- Test command: `npm test` runs `tsx --test tests/**/*.test.ts`. Typecheck: `npm run build` (runs `tsc -p tsconfig.json`).

---

### Task 1: Add dependency and module skeleton

**Files:**
- Modify: `package.json` (dependencies + exports)
- Create: `src/code-index/types.ts`
- Create: `src/code-index/paths.ts`
- Create: `src/code-index/grammar-versions.ts`

**Interfaces:**
- Consumes: nothing (foundation)
- Produces:
  - `export type SymbolKind = "class" | "interface" | "enum" | "struct" | "trait" | "function" | "method" | "property" | "module" | "const" | "type";`
  - `export type ReferenceKind = "anchor" | "import" | "binding";`
  - `export type CodeSymbol = { name: string; kind: SymbolKind; signature: string; file: string; line: number; endLine: number; scope: string; };`
  - `export type CodeReference = { kind: ReferenceKind; from: string; to: string; name: string; line: number; };`
  - `export type CodeIndexFileMeta = { hash: string; language: string; symbols: number };`
  - `export type CodeIndexManifest = { schema_version: 1; index_fingerprint: string; corpus: string; grammar_versions: Record<string, string>; roots: string[]; files: Record<string, CodeIndexFileMeta> };`
  - `export type CodeAstIndex = { schema_version: 1; index_fingerprint: string; symbols: CodeSymbol[]; references: CodeReference[] };`
  - `export type CodeIndexConfig = { roots?: string[]; ignore?: string[]; languages?: Record<string, string> };`
  - `export type CodeSyncResult = { status: "fresh" | "updated"; indexed: number; changed: string[] };`
  - `export type CodeIndexHandle = { symbols(): CodeSymbol[]; references(): CodeReference[]; manifest: CodeIndexManifest; liveHashes(): Record<string, string> };`
  - `codeIndexManifestPath(root)`, `codeAstIndexPath(root)`, `codeIndexWatchPidPath(root)`, `codeIndexConfigPath(root)` (all in `src/code-index/paths.ts`)
  - `GRAMMAR_VERSIONS: Record<string, string>` in `src/code-index/grammar-versions.ts`
  - `VCS_INDEXABLE_EXTENSIONS: readonly string[]` = `[".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]` in `src/code-index/grammar-versions.ts`

- [ ] **Step 1: Install the pinned dependency**

Run: `npm install --save-exact @vscode/tree-sitter-wasm@0.3.1`
Expected: `package.json` gains `"@vscode/tree-sitter-wasm": "0.3.1"` in `dependencies` (no `^`/`~`).

- [ ] **Step 2: Create `src/code-index/types.ts`**

```ts
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
```

- [ ] **Step 3: Create `src/code-index/paths.ts`**

```ts
import path from "node:path";
import { docCanonDir } from "../paths.js";

export function codeIndexManifestPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-manifest.json");
}

export function codeAstIndexPath(root: string): string {
  return path.join(docCanonDir(root), "code-ast-index.json");
}

export function codeIndexWatchPidPath(root: string): string {
  return path.join(docCanonDir(root), "code-index-watch.pid");
}

export function codeIndexConfigPath(root: string): string {
  return path.join(docCanonDir(root), "code-index.json");
}
```

- [ ] **Step 4: Create `src/code-index/grammar-versions.ts`**

```ts
export const VCS_INDEXABLE_EXTENSIONS: readonly string[] = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
];

export const GRAMMAR_VERSIONS: Record<string, string> = {
  typescript: "0.23.2",
  tsx: "0.23.2",
  javascript: "0.25.0",
};
```

(The version strings match the grammar versions bundled in `@vscode/tree-sitter-wasm@0.3.1`. Bump them together with the dependency.)

- [ ] **Step 5: Add the reader export to `package.json`**

In `package.json` `exports`, add:
```json
"./code-index-reader": "./dist/code-index/reader.js"
```

- [ ] **Step 6: Typecheck and commit**

Run: `npm run build`
Expected: exit 0, `dist/code-index/*.js` emitted.

```bash
git add package.json package-lock.json src/code-index/types.ts src/code-index/paths.ts src/code-index/grammar-versions.ts
git commit -m "feat: add code-index types, paths, grammar stamp skeleton"
```

---

### Task 2: Config loader

**Files:**
- Create: `src/code-index/config.ts`
- Test: `tests/code-index-config.test.ts`

**Interfaces:**
- Consumes: `codeIndexConfigPath` (Task 1)
- Produces: `export function loadCodeIndexConfig(root: string): CodeIndexConfig` — returns `{}` when the file is absent, throws `Error("invalid code-index config: <msg>")` on malformed JSON, and returns a normalized config otherwise.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-index-config.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCodeIndexConfig } from "../src/code-index/config.js";
import { codeIndexConfigPath } from "../src/code-index/paths.js";

describe("loadCodeIndexConfig", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-config-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("returns empty config when no file exists", () => {
    assert.deepEqual(loadCodeIndexConfig(root), {});
  });

  it("reads roots, ignore, languages", () => {
    fs.writeFileSync(
      codeIndexConfigPath(root),
      JSON.stringify({
        roots: ["src", "packages/app"],
        ignore: ["generated/**"],
        languages: { "src/gen": "typescript" },
      }),
    );
    assert.deepEqual(loadCodeIndexConfig(root), {
      roots: ["src", "packages/app"],
      ignore: ["generated/**"],
      languages: { "src/gen": "typescript" },
    });
  });

  it("throws on malformed JSON", () => {
    fs.writeFileSync(codeIndexConfigPath(root), "{not-json");
    assert.throws(() => loadCodeIndexConfig(root), /invalid code-index config/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-config.test.ts`
Expected: FAIL with module-not-found / function-undefined error.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/code-index/config.ts
import fs from "node:fs";
import { codeIndexConfigPath } from "./paths.js";
import type { CodeIndexConfig } from "./types.js";

export function loadCodeIndexConfig(root: string): CodeIndexConfig {
  const configPath = codeIndexConfigPath(root);
  if (!fs.existsSync(configPath)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `invalid code-index config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("invalid code-index config: expected an object");
  }
  const record = raw as Record<string, unknown>;
  const roots =
    Array.isArray(record.roots) && record.roots.every((v) => typeof v === "string")
      ? (record.roots as string[])
      : undefined;
  const ignore =
    Array.isArray(record.ignore) && record.ignore.every((v) => typeof v === "string")
      ? (record.ignore as string[])
      : undefined;
  let languages: Record<string, string> | undefined;
  if (
    typeof record.languages === "object" &&
    record.languages !== null &&
    !Array.isArray(record.languages)
  ) {
    languages = Object.fromEntries(
      Object.entries(record.languages as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>;
  }
  if (record.roots !== undefined && roots === undefined) {
    throw new Error("invalid code-index config: roots must be string[]");
  }
  if (record.ignore !== undefined && ignore === undefined) {
    throw new Error("invalid code-index config: ignore must be string[]");
  }
  return { roots, ignore, languages };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-index-config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`
Expected: all green (existing + new).

```bash
git add src/code-index/config.ts tests/code-index-config.test.ts
git commit -m "feat: load code-index config with validation"
```

---

### Task 3: Source-root discovery and file listing

**Files:**
- Create: `src/code-index/discovery.ts`
- Create: `src/code-index/list.ts`
- Test: `tests/code-index-discovery.test.ts`

**Interfaces:**
- Consumes: `loadCodeIndexConfig`, `VCS_INDEXABLE_EXTENSIONS`, `isIgnored` (`src/agnostic/ignore.ts`), `contentHash` (`src/index/hash.ts`)
- Produces:
  - `export function findVcsRoot(start: string): string` — up-search for `.git`; throws `Error("no VCS root (.git) found under <start>")` when absent.
  - `export function discoverSourceRoots(root: string, config: CodeIndexConfig): { vcsRoot: string; roots: string[] }` — precedence: explicit `config.roots` (resolved relative to `vcsRoot`) > manifest detection > extension fallback.
  - `export function discoverManifestRoots(vcsRoot: string): string[]` — walks the tree for `package.json`, skipping ignored dirs; each manifest's dir is a root; nested manifests are separate roots.
  - `export function listSourceFiles(vcsRoot: string, roots: string[], ignoreGlobs: string[]): string[]` — walks each root, applies ignore, filters by indexable extensions; returns sorted posix paths relative to `vcsRoot`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-index-discovery.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  discoverSourceRoots,
  findVcsRoot,
  listSourceFiles,
} from "../src/code-index/discovery.js";
import type { CodeIndexConfig } from "../src/code-index/types.js";

function write(root: string, rel: string, body = ""): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-repo-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

describe("code-index discovery", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("findVcsRoot finds .git upward", () => {
    const nested = path.join(repo, "a", "b");
    fs.mkdirSync(nested, { recursive: true });
    assert.equal(findVcsRoot(nested), repo);
  });

  it("findVcsRoot throws when no .git exists", () => {
    // The filesystem root cannot contain a .git, so this always throws.
    assert.throws(
      () => findVcsRoot(path.parse(process.cwd()).root),
      /no VCS root/,
    );
  });

  it("manifest roots: package.json dir becomes a root", () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export const x = 1;");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/index.ts"]);
  });

  it("nested manifests are separate roots; files in both are listed once", () => {
    write(repo, "package.json", "{}");
    write(repo, "packages/a/package.json", "{}");
    write(repo, "packages/a/a.ts", "export const a = 1;");
    write(repo, "src/index.ts", "export const x = 1;");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(roots, ["", "packages/a"]);
    const files = listSourceFiles(vcsRoot, roots, []);
    assert.deepEqual(files, ["packages/a/a.ts", "src/index.ts"]);
  });

  it("extension fallback when no manifest exists", () => {
    write(repo, "src/index.ts", "export const x = 1;");
    write(repo, "README.md", "not code");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/index.ts"]);
  });

  it("explicit config roots override manifest roots", () => {
    write(repo, "package.json", "{}");
    write(repo, "lib/thing.ts", "export const t = 1;");
    write(repo, "src/index.ts", "export const x = 1;");
    const config: CodeIndexConfig = { roots: ["lib"] };
    const { vcsRoot, roots } = discoverSourceRoots(repo, config);
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, ["lib"]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["lib/thing.ts"]);
  });

  it("default ignore excludes node_modules and dist", () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export const x = 1;");
    write(repo, "node_modules/pkg/index.js", "module.exports = 1;");
    write(repo, "dist/bundle.js", "console.log(1);");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/index.ts"]);
  });

  it("config ignore adds overrides", () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export const x = 1;");
    write(repo, "src/generated/thing.ts", "export const g = 1;");
    const config: CodeIndexConfig = { ignore: ["generated/**"] };
    const { vcsRoot, roots } = discoverSourceRoots(repo, config);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, config.ignore ?? []), [
      "src/index.ts",
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-discovery.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/code-index/discovery.ts
import fs from "node:fs";
import path from "node:path";
import { isIgnored } from "../agnostic/ignore.js";
import { VCS_INDEXABLE_EXTENSIONS } from "./grammar-versions.js";
import type { CodeIndexConfig } from "./types.js";

export function findVcsRoot(start: string): string {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`no VCS root (.git) found under ${start}`);
    }
    dir = parent;
  }
}

export function discoverManifestRoots(vcsRoot: string): string[] {
  const roots: string[] = [];
  const stack = [""];
  while (stack.length > 0) {
    const rel = stack.pop()!;
    const abs = rel === "" ? vcsRoot : path.join(vcsRoot, rel);
    if (isIgnored(rel, [])) continue;
    if (fs.existsSync(path.join(abs, "package.json"))) {
      roots.push(rel);
      continue;
    }
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      if (ent.isDirectory()) {
        stack.push(rel === "" ? ent.name : path.posix.join(rel, ent.name));
      }
    }
  }
  roots.sort();
  return roots;
}

export function discoverSourceRoots(
  root: string,
  config: CodeIndexConfig,
): { vcsRoot: string; roots: string[] } {
  const vcsRoot = findVcsRoot(root);
  if (config.roots && config.roots.length > 0) {
    const roots = config.roots.map((r) =>
      r === "." ? "" : path.posix.normalize(r).replace(/^\.\//, ""),
    );
    roots.sort();
    return { vcsRoot, roots };
  }
  const manifestRoots = discoverManifestRoots(vcsRoot);
  const roots = manifestRoots.length > 0 ? manifestRoots : [""];
  return { vcsRoot, roots };
}

function isIndexableFile(rel: string): boolean {
  const ext = path.extname(rel).toLowerCase();
  return VCS_INDEXABLE_EXTENSIONS.includes(ext);
}

export function listSourceFiles(
  vcsRoot: string,
  roots: string[],
  ignoreGlobs: string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const walk = (relDir: string): void => {
    const abs = relDir === "" ? vcsRoot : path.join(vcsRoot, relDir);
    for (const ent of fs.readdirSync(abs, { withFileTypes: true })) {
      const rel = relDir === "" ? ent.name : path.posix.join(relDir, ent.name);
      if (isIgnored(rel, ignoreGlobs)) continue;
      if (ent.isDirectory()) {
        walk(rel);
      } else if (ent.isFile() && isIndexableFile(rel)) {
        if (!seen.has(rel)) {
          seen.add(rel);
          out.push(rel);
        }
      }
    }
  };

  for (const relRoot of roots) walk(relRoot);
  out.sort();
  return out;
}
```

Note: `isIgnored(rel, ignoreGlobs)` from `src/agnostic/ignore.ts` already merges `DEFAULT_IGNORE_GLOBS` with the caller's `ignoreGlobs`, so there is no duplicate matching logic here.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-index-discovery.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Run full suite and commit**

Run: `npm test`
Expected: all green.

```bash
git add src/code-index/discovery.ts src/code-index/list.ts tests/code-index-discovery.test.ts
git commit -m "feat: discover source roots and list indexable files"
```

---

### Task 4: tree-sitter WASM bootstrap and symbol extraction (TS/JS)

**Files:**
- Create: `src/code-index/parser.ts`
- Create: `src/code-index/extractors/typescript.ts`
- Test: `tests/code-index-extractor.test.ts`

**Interfaces:**
- Consumes: `CodeSymbol`, `CodeReference`, `SymbolKind`, `GRAMMAR_VERSIONS`
- Produces:
  - `export function grammarForFile(rel: string): "typescript" | "tsx" | "javascript"` — `.tsx`→`tsx`, `.ts`→`typescript`, else `javascript`.
  - `export async function extractFile(rel: string, text: string, knownFiles: Set<string>): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }>`
  - `export function createParser(language: Language): Parser` (in `parser.ts`)
  - `export async function loadGrammar(name: string): Promise<Language>` (in `parser.ts`) — caches per grammar name.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-index-extractor.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/typescript.js";

describe("grammarForFile", () => {
  it("maps extensions to grammars", () => {
    assert.equal(grammarForFile("a.ts"), "typescript");
    assert.equal(grammarForFile("a.tsx"), "tsx");
    assert.equal(grammarForFile("a.js"), "javascript");
    assert.equal(grammarForFile("a.mjs"), "javascript");
    assert.equal(grammarForFile("a.cjs"), "javascript");
  });
});

describe("extractFile symbols", () => {
  it("extracts class, method, property, function, const, type", async () => {
    const text = `export type Handle = { score(q: string): number };
export class Reader {
  private scores: number[] = [];
  score(q: string): number {
    const n = 1;
    return this.scores.length + n;
  }
}
export function openReader(): Reader {
  return new Reader();
}
export const DEFAULT = openReader();
export enum Kind { A, B }
export namespace NS { export const v = 1; }`;
    const { symbols } = await extractFile("src/reader.ts", text, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.Handle.kind, "type");
    assert.equal(byName.Reader.kind, "class");
    assert.equal(byName.score.kind, "method");
    assert.equal(byName.openReader.kind, "function");
    assert.equal(byName.DEFAULT.kind, "const");
    assert.equal(byName.Kind.kind, "enum");
    assert.equal(byName.NS.kind, "module");
    assert.equal(byName.score.scope, "Reader");
    assert.ok(byName.Reader.file === "src/reader.ts");
    assert.ok(byName.score.line > 0 && byName.score.endLine >= byName.score.line);
  });

  it("extracts interface and nested method in interface", async () => {
    const { symbols } = await extractFile(
      "src/api.ts",
      `export interface Api { get(id: string): Promise<string>; }`,
      new Set(),
    );
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.Api.kind, "interface");
    assert.equal(byName.get.kind, "method");
    assert.equal(byName.get.scope, "Api");
  });
});
```

(Reference extraction has its own test file in Task 5; `extractFile` in Task 4 returns `references: []` until then.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-extractor.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write `src/code-index/parser.ts`**

```ts
// src/code-index/parser.ts
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const wasmPackageDir = path.dirname(
  require.resolve("@vscode/tree-sitter-wasm"),
);

type TreeSitterModule = {
  Parser: {
    new (): {
      setLanguage(language: unknown): void;
      parse(text: string): Tree | null;
    };
    init(options?: { locateFile?: (file: string, folder: string) => string }): Promise<void>;
  };
  Language: {
    load(pathOrBytes: string | Uint8Array): Promise<unknown>;
  };
};

export type Tree = {
  rootNode: Node;
  delete(): void;
};

export type Node = {
  type: string;
  text: string;
  childForFieldName(name: string): Node | null;
  namedChildren: Node[];
  children: Node[];
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  parent: Node | null;
};

export type Language = unknown;

const ts = require("@vscode/tree-sitter-wasm") as TreeSitterModule;

let parserInited = false;
const grammarCache = new Map<string, Language>();

export async function loadGrammar(name: string): Promise<Language> {
  const cached = grammarCache.get(name);
  if (cached) return cached;
  if (!parserInited) {
    await ts.Parser.init({
      locateFile: (file) => path.join(wasmPackageDir, "wasm", file),
    });
    parserInited = true;
  }
  const wasmPath = path.join(wasmPackageDir, "wasm", `tree-sitter-${name}.wasm`);
  const language = await ts.Language.load(wasmPath);
  grammarCache.set(name, language);
  return language;
}

export function createParser(language: Language) {
  const parser = new ts.Parser();
  parser.setLanguage(language);
  return parser;
}
```

- [ ] **Step 4: Write `src/code-index/extractors/typescript.ts`**

```ts
// src/code-index/extractors/typescript.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import type {
  CodeReference,
  CodeSymbol,
  ReferenceKind,
  SymbolKind,
} from "../types.js";

export function grammarForFile(rel: string): "typescript" | "tsx" | "javascript" {
  if (rel.endsWith(".tsx")) return "tsx";
  if (rel.endsWith(".ts")) return "typescript";
  return "javascript";
}

const SYMBOL_NODE_KINDS: Record<string, SymbolKind> = {
  class_declaration: "class",
  interface_declaration: "interface",
  enum_declaration: "enum",
  function_declaration: "function",
  method_definition: "method",
  method_signature: "method",
  property_signature: "property",
  public_field_definition: "property",
  type_alias_declaration: "type",
  internal_module: "module",
};

const DECLARATION_TYPES = new Set(Object.keys(SYMBOL_NODE_KINDS));

function firstLine(text: string): string {
  const line = text.split("\n")[0].trim();
  return line;
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
}

type DeclContext = {
  scope: string;
  symbols: CodeSymbol[];
  references: CodeReference[];
  declarationNames: Set<string>;
  file: string;
};

function walkSymbols(
  node: Node,
  ctx: DeclContext,
  knownFiles: Set<string>,
): void {
  const kind = SYMBOL_NODE_KINDS[node.type];

  if (DECLARATION_TYPES.has(node.type)) {
    const name = nodeName(node);
    if (name) {
      const symbol: CodeSymbol = {
        name,
        kind: kind!,
        signature: firstLine(node.text),
        file: ctx.file,
        line: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        scope: ctx.scope,
      };
      ctx.symbols.push(symbol);
      ctx.declarationNames.add(name);
      const childScope = kind === "class" || kind === "interface" ? name : ctx.scope;
      for (const child of node.namedChildren) {
        walkSymbols(child, { ...ctx, scope: childScope }, knownFiles);
      }
      return;
    }
  }

  if (node.type === "lexical_declaration") {
    const kind = node.text.trim().startsWith("const") ? "const" : null;
    if (kind) {
      for (const child of node.namedChildren) {
        if (child.type === "variable_declarator") {
          const name = nodeName(child);
          if (name) {
            ctx.symbols.push({
              name,
              kind,
              signature: firstLine(child.text),
              file: ctx.file,
              line: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
              scope: ctx.scope,
            });
            ctx.declarationNames.add(name);
          }
        }
      }
    }
    for (const child of node.namedChildren) {
      walkSymbols(child, ctx, knownFiles);
    }
    return;
  }

  for (const child of node.namedChildren) {
    walkSymbols(child, ctx, knownFiles);
  }
}

export async function extractFile(
  rel: string,
  text: string,
  knownFiles: Set<string>,
): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }> {
  const grammar = grammarForFile(rel);
  const language = await loadGrammar(grammar);
  const parser = createParser(language);
  const tree = parser.parse(text);
  if (tree === null) {
    return { symbols: [], references: [] };
  }
  try {
    const ctx: DeclContext = {
      scope: "",
      symbols: [],
      references: [],
      declarationNames: new Set(),
      file: rel,
    };
    walkSymbols(tree.rootNode, ctx, knownFiles);
    ctx.symbols.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name),
    );
    return { symbols: ctx.symbols, references: ctx.references };
  } finally {
    tree.delete();
  }
}
```

Note: references are extracted in Task 5; `extractFile` returns `references: []` for now but the contract is fixed. The Task 5 test for references will be added then; Task 4's test only asserts `references` exists.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/code-index-extractor.test.ts`
Expected: the 4 symbol/grammar tests PASS; the two reference tests FAIL (`import`/`anchor`/`binding` references are empty). If the grammar load fails (wasm path wrong), fix `wasmPackageDir` resolution: assert the file `node_modules/@vscode/tree-sitter-wasm/wasm/tree-sitter-typescript.wasm` exists and that `require.resolve("@vscode/tree-sitter-wasm")` points inside `node_modules/@vscode/tree-sitter-wasm/`.

- [ ] **Step 6: Typecheck**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit (symbol extraction only)**

```bash
git add src/code-index/parser.ts src/code-index/extractors/typescript.ts tests/code-index-extractor.test.ts
git commit -m "feat: tree-sitter WASM bootstrap and TS/JS symbol extraction"
```

---

### Task 5: Reference extraction (anchors, imports, bindings)

**Files:**
- Modify: `src/code-index/extractors/typescript.ts`
- Modify: `tests/code-index-extractor.test.ts` (finish the two reference tests)
- Test: `tests/code-index-references.test.ts`

**Interfaces:**
- Consumes: Task 4 `extractFile`, `walkSymbols` context
- Produces: reference extraction inside `extractFile` — after symbols are collected, walk the tree again:
  - `anchor` — a same-file identifier/type/property node whose text equals a declared symbol name and is not itself the declaration (to === from).
  - `import` — `import {x} from "./y"` / `import x from "./y"` / `import * as x from "./y"`; `to` is the resolved file path (try exact, then `.ts/.tsx/.js/.jsx/.mjs/.cjs`, then `index.*` variants) against `knownFiles`; skipped when the specifier is a bare package name (no `./`/`../`) or unresolvable.
  - `binding` — an identifier whose text equals a `const`/parameter name declared in the same file (to === from).

- [ ] **Step 1: Write the failing reference tests**

```ts
// tests/code-index-references.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile } from "../src/code-index/extractors/typescript.js";

describe("extractFile references", () => {
  it("extracts anchors for same-file symbol usages", async () => {
    const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    const anchors = references.filter((r) => r.kind === "anchor");
    assert.ok(anchors.some((r) => r.name === "Reader" && r.to === "src/reader.ts"));
  });

  it("extracts import edges resolved against knownFiles", async () => {
    const text = `import { openReader, Reader } from "./reader";
import * as NS from "./ns";
import def from "./def";
export function run(): number {
  const r: Reader = openReader();
  return r.score("q");
}`;
    const known = new Set(["src/reader.ts", "src/ns.ts", "src/def.ts", "src/run.ts"]);
    const { references } = await extractFile("src/run.ts", text, known);
    const imports = references
      .filter((r) => r.kind === "import")
      .sort((a, b) => (a.name + a.to).localeCompare(b.name + b.to));
    assert.deepEqual(
      imports.map((r) => ({ name: r.name, to: r.to, from: r.from })),
      [
        { name: "NS", to: "src/ns.ts", from: "src/run.ts" },
        { name: "Reader", to: "src/reader.ts", from: "src/run.ts" },
        { name: "def", to: "src/def.ts", from: "src/run.ts" },
        { name: "openReader", to: "src/reader.ts", from: "src/run.ts" },
      ],
    );
  });

  it("resolves extensionless and index imports", async () => {
    const text = `import { a } from "./mod";
import { b } from "./dir";`;
    const known = new Set(["src/mod.ts", "src/dir/index.ts", "src/a.ts"]);
    const { references } = await extractFile("src/a.ts", text, known);
    const imports = references.filter((r) => r.kind === "import").sort((x, y) => x.name.localeCompare(y.name));
    assert.deepEqual(
      imports.map((r) => ({ name: r.name, to: r.to })),
      [
        { name: "a", to: "src/mod.ts" },
        { name: "b", to: "src/dir/index.ts" },
      ],
    );
  });

  it("skips bare-package imports", async () => {
    const text = `import { x } from "commander";`;
    const { references } = await extractFile("src/a.ts", text, new Set());
    assert.equal(references.filter((r) => r.kind === "import").length, 0);
  });

  it("extracts bindings for const and parameter usages", async () => {
    const text = `export function run(q: string): number {
  const n = 1;
  return n + q.length + q.length;
}`;
    const { references } = await extractFile("src/run.ts", text, new Set());
    const bindings = references.filter((r) => r.kind === "binding");
    const names = bindings.map((r) => r.name).sort();
    assert.ok(names.includes("n"));
    assert.ok(names.includes("q"));
    assert.equal(bindings.filter((r) => r.name === "q").length, 2);
  });

  it("does not emit anchors/bindings for declaration names themselves", async () => {
    const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    const declNameRefs = references.filter(
      (r) => r.kind === "anchor" && r.name === "openReader" && r.line === 1,
    );
    assert.equal(declNameRefs.length, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: FAIL (references are empty).

- [ ] **Step 3: Implement reference extraction**

Replace the Task 4 `extractFile` body so that after symbol collection it computes references. Add these helpers to `src/code-index/extractors/typescript.ts`:

```ts
type WalkCtx = {
  file: string;
  knownFiles: Set<string>;
  symbols: CodeSymbol[];
  references: CodeReference[];
  declarationPositions: Set<string>;
};

function declKey(file: string, line: number, name: string): string {
  return `${file}:${line}:${name}`;
}

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const nameNodeTypes = new Set([
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "function_declaration",
    "method_definition",
    "method_signature",
    "property_signature",
    "public_field_definition",
    "type_alias_declaration",
    "internal_module",
    "variable_declarator",
    "required_parameter",
    "optional_parameter",
  ]);
  const visit = (n: Node): void => {
    if (nameNodeTypes.has(n.type)) {
      const name = n.childForFieldName("name");
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function isImportContext(node: Node): boolean {
  let cur: Node | null = node;
  while (cur) {
    if (cur.type === "import_statement" || cur.type === "import_clause") {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}
function collectImportNames(importNode: Node): string[] {
  const names: string[] = [];
  const visit = (n: Node): void => {
    if (n.type === "import_specifier") {
      const name = n.childForFieldName("name")?.text;
      if (name) names.push(name);
      return;
    }
    if (n.type === "namespace_import") {
      const id = n.namedChildren.find((c) => c.type === "identifier");
      if (id) names.push(id.text);
      return;
    }
    if (n.type === "identifier") {
      names.push(n.text);
      return;
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(importNode);
  return names;
}

function collectImportEdges(root: Node, ctx: WalkCtx): void {
  const visit = (node: Node): void => {
    if (node.type === "import_statement") {
      const sourceNode = node.namedChildren.find((c) => c.type === "string");
      const source = sourceNode?.text.replace(/['"]/g, "") ?? "";
      if (source.startsWith("./") || source.startsWith("../")) {
        const names = collectImportNames(node);
        const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
        if (resolved) {
          for (const name of names) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: resolved,
              name,
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

function resolveImportPath(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const base = pathPosixJoin(dir, specifier);
  const candidates = [
    base,
    ...VCS_INDEXABLE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...VCS_INDEXABLE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}

function pathPosixJoin(a: string, b: string): string {
  const joined = `${a}/${b}`.split("/").filter((p) => p !== ".").join("/");
  const parts: string[] = [];
  for (const p of joined.split("/")) {
    if (p === "..") parts.pop();
    else if (p) parts.push(p);
  }
  return parts.join("/");
}

function collectAnchorAndBindingRefs(root: Node, ctx: WalkCtx): void {
  const symbolNames = new Set(ctx.symbols.map((s) => s.name));
  const bindingNames = collectBindingNames(root);
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
      if (ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        // declaration name itself; skip
      } else if (symbolNames.has(name)) {
        ctx.references.push({
          kind: "anchor",
          from: ctx.file,
          to: ctx.file,
          name,
          line,
        });
      } else if (bindingNames.has(name)) {
        ctx.references.push({
          kind: "binding",
          from: ctx.file,
          to: ctx.file,
          name,
          line,
        });
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "lexical_declaration") {
      for (const child of node.namedChildren) {
        if (child.type === "variable_declarator") {
          const name = child.childForFieldName("name")?.text;
          if (name) names.add(name);
        }
      }
    }
    if (node.type === "formal_parameters") {
      for (const child of node.namedChildren) {
        const name = child.childForFieldName("name")?.text;
        if (name) names.add(name);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return names;
}
```

Then in `extractFile`, after `walkSymbols`, replace the empty-references return with:

```ts
const ctxRefs: WalkCtx = {
  file: rel,
  knownFiles,
  symbols: ctx.symbols,
  references: [],
  declarationPositions: collectDeclarationPositions(tree.rootNode, rel),
};
collectImportEdges(tree.rootNode, ctxRefs);
collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
ctxRefs.references.sort(
  (a, b) =>
    a.from.localeCompare(b.from) ||
    a.line - b.line ||
    a.name.localeCompare(b.name) ||
    a.kind.localeCompare(b.kind) ||
    a.to.localeCompare(b.to),
);
return { symbols: ctx.symbols, references: ctxRefs.references };
```

Also update `src/code-index/extractors/typescript.ts` imports to include `VCS_INDEXABLE_EXTENSIONS` from `../grammar-versions.js`.

- [ ] **Step 4: Run reference tests to verify they pass**

Run: `npx tsx --test tests/code-index-references.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Run extractor tests to verify the Task 4 reference assertions now pass**

Run: `npx tsx --test tests/code-index-extractor.test.ts`
Expected: PASS (6 tests) — the two reference tests now pass with the implemented references.

- [ ] **Step 6: Run full suite and commit**

Run: `npm test`
Expected: all green.

```bash
git add src/code-index/extractors/typescript.ts tests/code-index-references.test.ts tests/code-index-extractor.test.ts
git commit -m "feat: extract anchors, import edges, and bindings for TS/JS"
```

---

### Task 6: Index IO and sync

**Files:**
- Create: `src/code-index/io.ts`
- Create: `src/code-index/sync.ts`
- Test: `tests/code-index-io.test.ts`
- Test: `tests/code-index-sync.test.ts`

**Interfaces:**
- Consumes: Task 1 types, Task 2 config, Task 3 discovery/list, Task 4 `extractFile`, `contentHash` (`src/index/hash.ts`), `GRAMMAR_VERSIONS`
- Produces:
  - `export function saveCodeIndexPair(root: string, manifest: CodeIndexManifest, ast: CodeAstIndex): void` — atomic tmp+rename; writes `code-ast-index.json` **then** `code-index-manifest.json`; throws if `manifest.index_fingerprint !== ast.index_fingerprint`.
  - `export function loadCodeIndexPair(root: string): { manifest: CodeIndexManifest; ast: CodeAstIndex }` — throws on missing/corrupt/schema mismatch/fingerprint mismatch.
  - `export function tryLoadCodeIndexManifest(root: string): CodeIndexManifest | null`
  - `export async function syncCodeIndex(root: string): Promise<CodeSyncResult>` — resolve `findVcsRoot`, load config, discover roots, list files, hash-diff against existing manifest + `grammar_versions` compare, and either return `{ status: "fresh", ... }` or rebuild fully and save.
  - `export function computeFingerprint(relHashes: Array<[string, string]>): string` — sha256 over `rel:hash` lines joined by `\n`.

- [ ] **Step 1: Write the failing IO test**

```ts
// tests/code-index-io.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codeAstIndexPath, codeIndexManifestPath } from "../src/code-index/paths.js";
import { loadCodeIndexPair, saveCodeIndexPair } from "../src/code-index/io.js";
import type { CodeAstIndex, CodeIndexManifest } from "../src/code-index/types.js";

const MANIFEST: CodeIndexManifest = {
  schema_version: 1,
  index_fingerprint: "fp-1",
  corpus: "src/**",
  grammar_versions: { typescript: "0.23.2" },
  roots: ["src"],
  files: { "src/index.ts": { hash: "sha256:abc", language: "typescript", symbols: 1 } },
};

const AST: CodeAstIndex = {
  schema_version: 1,
  index_fingerprint: "fp-1",
  symbols: [],
  references: [],
};

describe("code-index io", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-io-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("saves and loads a matching pair", () => {
    saveCodeIndexPair(root, MANIFEST, AST);
    const pair = loadCodeIndexPair(root);
    assert.equal(pair.manifest.index_fingerprint, "fp-1");
    assert.equal(pair.ast.index_fingerprint, "fp-1");
    assert.deepEqual(pair.manifest.roots, ["src"]);
    assert.ok(fs.existsSync(codeAstIndexPath(root)));
    assert.ok(fs.existsSync(codeIndexManifestPath(root)));
  });

  it("throws on missing pair", () => {
    assert.throws(() => loadCodeIndexPair(root), /not found/);
  });

  it("throws on fingerprint mismatch", () => {
    saveCodeIndexPair(root, MANIFEST, { ...AST, index_fingerprint: "fp-2" });
    assert.throws(() => loadCodeIndexPair(root), /fingerprint mismatch/);
  });

  it("throws on corrupt manifest json", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexManifestPath(root), "{not-json");
    fs.writeFileSync(codeAstIndexPath(root), JSON.stringify(AST));
    assert.throws(() => loadCodeIndexPair(root), /invalid/i);
  });

  it("write order: ast before manifest (manifest is the commit marker)", () => {
    saveCodeIndexPair(root, MANIFEST, AST);
    assert.ok(fs.existsSync(codeAstIndexPath(root)));
    assert.ok(fs.existsSync(codeIndexManifestPath(root)));
  });
});
```

- [ ] **Step 2: Write the failing sync test**

```ts
// tests/code-index-sync.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexPair, tryLoadCodeIndexManifest } from "../src/code-index/io.js";
import { openCodeIndex } from "../src/code-index/reader.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-sync-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

const SOURCE = `export type Handle = { score(q: string): number };
export class Reader { score(q: string): number { return 1; } }
export function openReader(): Reader { return new Reader(); }`;

describe("syncCodeIndex", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", SOURCE);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("builds both artifacts and opens via reader", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
    const pair = loadCodeIndexPair(repo);
    assert.equal(pair.manifest.index_fingerprint, pair.ast.index_fingerprint);
    assert.equal(pair.manifest.roots.length, 1);
    assert.equal(pair.manifest.files["src/reader.ts"].language, "typescript");
    assert.ok(pair.manifest.files["src/reader.ts"].symbols > 0);
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "Reader"));
  });

  it("is byte-deterministic across two builds on identical input", async () => {
    await syncCodeIndex(repo);
    const pair1 = loadCodeIndexPair(repo);
    const manifest1 = JSON.stringify(pair1.manifest);
    const ast1 = JSON.stringify(pair1.ast);
    const r2 = await syncCodeIndex(repo);
    assert.equal(r2.status, "fresh");
    const pair2 = loadCodeIndexPair(repo);
    assert.equal(JSON.stringify(pair2.manifest), manifest1);
    assert.equal(JSON.stringify(pair2.ast), ast1);
  });

  it("returns fresh and does not rewrite when unchanged", async () => {
    await syncCodeIndex(repo);
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const before = fs.readFileSync(manifestPath, "utf8");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "fresh");
    assert.equal(fs.readFileSync(manifestPath, "utf8"), before);
  });

  it("rebuilds on edit", async () => {
    await syncCodeIndex(repo);
    write(repo, "src/reader.ts", SOURCE + "\nexport const extra = 1;");
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.ok(r.changed.includes("src/reader.ts"));
  });

  it("rebuilds on delete", async () => {
    await syncCodeIndex(repo);
    fs.unlinkSync(path.join(repo, "src/reader.ts"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 0);
  });

  it("works on a repo without package.json (extension fallback)", async () => {
    fs.unlinkSync(path.join(repo, "package.json"));
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 1);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx tsx --test tests/code-index-io.test.ts`
Run: `npx tsx --test tests/code-index-sync.test.ts`
Expected: FAIL with module-not-found for both.

- [ ] **Step 4: Write `src/code-index/io.ts`**

```ts
// src/code-index/io.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { codeAstIndexPath, codeIndexManifestPath } from "./paths.js";
import type { CodeAstIndex, CodeIndexFileMeta, CodeIndexManifest } from "./types.js";

function writeJsonAtomic(file: string, data: unknown): void {
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  fs.renameSync(tmp, file);
}

function readJson(file: string): unknown {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function parseManifest(raw: unknown): CodeIndexManifest {
  if (!isRecord(raw)) throw new Error("invalid code-index manifest");
  if (raw.schema_version !== 1) {
    throw new Error(`unsupported code-index manifest schema_version: ${String(raw.schema_version)}`);
  }
  if (
    !isString(raw.index_fingerprint) ||
    !isString(raw.corpus) ||
    !isRecord(raw.grammar_versions) ||
    !Array.isArray(raw.roots) ||
    !raw.roots.every(isString) ||
    !isRecord(raw.files)
  ) {
    throw new Error("invalid code-index manifest");
  }
  for (const meta of Object.values(raw.files)) {
    if (
      !isRecord(meta) ||
      !isString(meta.hash) ||
      !isString(meta.language) ||
      !isNumber(meta.symbols)
    ) {
      throw new Error("invalid code-index manifest");
    }
  }
  return raw as CodeIndexManifest;
}

function parseAst(raw: unknown): CodeAstIndex {
  if (!isRecord(raw)) throw new Error("invalid code-ast-index");
  if (raw.schema_version !== 1) {
    throw new Error(`unsupported code-ast-index schema_version: ${String(raw.schema_version)}`);
  }
  if (!isString(raw.index_fingerprint) || !Array.isArray(raw.symbols) || !Array.isArray(raw.references)) {
    throw new Error("invalid code-ast-index");
  }
  return raw as CodeAstIndex;
}

export function saveCodeIndexPair(
  root: string,
  manifest: CodeIndexManifest,
  ast: CodeAstIndex,
): void {
  if (manifest.index_fingerprint !== ast.index_fingerprint) {
    throw new Error(
      `index_fingerprint mismatch: manifest=${manifest.index_fingerprint} ast=${ast.index_fingerprint}`,
    );
  }
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  writeJsonAtomic(codeAstIndexPath(root), ast);
  writeJsonAtomic(codeIndexManifestPath(root), manifest);
}

export function loadCodeIndexPair(
  root: string,
): { manifest: CodeIndexManifest; ast: CodeAstIndex } {
  const manifestPath = codeIndexManifestPath(root);
  const astPath = codeAstIndexPath(root);
  if (!fs.existsSync(manifestPath) || !fs.existsSync(astPath)) {
    throw new Error("code index pair not found");
  }
  const manifest = parseManifest(readJson(manifestPath));
  const ast = parseAst(readJson(astPath));
  if (manifest.index_fingerprint !== ast.index_fingerprint) {
    throw new Error(
      `index_fingerprint mismatch: manifest=${manifest.index_fingerprint} ast=${ast.index_fingerprint}`,
    );
  }
  return { manifest, ast };
}

export function tryLoadCodeIndexManifest(root: string): CodeIndexManifest | null {
  const manifestPath = codeIndexManifestPath(root);
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return parseManifest(readJson(manifestPath));
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Write `src/code-index/sync.ts`**

```ts
// src/code-index/sync.ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { extractFile, grammarForFile } from "./extractors/typescript.js";
import { GRAMMAR_VERSIONS } from "./grammar-versions.js";
import { saveCodeIndexPair, tryLoadCodeIndexManifest } from "./io.js";
import type { CodeAstIndex, CodeIndexManifest, CodeSyncResult } from "./types.js";

export function computeFingerprint(relHashes: Array<[string, string]>): string {
  const lines = relHashes
    .map(([rel, hash]) => `${rel}:${hash}`)
    .sort()
    .join("\n");
  const hex = createHash("sha256").update(lines, "utf8").digest("hex");
  return `sha256:${hex}`;
}

export async function syncCodeIndex(root: string): Promise<CodeSyncResult> {
  const config = loadCodeIndexConfig(root);
  const { vcsRoot, roots } = discoverSourceRoots(root, config);
  const ignoreGlobs = config.ignore ?? [];
  const files = listSourceFiles(vcsRoot, roots, ignoreGlobs);

  const previous = tryLoadCodeIndexManifest(vcsRoot);
  const grammarBumped =
    previous !== null &&
    JSON.stringify(previous.grammar_versions) !== JSON.stringify(GRAMMAR_VERSIONS);

  const hashes = new Map<string, string>();
  for (const rel of files) {
    hashes.set(rel, contentHash(fs.readFileSync(path.join(vcsRoot, rel), "utf8")));
  }

  const changed = [
    ...files.filter((rel) => previous?.files[rel]?.hash !== hashes.get(rel)),
    ...Object.keys(previous?.files ?? {}).filter((rel) => !hashes.has(rel)),
  ];
  if (previous !== null && !grammarBumped && changed.length === 0) {
    return { status: "fresh", indexed: files.length, changed: [] };
  }

  const symbols: CodeAstIndex["symbols"] = [];
  const references: CodeAstIndex["references"] = [];
  const knownFiles = new Set(files);
  const fileMeta: CodeIndexManifest["files"] = {};
  for (const rel of files) {
    const abs = path.join(vcsRoot, rel);
    const text = fs.readFileSync(abs, "utf8");
    const hash = hashes.get(rel)!;
    const extracted = await extractFile(rel, text, knownFiles);
    symbols.push(...extracted.symbols);
    references.push(...extracted.references);
    fileMeta[rel] = {
      hash,
      language: grammarForFile(rel),
      symbols: extracted.symbols.length,
    };
  }

  const relHashes = [...hashes.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const fingerprint = computeFingerprint(relHashes);
  const corpus = roots.map((r) => (r === "" ? "**" : `${r}/**`)).join(", ");

  const manifest: CodeIndexManifest = {
    schema_version: 1,
    index_fingerprint: fingerprint,
    corpus,
    grammar_versions: { ...GRAMMAR_VERSIONS },
    roots,
    files: fileMeta,
  };
  const ast: CodeAstIndex = {
    schema_version: 1,
    index_fingerprint: fingerprint,
    symbols,
    references,
  };
  saveCodeIndexPair(vcsRoot, manifest, ast);

  return { status: "updated", indexed: files.length, changed: [...changed].sort() };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx tsx --test tests/code-index-io.test.ts`
Run: `npx tsx --test tests/code-index-sync.test.ts`
Expected: PASS for both (IO 5 tests, sync 6 tests).

- [ ] **Step 7: Typecheck**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 8: Run full suite and commit**

Run: `npm test`
Expected: all green.

```bash
git add src/code-index/io.ts src/code-index/sync.ts tests/code-index-io.test.ts tests/code-index-sync.test.ts
git commit -m "feat: byte-deterministic code index IO and hash-driven sync"
```

---

### Task 7: Reader facade

**Files:**
- Create: `src/code-index/reader.ts`
- Test: `tests/code-index-reader.test.ts`

**Interfaces:**
- Consumes: `loadCodeIndexPair`, `loadCodeIndexConfig`, `discoverSourceRoots`, `listSourceFiles`, `contentHash`
- Produces: `export function openCodeIndex(root: string): CodeIndexHandle` — mirrors `openCanonIndex` in `src/index/reader.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/code-index-reader.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { openCodeIndex } from "../src/code-index/reader.js";
import { codeAstIndexPath, codeIndexManifestPath } from "../src/code-index/paths.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-reader-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("openCodeIndex", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/reader.ts", "export class Reader { score(): number { return 1; } }");
    write(repo, "src/main.ts", 'import { Reader } from "./reader";\nexport const r: Reader = new Reader();');
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("exposes symbols and references after sync", async () => {
    await syncCodeIndex(repo);
    const handle = openCodeIndex(repo);
    assert.ok(handle.symbols().some((s) => s.name === "Reader" && s.kind === "class"));
    assert.ok(handle.references().some((r) => r.kind === "import" && r.to === "src/reader.ts"));
  });

  it("liveHashes matches manifest hashes when unchanged", async () => {
    await syncCodeIndex(repo);
    const handle = openCodeIndex(repo);
    const live = handle.liveHashes();
    for (const [rel, meta] of Object.entries(handle.manifest.files)) {
      assert.equal(live[rel], meta.hash);
    }
  });

  it("throws when the pair is missing", () => {
    assert.throws(() => openCodeIndex(repo), /not found/);
  });

  it("throws when the pair is corrupt", async () => {
    await syncCodeIndex(repo);
    fs.writeFileSync(codeAstIndexPath(repo), "{not-json");
    assert.throws(() => openCodeIndex(repo), /invalid/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/code-index-reader.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Write `src/code-index/reader.ts`**

```ts
// src/code-index/reader.ts
import fs from "node:fs";
import path from "node:path";
import { contentHash } from "../index/hash.js";
import { loadCodeIndexConfig } from "./config.js";
import { discoverSourceRoots, listSourceFiles } from "./discovery.js";
import { loadCodeIndexPair } from "./io.js";
import type { CodeIndexHandle } from "./types.js";

export function openCodeIndex(root: string): CodeIndexHandle {
  const { manifest, ast } = loadCodeIndexPair(root);
  return {
    symbols: () => ast.symbols,
    references: () => ast.references,
    manifest,
    liveHashes: () => {
      const config = loadCodeIndexConfig(root);
      const { vcsRoot, roots } = discoverSourceRoots(root, config);
      const files = listSourceFiles(vcsRoot, roots, config.ignore ?? []);
      const out: Record<string, string> = {};
      for (const rel of files) {
        out[rel] = contentHash(fs.readFileSync(path.join(vcsRoot, rel), "utf8"));
      }
      return out;
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/code-index-reader.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck and full suite**

Run: `npm run build && npm test`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add src/code-index/reader.ts tests/code-index-reader.test.ts
git commit -m "feat: openCodeIndex reader facade for the code AST index"
```

---

### Task 8: pid-lock, watch, and CLI command

**Files:**
- Create: `src/code-index/pid-lock.ts`
- Create: `src/code-index/watch.ts`
- Create: `src/commands/code-index-cmd.ts`
- Modify: `src/cli.ts`
- Test: `tests/code-index-pid-lock.test.ts`
- Test: `tests/code-index-cli.test.ts`
- Modify: `tests/cli-commands.test.ts` (add `code-index` to the help command list)

**Interfaces:**
- Consumes: `syncCodeIndex`, `codeIndexWatchPidPath`, `readWatchPid`/`isPidAlive`/`stopWatchPid` pattern from `src/index/pid-lock.ts`
- Produces:
  - `src/code-index/pid-lock.ts`: `readCodeIndexWatchPid(root)`, `acquireCodeIndexWatchPid(root)`, `releaseCodeIndexWatchPid(root)`, `stopCodeIndexWatchPid(root)` — same semantics as `src/index/pid-lock.ts` but with `codeIndexWatchPidPath`.
  - `src/code-index/watch.ts`: `watchCodeIndex(root, intervalMs): Promise<number>` — poll loop; releases pid lock on SIGINT/SIGTERM; logs only `updated`.
  - `src/commands/code-index-cmd.ts`: `codeIndexBuild(rootFlag, opts): Promise<number>` — mirrors `indexCanon` in `src/commands/index-cmd.ts`, printing `code-index <status>: <n> files` (or `... (changed: N)`).
  - `src/cli.ts`: a `code-index` command group with a `build` subcommand (options `--root`, `--watch`, `--stop`, `--interval`).

- [ ] **Step 1: Write the failing pid-lock test**

```ts
// tests/code-index-pid-lock.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  acquireCodeIndexWatchPid,
  readCodeIndexWatchPid,
  releaseCodeIndexWatchPid,
  stopCodeIndexWatchPid,
} from "../src/code-index/pid-lock.js";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";

describe("code-index pid-lock", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-pid-"));
  });
  afterEach(() => {
    try {
      releaseCodeIndexWatchPid(root);
    } catch {
      // ignore
    }
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("acquire writes pid; second acquire throws while alive", () => {
    acquireCodeIndexWatchPid(root);
    assert.equal(readCodeIndexWatchPid(root), process.pid);
    assert.throws(() => acquireCodeIndexWatchPid(root), /already running/);
  });

  it("release leaves a lock owned by another process", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexWatchPidPath(root), "12345\n");
    releaseCodeIndexWatchPid(root);
    assert.equal(fs.readFileSync(codeIndexWatchPidPath(root), "utf8"), "12345\n");
  });

  it("stop removes a stale pid file", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexWatchPidPath(root), "999999\n");
    assert.deepEqual(stopCodeIndexWatchPid(root), { stopped: false });
    assert.equal(fs.existsSync(codeIndexWatchPidPath(root)), false);
  });
});
```

- [ ] **Step 2: Write the failing CLI test**

```ts
// tests/code-index-cli.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repoRoot, "bin", "doc-canon.js");

describe("doc-canon code-index cli", () => {
  let repo: string;
  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-cli-"));
    fs.mkdirSync(path.join(repo, ".git"));
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("code-index build writes artifacts", () => {
    fs.writeFileSync(path.join(repo, "package.json"), "{}");
    fs.mkdirSync(path.join(repo, "src"), { recursive: true });
    fs.writeFileSync(path.join(repo, "src/a.ts"), "export const x = 1;");
    const r = spawnSync("node", [bin, "code-index", "build", "--root", repo], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr || r.stdout);
    assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-index-manifest.json")));
    assert.ok(fs.existsSync(path.join(repo, ".doc-canon", "code-ast-index.json")));
  });

  it("code-index build fails closed without a VCS root", () => {
    // The filesystem root cannot have a .git ancestor, so this always fails.
    const r = spawnSync(
      "node",
      [bin, "code-index", "build", "--root", path.parse(process.cwd()).root],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /VCS root|\.git/);
  });

  it("--watch and --stop are mutually exclusive", () => {
    const r = spawnSync(
      "node",
      [bin, "code-index", "build", "--root", repo, "--watch", "--stop"],
      { cwd: repoRoot, encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
    assert.match(r.stderr + r.stdout, /mutually exclusive/);
  });
});
```

Also append `code-index` to the **first** command list in `tests/cli-commands.test.ts` (the `--help` presence check). Do **not** add it to the second loop (the `--root` check): `code-index` is a command **group** whose `build` subcommand carries `--root`, so `code-index --help` does not print `--root <path>`. The `--root` coverage for the group is provided by `tests/code-index-cli.test.ts` (`code-index build --root`).

```ts
    for (const cmd of [
      "init",
      "upgrade-skills",
      "migrate",
      "validate",
      "check",
      "report",
      "index",
      "search",
      "code-index",
    ]) {
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx tsx --test tests/code-index-pid-lock.test.ts`
Run: `npx tsx --test tests/code-index-cli.test.ts`
Expected: FAIL with module-not-found / command missing.

- [ ] **Step 4: Write `src/code-index/pid-lock.ts`**

Mirror `src/index/pid-lock.ts` exactly, substituting `codeIndexWatchPidPath` for `indexWatchPidPath` and reusing `isPidAlive` from `../index/pid-lock.js`:

```ts
// src/code-index/pid-lock.ts
import fs from "node:fs";
import { docCanonDir } from "../paths.js";
import { isPidAlive } from "../index/pid-lock.js";
import { codeIndexWatchPidPath } from "./paths.js";

export function readCodeIndexWatchPid(root: string): number | null {
  try {
    const pid = Number.parseInt(
      fs.readFileSync(codeIndexWatchPidPath(root), "utf8").trim(),
      10,
    );
    return Number.isSafeInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

export function acquireCodeIndexWatchPid(root: string): void {
  fs.mkdirSync(docCanonDir(root), { recursive: true });
  const pidPath = codeIndexWatchPidPath(root);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = fs.openSync(pidPath, "wx");
      try {
        fs.writeFileSync(fd, `${process.pid}\n`);
      } finally {
        fs.closeSync(fd);
      }
      return;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existingPid = readCodeIndexWatchPid(root);
      if (existingPid !== null && isPidAlive(existingPid)) {
        throw new Error(`watch already running (pid ${existingPid})`);
      }
      if (attempt === 1) {
        throw new Error("could not acquire watch pid lock");
      }
      fs.rmSync(pidPath, { force: true });
    }
  }
}

export function releaseCodeIndexWatchPid(root: string): void {
  if (readCodeIndexWatchPid(root) === process.pid) {
    fs.rmSync(codeIndexWatchPidPath(root), { force: true });
  }
}

export function stopCodeIndexWatchPid(root: string): { stopped: boolean; pid?: number } {
  const pid = readCodeIndexWatchPid(root);
  if (pid !== null && isPidAlive(pid)) {
    process.kill(pid, "SIGTERM");
    return { stopped: true, pid };
  }
  fs.rmSync(codeIndexWatchPidPath(root), { force: true });
  return { stopped: false };
}
```

- [ ] **Step 5: Write `src/code-index/watch.ts`**

Mirror `src/index/watch.ts`, substituting `syncCodeIndex`, `acquireCodeIndexWatchPid`, `releaseCodeIndexWatchPid`, and message `code-index updated`:

```ts
// src/code-index/watch.ts
import { acquireCodeIndexWatchPid, releaseCodeIndexWatchPid } from "./pid-lock.js";
import { syncCodeIndex } from "./sync.js";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function watchCodeIndex(
  root: string,
  intervalMs: number,
): Promise<number> {
  try {
    acquireCodeIndexWatchPid(root);
  } catch (error) {
    console.error(`error: ${errorMessage(error)}`);
    return 1;
  }

  let timer: NodeJS.Timeout | undefined;
  let finished = false;
  let resolveDone!: (code: number) => void;
  const done = new Promise<number>((resolve) => {
    resolveDone = resolve;
  });

  const finish = (code: number): void => {
    if (finished) return;
    finished = true;
    if (timer) clearInterval(timer);
    releaseCodeIndexWatchPid(root);
    process.removeListener("SIGINT", onSigint);
    process.removeListener("SIGTERM", onSigterm);
    resolveDone(code);
  };
  const onSigint = () => finish(0);
  const onSigterm = () => finish(0);
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  try {
    const first = await syncCodeIndex(root);
    if (first.status === "updated") {
      console.log(`code-index updated: ${first.indexed} files`);
    }
  } catch (error) {
    console.error(`error: ${errorMessage(error)}`);
    finish(1);
    return done;
  }

  timer = setInterval(() => {
    void syncCodeIndex(root)
      .then((result) => {
        if (result.status === "updated") {
          console.log(
            `code-index updated: ${result.indexed} files (changed: ${result.changed.length})`,
          );
        }
      })
      .catch((error: unknown) => {
        console.error(`error: ${errorMessage(error)}`);
        if (/VCS root|\.git/.test(errorMessage(error))) finish(1);
      });
  }, intervalMs);

  return done;
}
```

- [ ] **Step 6: Write `src/commands/code-index-cmd.ts`**

Mirror `src/commands/index-cmd.ts`:

```ts
// src/commands/code-index-cmd.ts
import { resolveRoot } from "../paths.js";
import { isPidAlive } from "../index/pid-lock.js";
import {
  readCodeIndexWatchPid,
  stopCodeIndexWatchPid,
} from "../code-index/pid-lock.js";
import { syncCodeIndex } from "../code-index/sync.js";
import { watchCodeIndex } from "../code-index/watch.js";

export type CodeIndexOptions = {
  watch?: boolean;
  stop?: boolean;
  interval?: string;
};

export async function codeIndexBuild(
  rootFlag: string,
  opts: CodeIndexOptions,
): Promise<number> {
  if (opts.watch && opts.stop) {
    console.error("error: --watch and --stop are mutually exclusive");
    return 1;
  }
  if (opts.interval !== undefined && !opts.watch) {
    console.error("error: --interval requires --watch");
    return 1;
  }

  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (opts.stop) {
    const result = stopCodeIndexWatchPid(root);
    console.log(result.stopped ? `stopped pid ${result.pid}` : "not running");
    return 0;
  }
  if (opts.watch) {
    const intervalMs = opts.interval === undefined ? 2000 : Number(opts.interval);
    if (!Number.isFinite(intervalMs) || intervalMs < 200) {
      console.error("error: --interval must be a finite number of at least 200 ms");
      return 1;
    }
    return watchCodeIndex(root, intervalMs);
  }

  const watchPid = readCodeIndexWatchPid(root);
  if (watchPid !== null && isPidAlive(watchPid)) {
    console.error(`watch running (pid ${watchPid}); stop it or rely on watch`);
    return 1;
  }

  try {
    const result = await syncCodeIndex(root);
    console.log(
      `code-index ${result.status}: ${result.indexed} files` +
        (result.changed.length ? ` (changed: ${result.changed.length})` : ""),
    );
    return 0;
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
```

(The watch-pid guard already uses `readCodeIndexWatchPid` — no unused imports remain.)

- [ ] **Step 7: Wire the CLI group in `src/cli.ts`**

Add a `code-index` group with a `build` subcommand (after the `search` command, before `await program.parseAsync()`):

```ts
const codeIndex = program
  .command("code-index")
  .description("Build a deterministic AST index over discovered source roots");

codeIndex
  .command("build")
  .description("Build or refresh the code AST index")
  .option("--root <path>", "target repo root", ".")
  .option("--watch", "poll and refresh index")
  .option("--stop", "stop a running --watch process")
  .option("--interval <ms>", "poll interval for --watch")
  .action(
    async (opts: {
      root: string;
      watch?: boolean;
      stop?: boolean;
      interval?: string;
    }) => {
      const { codeIndexBuild } = await import("./commands/code-index-cmd.js");
      process.exitCode = await codeIndexBuild(opts.root, opts);
    },
  );
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx tsx --test tests/code-index-pid-lock.test.ts`
Run: `npx tsx --test tests/code-index-cli.test.ts`
Run: `npx tsx --test tests/cli-commands.test.ts`
Expected: PASS for all three.

- [ ] **Step 9: Typecheck**

Run: `npm run build`
Expected: exit 0 (remove any unused imports flagged by `tsc`).

- [ ] **Step 10: Run full suite and commit**

Run: `npm test`
Expected: all green.

```bash
git add src/code-index/pid-lock.ts src/code-index/watch.ts src/commands/code-index-cmd.ts src/cli.ts tests/code-index-pid-lock.test.ts tests/code-index-cli.test.ts tests/cli-commands.test.ts
git commit -m "feat: code-index watch pid-lock and CLI command"
```

---

### Task 9: Integration — full repo dogfood and release-surface checks

**Files:**
- Test: `tests/code-index-dogfood.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–8
- Produces: no new modules — an end-to-end dogfood test that runs `syncCodeIndex` against a fixture mirroring this repo's own layout (monorepo-style roots, code outside `src/`, generated/ignored dirs).

- [ ] **Step 1: Write the failing integration test**

```ts
// tests/code-index-dogfood.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { loadCodeIndexPair } from "../src/code-index/io.js";
import { openCodeIndex } from "../src/code-index/reader.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-dogfood-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

describe("code-index integration (dogfood)", () => {
  let repo: string;
  beforeEach(() => {
    repo = makeRepo();
    // root package.json (monorepo root)
    write(repo, "package.json", "{}");
    // code outside src/
    write(repo, "lib/util.ts", "export function util(): number { return 1; }");
    // nested workspace
    write(repo, "packages/core/package.json", "{}");
    write(repo, "packages/core/index.ts", 'import { util } from "../../lib/util";\nexport const core = util();');
    // ignored generated dir
    write(repo, "dist/bundle.js", "console.log(1);");
    // .js file in an ignored node_modules
    write(repo, "node_modules/x/index.js", "module.exports = 1;");
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("indexes both roots, ignores generated/vendored, resolves cross-root import", async () => {
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    assert.equal(r.indexed, 2);
    const pair = loadCodeIndexPair(repo);
    assert.deepEqual(pair.manifest.roots, ["", "packages/core"]);
    assert.equal(pair.manifest.files["dist/bundle.js"], undefined);
    assert.equal(pair.manifest.files["node_modules/x/index.js"], undefined);
    const handle = openCodeIndex(repo);
    const importRefs = handle
      .references()
      .filter((ref) => ref.kind === "import" && ref.from === "packages/core/index.ts");
    assert.ok(
      importRefs.some((ref) => ref.to === "lib/util.ts" && ref.name === "util"),
    );
  });

  it("grammar_versions bump forces rebuild with unchanged files", async () => {
    await syncCodeIndex(repo);
    // Simulate a grammar upgrade by patching the written manifest's grammar_versions.
    const manifestPath = path.join(repo, ".doc-canon", "code-index-manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.grammar_versions = { ...manifest.grammar_versions, javascript: "9.9.9" };
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const r = await syncCodeIndex(repo);
    assert.equal(r.status, "updated");
    const after = loadCodeIndexPair(repo);
    assert.equal(after.manifest.grammar_versions.javascript, "0.25.0");
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx tsx --test tests/code-index-dogfood.test.ts`
Expected: PASS (2 tests). If `r.indexed` is not 2, verify `dist` and `node_modules` are excluded by `isIgnored`/`DEFAULT_IGNORE_GLOBS` and that both `lib/util.ts` and `packages/core/index.ts` are discovered.

- [ ] **Step 3: Run the whole suite**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Typecheck and build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 5: Manual smoke — dogfood on this repo**

Run: `node bin/doc-canon.js code-index build --root .`
Expected: exit 0; prints `code-index updated: <n> files`; `.doc-canon/code-index-manifest.json` and `.doc-canon/code-ast-index.json` exist. Then run once more and expect `code-index fresh: <n> files`.

- [ ] **Step 6: Confirm artifacts stay out of git**

Run: `git status --short`
Expected: `.doc-canon/` untracked/ignored (present in `.gitignore`).

- [ ] **Step 7: Commit**

```bash
git add tests/code-index-dogfood.test.ts
git commit -m "test: end-to-end code-index integration (roots, ignore, cross-root import, grammar bump)"
```

---

## Self-Review

**Spec coverage:**
- Command surface (`code-index build` group, `--watch`/`--stop`/`--interval`/`--root`) → Tasks 1, 8.
- Byte-deterministic dual artifact + `index_fingerprint` → Tasks 1, 6, 7.
- Config precedence and independence from contract → Tasks 2, 3.
- Discovery: VCS root, manifests, nested/sibling, extension fallback, ignore set → Task 3.
- Extraction: grammar selection, symbol kinds, signature/scope → Task 4.
- References v1: anchors/imports/bindings → Task 5.
- Hash-driven freshness + grammar-stamp rebuild → Tasks 6, 9.
- Watch pid-lock + `--stop` + signal cleanup → Task 8.
- Reader facade + package export `doc-canon/code-index-reader` → Tasks 1, 7.
- Tests: extractor correctness, discovery fixtures, determinism, golden snapshots → Tasks 4–6, 9.

**Placeholder scan:** no TBD/TODO; every step has concrete code. The ignore matching in Task 3 delegates to `src/agnostic/ignore.ts`'s `isIgnored` (no duplicate matching logic). Task 6's sync computes `changed` only after hashing all files (correct freshness), uses `grammarForFile` (no duplicate helper), and uses `computeFingerprint` for the deterministic pair-consistency key.

**Type consistency:** `extractFile(rel, text, knownFiles)` is defined once (Task 4) and consumed identically by `syncCodeIndex` (Task 6) and all extractor/reference tests. `CodeIndexManifest`/`CodeAstIndex`/`CodeSyncResult`/`CodeIndexHandle` are fixed in Task 1 and used verbatim thereafter. `computeFingerprint` returns `sha256:<hex>` matching `contentHash`'s format. `codeIndexWatchPidPath` is used by pid-lock (Task 8) and `codeIndexBuild` consistently.
