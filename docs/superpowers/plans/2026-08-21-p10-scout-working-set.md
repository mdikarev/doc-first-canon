# P10 — CLI scout Working-Set Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `doc-canon scout "<topic>"` — a command that turns a topic query into a generated working-set manifest (docs paths ranked by search, each annotated with contract role and snippet stubs, plus a deterministic `sufficient` / `need_more` verdict hint and an optional code pack) in one call.

**Architecture:** A new `src/scout/` module composes the shipped retrieval layer — `searchCanon` (docs BM25 pack), `searchCodeIndex` (code AST pack), `parseContractMarkdown` (role lookup), `refreshStaleIndex` (self-heal), and `appendProbe` (probe log) — with no changes to existing commands' contracts. A thin `src/commands/scout.ts` CLI wrapper handles flag parsing and human/JSON rendering; `src/cli.ts` registers the command next to `search`.

**Tech Stack:** TypeScript (strict, NodeNext ESM — imports carry `.js`), commander, Node ≥22.16 (existing floor; `node:sqlite` used only indirectly via code-index).

**Spec:** `docs/superpowers/specs/2026-08-21-p10-scout-working-set-design.md` (the plan argues from the spec; executors read both).

## Global Constraints

- Repo is the `doc-canon` package (v0.9.0, `"type": "module"`, Node ≥22.16, strict TS). Do not change `package.json` engines or dependencies.
- No new dependencies; reuse `commander`, `fs`, `path` only.
- All imports use NodeNext style: `import ... from "../search/search.js"` (the `.js` suffix is required and already used repo-wide).
- JSON shapes use snake_case field names (matches `PackResult` conventions).
- Commands accept `--root <path>` (default cwd) and fail closed on unknown flags (commander default).
- Canon files (`docs/canon/**`) must NOT be edited directly — canon absorb (Task 5) goes through the `canon-write` skill; `docs/canon/future_plans/**` status changes go through the `canon-future-plan` skill.
- `docs/canon/**` prose lines must stay ≤500 chars (contract `policies.max_line_length`; table rows and fenced blocks exempt).
- Run `npm test` (pretest builds), `npm run build`, and `node bin/doc-canon.js validate --root .` before any success claim.

---

### Task 1: Scout types + manifest core (docs pack, roles, verdict, warnings, probe log)

**Files:**
- Create: `src/scout/types.ts`
- Create: `src/scout/build.ts`
- Create: `tests/scout.test.ts`

**Interfaces:**
- Consumes: `searchCanon(root, query, {maxHits, snippetLines})` → `PackResult` `{query, index_id, freshness, warnings, hits: PackHit[]}` where `PackHit = {path, score, snippets}` (from `src/search/search.js`, which re-exports `SearchError`, types); `refreshStaleIndex(root, "doc"|"code", freshness)` → `Promise<boolean>` (from `src/commands/auto-reindex.js`); `appendProbe(root, ProbeEntry)` (from `src/probe-log.js`); `parseContractMarkdown(markdown)` → `Contract` (from `src/contract/parse.js`); `contractPath(root)` (from `src/paths.js`).
- Produces: `ScoutManifest` type and `buildScoutManifest(root: string, query: string, options?: ScoutOptions): Promise<ScoutManifest>`; exported constants `MIN_DOC_HITS = 2`, `TOP_SCORE_FLOOR = 1.0`; `ScoutOptions = {maxHits?, snippetLines?, code?}` (code `false` = skip code probe). Task 2 consumes `buildScoutManifest` and adds the `code` field; Task 3 consumes it from the CLI.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scout.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCanonIndex } from "../src/index/sync.js";
import { buildScoutManifest } from "../src/scout/build.js";
import { SearchError } from "../src/search/search.js";
import { readProbeLog } from "../src/probe-log.js";

const CONTRACT = `# Canon Contract

## Machine contract

\`\`\`yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - { id: index, path: INDEX.md, role: index, required: true, template: INDEX }
  - { id: cli, path: CLI.md, role: section, required: true, template: MODULE }
templates:
  - { id: INDEX, path: templates/INDEX.md }
  - { id: MODULE, path: templates/MODULE.md }
policies:
  max_lines: 400
  ignore: []
\`\`\`
`;

describe("buildScoutManifest", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-scout-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(path.join(root, "docs", "canon", "CANON_CONTRACT.md"), CONTRACT);
    fs.writeFileSync(
      path.join(root, "docs", "canon", "CLI.md"),
      "# CLI\n\nscout retrieval working set\n",
    );
    fs.writeFileSync(path.join(root, "docs", "canon", "INDEX.md"), "# Index\n\nretrieval\n");
    fs.mkdirSync(path.join(root, "docs", "canon", "future_plans"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "future_plans", "p1-x.md"),
      "# P1\n\n## Intent\n\nscout retrieval\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("throws empty_query on whitespace", async () => {
    await assert.rejects(() => buildScoutManifest(root, "  "), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal((e as SearchError).code, "empty_query");
      return true;
    });
  });

  it("throws index_unavailable when the docs index is missing", async () => {
    await assert.rejects(() => buildScoutManifest(root, "retrieval"), (e: unknown) => {
      assert.ok(e instanceof SearchError);
      assert.equal((e as SearchError).code, "index_unavailable");
      return true;
    });
  });

  it("annotates roles and returns sufficient after sync", async () => {
    await syncCanonIndex(root);
    const manifest = await buildScoutManifest(root, "retrieval");
    assert.equal(manifest.verdict, "sufficient");
    assert.match(manifest.reason, /hits; top score/);
    const cli = manifest.docs.find((d) => d.path === "docs/canon/CLI.md");
    assert.ok(cli);
    assert.equal(cli!.role, "section");
    const future = manifest.docs.find((d) => d.path === "docs/canon/future_plans/p1-x.md");
    assert.ok(future);
    assert.equal(future!.role, "future-plan");
    assert.equal(manifest.code, undefined);
    assert.ok(Array.isArray(manifest.docs[0]!.snippets));
  });

  it("verdict need_more on a single hit", async () => {
    fs.writeFileSync(path.join(root, "docs", "canon", "INDEX.md"), "# Index\n\nuniqueterm\n");
    await syncCanonIndex(root);
    const manifest = await buildScoutManifest(root, "uniqueterm");
    assert.equal(manifest.verdict, "need_more");
    assert.match(manifest.reason, /1 hit; top score .* < 1.0/);
  });

  it("verdict need_more on zero hits", async () => {
    await syncCanonIndex(root);
    const manifest = await buildScoutManifest(root, "zzznomatchzzz");
    assert.equal(manifest.verdict, "need_more");
    assert.equal(manifest.reason, "0 hits; no top score");
  });

  it("records a doc probe in the probe log", async () => {
    await syncCanonIndex(root);
    await buildScoutManifest(root, "retrieval");
    const entries = readProbeLog(root);
    assert.ok(entries.some((e) => e.kind === "doc" && e.query === "retrieval"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scout.test.ts`
Expected: FAIL — `buildScoutManifest` cannot be imported (module not found / build error).

- [ ] **Step 3: Create `src/scout/types.ts`**

```ts
// src/scout/types.ts
import type { PackSnippet } from "../search/types.js";

export type ScoutVerdict = "sufficient" | "need_more";

export type ScoutDocHit = {
  path: string;
  role: string;
  score: number;
  snippets: PackSnippet[];
};

export type ScoutCodeHit = {
  file: string;
  line: number;
  kind: string;
  name: string;
};

export type ScoutManifest = {
  query: string;
  verdict: ScoutVerdict;
  reason: string;
  docs: ScoutDocHit[];
  code?: ScoutCodeHit[];
  warnings: string[];
};

export type ScoutOptions = {
  maxHits?: number;
  snippetLines?: number;
  /** false = skip the code-index probe (--no-code). */
  code?: boolean;
};
```

- [ ] **Step 4: Create `src/scout/build.ts` (docs pack, roles, verdict, probe log)**

```ts
// src/scout/build.ts
import fs from "node:fs";
import { parseContractMarkdown } from "../contract/parse.js";
import type { Contract } from "../contract/types.js";
import { appendProbe } from "../probe-log.js";
import { contractPath } from "../paths.js";
import { SearchError, searchCanon } from "../search/search.js";
import { refreshStaleIndex } from "../commands/auto-reindex.js";
import type { ScoutDocHit, ScoutManifest, ScoutOptions } from "./types.js";

export const MIN_DOC_HITS = 2;
export const TOP_SCORE_FLOOR = 1.0;
const TOP_SCORE_FLOOR_TEXT = "1.0";

function formatScore(score: number): string {
  return Number(score.toFixed(4)).toString();
}

function loadContract(root: string): Contract | null {
  try {
    return parseContractMarkdown(fs.readFileSync(contractPath(root), "utf8"));
  } catch {
    return null; // role annotation degrades gracefully; retrieval must not fail on contract issues
  }
}

function roleForPath(contract: Contract | null, relPath: string): string {
  const norm = relPath.replaceAll("\\", "/");
  if (contract) {
    for (const section of contract.sections) {
      const key = `docs/canon/${section.path.replaceAll("\\", "/")}`;
      if (norm === key) return section.role;
    }
  }
  return norm.startsWith("docs/canon/future_plans/") ? "future-plan" : "other";
}

export async function buildScoutManifest(
  root: string,
  query: string,
  options?: ScoutOptions,
): Promise<ScoutManifest> {
  const trimmed = query.trim();
  if (!trimmed) throw new SearchError("empty_query", "query must be non-empty");

  const maxHits = options?.maxHits ?? 10;
  const snippetLines = options?.snippetLines ?? 4;
  const contract = loadContract(root);
  const warnings: string[] = [];

  const runDoc = () => searchCanon(root, trimmed, { maxHits, snippetLines });
  let docPack = runDoc();
  const docReindexed = await refreshStaleIndex(root, "doc", docPack.freshness);
  if (docReindexed) {
    docPack = runDoc();
    if (!docPack.warnings.includes("auto_reindexed")) {
      docPack.warnings = [...docPack.warnings, "auto_reindexed"];
    }
  }
  appendProbe(root, {
    ts: new Date().toISOString(),
    kind: "doc",
    query: trimmed,
    hits: docPack.hits.length,
    freshness: docPack.freshness,
    reindexed: docReindexed,
  });
  warnings.push(...docPack.warnings);

  const docs: ScoutDocHit[] = docPack.hits.map((hit) => ({
    path: hit.path,
    role: roleForPath(contract, hit.path),
    score: hit.score,
    snippets: hit.snippets,
  }));

  const topScore = docs.length > 0 ? docs[0]!.score : null;
  const verdict =
    docs.length >= MIN_DOC_HITS && topScore !== null && topScore >= TOP_SCORE_FLOOR
      ? "sufficient"
      : "need_more";
  const reason =
    topScore === null
      ? "0 hits; no top score"
      : `${docs.length} ${docs.length === 1 ? "hit" : "hits"}; top score ${formatScore(topScore)} ${verdict === "sufficient" ? ">=" : "<"} ${TOP_SCORE_FLOOR_TEXT}`;

  return { query: trimmed, verdict, reason, docs, warnings };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/scout.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/scout tests/scout.test.ts
git commit -m "feat(scout): manifest core — docs pack, contract roles, verdict hint (P10)"
```

---

### Task 2: Code-index probe in buildScoutManifest

**Files:**
- Modify: `src/scout/build.ts`
- Modify: `tests/scout.test.ts`

**Interfaces:**
- Consumes: `searchCodeIndex(root, query, {maxHits, snippetLines})` → `CodePack` `{query, mode, freshness, warnings, hits: CodeSearchHit[]}` where `CodeSearchHit = {file, line, endLine, kind, name, signature, snippets}` (from `src/code-search/search.js`, re-exports `CodeSearchError`); `findVcsRoot(root)` (from `src/code-index/discovery.js`); `syncCodeIndex(root)` (from `src/code-index/sync.js`) for the test setup only.
- Produces: `ScoutManifest.code?: ScoutCodeHit[]` — populated when the code probe ran, omitted otherwise. `ScoutCodeHit = {file, line, kind, name}`.

- [ ] **Step 1: Write the failing test (append to `tests/scout.test.ts`)**

```ts
  it("omits code when no code index exists (docs-only, no error)", async () => {
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    await syncCanonIndex(root);
    const manifest = await buildScoutManifest(root, "retrieval");
    assert.equal(manifest.code, undefined);
  });

  it("includes code hits when a code index exists", async () => {
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/reader.ts"), "export class Reader {}\n");
    await syncCanonIndex(root);
    await syncCodeIndex(root);
    const manifest = await buildScoutManifest(root, "Reader");
    assert.ok(manifest.code);
    assert.ok(manifest.code!.length >= 1);
    assert.equal(manifest.code![0]!.name, "Reader");
  });

  it("skips code probe with code: false", async () => {
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/reader.ts"), "export class Reader {}\n");
    await syncCanonIndex(root);
    await syncCodeIndex(root);
    const manifest = await buildScoutManifest(root, "Reader", { code: false });
    assert.equal(manifest.code, undefined);
  });

  it("records doc and code probes in the probe log", async () => {
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src/reader.ts"), "export class Reader {}\n");
    await syncCanonIndex(root);
    await syncCodeIndex(root);
    await buildScoutManifest(root, "Reader");
    const entries = readProbeLog(root);
    assert.ok(entries.some((e) => e.kind === "doc" && e.query === "Reader"));
    assert.ok(
      entries.some((e) => e.kind === "code" && e.query === "Reader" && e.mode === "symbols"),
    );
  });
```

Add the import at the top of the test file: `import { syncCodeIndex } from "../src/code-index/sync.js";`

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scout.test.ts`
Expected: FAIL — `manifest.code` is `undefined` (code probe not implemented) or `syncCodeIndex` build error.

- [ ] **Step 3: Extend `src/scout/build.ts` with the code probe**

Add imports:

```ts
import { CodeSearchError, searchCodeIndex, type CodeSearchHit } from "../code-search/search.js";
import { findVcsRoot } from "../code-index/discovery.js";
import type { ScoutCodeHit } from "./types.js";
```

Insert before the final `return` in `buildScoutManifest`:

```ts
  let code: ScoutCodeHit[] | undefined;
  if (options?.code !== false) {
    try {
      const runCode = () => searchCodeIndex(root, trimmed, { maxHits, snippetLines });
      let codePack = runCode();
      const vcsRoot = findVcsRoot(root);
      const codeReindexed = await refreshStaleIndex(vcsRoot, "code", codePack.freshness);
      if (codeReindexed) {
        codePack = runCode();
        if (!codePack.warnings.includes("auto_reindexed")) {
          codePack.warnings = [...codePack.warnings, "auto_reindexed"];
        }
      }
      appendProbe(root, {
        ts: new Date().toISOString(),
        kind: "code",
        query: trimmed,
        mode: "symbols",
        hits: codePack.hits.length,
        freshness: codePack.freshness,
        reindexed: codeReindexed,
      });
      for (const w of codePack.warnings) {
        if (!warnings.includes(w)) warnings.push(w);
      }
      code = (codePack.hits as CodeSearchHit[]).map((hit) => ({
        file: hit.file,
        line: hit.line,
        kind: hit.kind,
        name: hit.name,
      }));
    } catch (error) {
      // Best-effort: missing/unbuildable code index → docs-only, never an error.
      if (error instanceof CodeSearchError && error.code === "empty_query") throw error;
    }
  }

  return { query: trimmed, verdict, reason, docs, code, warnings };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/scout.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/scout tests/scout.test.ts
git commit -m "feat(scout): automatic code-index probe (P10)"
```

---

### Task 3: CLI command `scout`

**Files:**
- Create: `src/commands/scout.ts`
- Modify: `src/cli.ts` (register the command after `search`)
- Create: `tests/scout-cli.test.ts`

**Interfaces:**
- Consumes: `buildScoutManifest(root, query, {maxHits, snippetLines, code})` from Task 1/2; `resolveRoot(cwd, rootFlag)` from `src/paths.js`; `SearchError` from `src/search/search.js`.
- Produces: `scoutCanonCli(rootFlag: string, query: string | undefined, opts: ScoutCliOptions): Promise<number>` with `ScoutCliOptions = {json?, maxHits?, snippetLines?, noCode?}`. Exit 0 on manifest (incl. `need_more` and docs-only); exit 1 on empty query, invalid numeric flags, unbuildable doc index after self-heal.

- [ ] **Step 1: Write the failing test**

```ts
// tests/scout-cli.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

describe("doc-canon scout cli", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "doc-canon-scoutcli-"));
    fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "docs", "canon", "a.md"),
      "# A\n\nretrieval working set\n",
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("lists scout in --help", () => {
    const r = spawnSync("node", [bin, "--help"], { encoding: "utf8" });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /\bscout\b/);
  });

  it("fails closed without an index", () => {
    const r = spawnSync("node", [bin, "scout", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /doc-canon index/i);
  });

  it("rejects empty query", () => {
    const r = spawnSync("node", [bin, "scout", "   ", "--root", root], {
      encoding: "utf8",
    });
    assert.notEqual(r.status, 0);
  });

  it("returns a json manifest after index (docs-only, role other)", () => {
    assert.equal(
      spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status,
      0,
    );
    const r = spawnSync("node", [bin, "scout", "retrieval", "--root", root, "--json"], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    const manifest = JSON.parse(r.stdout);
    assert.equal(manifest.query, "retrieval");
    assert.equal(manifest.verdict, "need_more"); // single doc → 1 hit
    assert.ok(Array.isArray(manifest.docs));
    assert.equal(manifest.docs[0]!.path, "docs/canon/a.md");
    assert.equal(manifest.docs[0]!.role, "other"); // no CANON_CONTRACT.md in fixture
  });

  it("prints a human verdict line", () => {
    assert.equal(
      spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status,
      0,
    );
    const r = spawnSync("node", [bin, "scout", "retrieval", "--root", root], {
      encoding: "utf8",
    });
    assert.equal(r.status, 0, r.stderr + r.stdout);
    assert.match(r.stdout, /verdict: need_more/);
    assert.match(r.stdout, /docs\/canon\/a\.md/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/scout-cli.test.ts`
Expected: FAIL — `scout` not in help / command unknown (exit 1 with `error: unknown command`).

- [ ] **Step 3: Create `src/commands/scout.ts`**

```ts
// src/commands/scout.ts
import { resolveRoot } from "../paths.js";
import { SearchError } from "../search/search.js";
import { buildScoutManifest } from "../scout/build.js";

export type ScoutCliOptions = {
  json?: boolean;
  maxHits?: string;
  snippetLines?: string;
  noCode?: boolean;
};

export async function scoutCanonCli(
  rootFlag: string,
  query: string | undefined,
  opts: ScoutCliOptions,
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  if (query === undefined || query.trim() === "") {
    console.error("error: query required");
    return 1;
  }

  const maxHits = Number(opts.maxHits ?? "10");
  const snippetLines = Number(opts.snippetLines ?? "4");
  if (!Number.isFinite(maxHits) || maxHits < 1) {
    console.error("error: --max-hits must be a positive number");
    return 1;
  }
  if (!Number.isFinite(snippetLines) || snippetLines < 1) {
    console.error("error: --snippet-lines must be a positive number");
    return 1;
  }

  try {
    const manifest = await buildScoutManifest(root, query.trim(), {
      maxHits,
      snippetLines,
      code: opts.noCode ? false : undefined,
    });

    if (opts.json) {
      console.log(JSON.stringify(manifest));
      return 0;
    }

    for (const warning of manifest.warnings) {
      console.error(`warning: ${warning}`);
    }
    console.log(`verdict: ${manifest.verdict} (${manifest.reason})`);
    for (const hit of manifest.docs) {
      console.log(`${hit.path}  score=${hit.score}  role=${hit.role}`);
      for (const snip of hit.snippets) {
        console.log(`  L${snip.start_line}:`);
        for (const line of snip.text.split("\n")) {
          console.log(`    ${line}`);
        }
      }
    }
    if (manifest.code) {
      for (const hit of manifest.code) {
        console.log(`code: ${hit.file}  L${hit.line}  ${hit.kind}  ${hit.name}`);
      }
    }
    return 0;
  } catch (error) {
    if (error instanceof SearchError) {
      console.error(`error: ${error.message}`);
      return 1;
    }
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
```

- [ ] **Step 4: Register the command in `src/cli.ts`** (insert after the `search` command block, before `discipline`)

```ts
program
  .command("scout")
  .description("Emit a generated working-set manifest (docs + optional code) for a topic")
  .argument("<query>", "topic query")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit ScoutManifest JSON on stdout")
  .option("--max-hits <n>", "max ranked documents", "10")
  .option("--snippet-lines <n>", "lines per snippet window", "4")
  .option("--no-code", "skip the code-index probe")
  .action(
    async (
      query: string,
      opts: {
        root: string;
        json?: boolean;
        maxHits?: string;
        snippetLines?: string;
        noCode?: boolean;
      },
    ) => {
      const { scoutCanonCli } = await import("./commands/scout.js");
      process.exitCode = await scoutCanonCli(opts.root, query, opts);
    },
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/scout-cli.test.ts` and `npm test -- tests/cli-commands.test.ts`
Expected: PASS (5 new + existing CLI command tests still green).

- [ ] **Step 6: Commit**

```bash
git add src/commands/scout.ts src/cli.ts tests/scout-cli.test.ts
git commit -m "feat(cli): doc-canon scout command (P10)"
```

---

### Task 4: Version bump, CHANGELOG, embedded skill Scout step, stamp propagation

**Files:**
- Modify: `src/version.ts` (`PACKAGE_VERSION` 0.9.0 → 0.10.0; `SKILLS_STAMP` 0.16.0 → 0.17.0)
- Modify: `package.json` (`"version": "0.10.0"`)
- Modify: `CHANGELOG.md` (new `## 0.10.0` section)
- Modify: `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, `embedded/skills/canon-bootstrap/SKILL.md` (Scout step 1 + fail-closed step 2)
- Run: `node bin/doc-canon.js upgrade-skills --root . --yes` (propagates `SKILLS_STAMP` into this repo's `docs/canon/CANON_CONTRACT.md` and the `.dsh/skills/` tree) — after `npm run build`

**Interfaces:** Consumes nothing new; produces the version/stamp bump and managed-skill Scout step update that Task 5's canon absorb references.

- [ ] **Step 1: Bump version + stamp**

In `src/version.ts`:
```ts
export const PACKAGE_VERSION = "0.10.0";
```
```ts
export const SKILLS_STAMP = "0.17.0";
```

In `package.json`: `"version": "0.10.0"`.

- [ ] **Step 2: Update CHANGELOG.md** (insert after `# Changelog`)

```markdown
## 0.10.0

- **feat:** new `doc-canon scout "<topic>"` command — emits a generated working-set manifest (docs hits ranked by search, each annotated with its contract role and snippet stubs, plus a deterministic `sufficient` / `need_more` verdict hint and an optional code pack) in one call, replacing the hand-built Scout step in the managed skills; `--json`, `--max-hits`, `--snippet-lines`, `--no-code`; self-heals stale indexes like `search`, records doc/code probes in `.doc-canon/probe-log.jsonl`, code probe runs automatically when a code index exists (docs-only otherwise); `SKILLS_STAMP` 0.17.0 — managed skills' Scout step now calls `doc-canon scout`
```

- [ ] **Step 3: Update the embedded skills' Scout step** — in each of `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, `embedded/skills/canon-bootstrap/SKILL.md`, replace step 1 of the "Scout → Expand" section:

Old:
```markdown
1. **Mandatory probe:** run `doc-canon search "<topic>"` (and `doc-canon code-index search` when covered source is in scope) and build the working-set manifest from pack paths and brief snippet stubs. Do not dump all canon markdown.
```

New:
```markdown
1. **Mandatory probe:** run `doc-canon scout "<topic>"` and use the returned working-set manifest (ranked paths with contract roles, snippet stubs, verdict hint); scout seeds the code pack automatically when a code index exists, else it is docs-only. The agent keeps the semantic Expand decision — `need_more` triggers Expand; `sufficient` still allows Expand on doubt. Do not dump all canon markdown.
```

And replace step 2:

Old:
```markdown
2. **If search fails closed** (missing/corrupt index): run `doc-canon index` (and `code-index build` when covered source exists), then re-run the search. Only if building fails, continue with INDEX-first progressive disclosure (`docs/canon/INDEX.md`; select only relevant rows) and record `doc_miss: <query> -> docs:<path>` for every file read outside the pack. Search failure alone never licenses INDEX-first fallback.
```

New:
```markdown
2. **If scout fails closed** (missing/corrupt index): run `doc-canon index` (and `code-index build` when covered source exists), then re-run scout. Only if building fails, continue with INDEX-first progressive disclosure (`docs/canon/INDEX.md`; select only relevant rows) and record `doc_miss: <query> -> docs:<path>` for every file read outside the pack. Scout/search failure alone never licenses INDEX-first fallback.
```

- [ ] **Step 4: Build and propagate the stamp**

Run: `npm run build` then `node bin/doc-canon.js upgrade-skills --root . --yes`
Expected: exit 0; `docs/canon/CANON_CONTRACT.md` `skills_stamp` now `0.17.0`; `.dsh/skills/**` refreshed.

- [ ] **Step 5: Run the full suite + validate**

Run: `npm test` and `node bin/doc-canon.js validate --root .`
Expected: all tests pass; validate exit 0, zero `error`-severity issues.

- [ ] **Step 6: Commit**

```bash
git add src/version.ts package.json CHANGELOG.md embedded/skills docs/canon/CANON_CONTRACT.md .dsh/skills
git commit -m "chore: prepare doc-canon 0.10.0 (P10 scout); skills_stamp 0.17.0"
```

---

### Task 5: Canon absorb (CLI.md, SKILLS.md, ARCHITECTURE.md, GLOSSARY.md) + future_plans absorbed status

**Files:** (edited through the `canon-write` skill — invoke it and apply the deltas below; do not edit `docs/canon/**` directly)
- Modify: `docs/canon/CLI.md`
- Modify: `docs/canon/SKILLS.md`
- Modify: `docs/canon/ARCHITECTURE.md`
- Modify: `docs/canon/GLOSSARY.md`
- Modify: `docs/canon/future_plans/p10-cli-scout-working-set.md` + `docs/canon/future_plans/INDEX.md` (through the `canon-future-plan` skill)

**Interfaces:** Consumes the shipped behavior from Tasks 1–3; produces the living-canon absorb.

- [ ] **Step 1: canon-write — `docs/canon/CLI.md`**

Invoke the `canon-write` skill for CLI.md. Apply these deltas:
- **Scope "Covers:"** — add `scout` to the command list (after `search`).
- **Current state** — add `scout` to the commands list and note it emits the working-set manifest (docs + optional code).
- **Responsibilities** — add one bullet: `scout` composes the docs pack and (when a code index exists) the code pack into a working-set manifest with contract-role annotations and a deterministic verdict hint; self-heals stale indexes like `search`; records doc/code probes.
- **Interfaces table** — add a row:
  `| `scout <query>` | Emit a working-set manifest (docs hits with contract roles + snippet stubs + verdict hint; code hits when a code index exists); human output on stdout; `--json`; `--max-hits <N>` (default 10); `--snippet-lines <N>` (default 4); `--no-code`; `--root <path>` |`
- **Command flags table** — add row: `| `scout <query>` | `--root <path>` (default `.`), `--json`, `--max-hits <n>` (default `10`), `--snippet-lines <n>` (default `4`), `--no-code` |`
- After the `search` self-heal paragraph, add one paragraph: `scout` fails closed on a missing/corrupt docs index (hint `doc-canon index`); stale indexes self-heal at the CLI layer exactly like `search` (`auto_reindexed` / `index_stale` warnings); `need_more` is a valid result (exit 0) — the agent decides to Expand; the code probe is best-effort (missing code index → docs-only, no error); every probe is recorded in the probe log.

- [ ] **Step 2: canon-write — `docs/canon/SKILLS.md`**

Invoke `canon-write` for SKILLS.md. In "Scout retrieval protocol" step 1, replace:

Old:
```markdown
1. Scout always runs `doc-canon search "<topic>"` first (and `doc-canon code-index search` when covered source is in scope) and builds the working-set stub from the returned pack paths and snippets.
```

New:
```markdown
1. Scout runs `doc-canon scout "<topic>"` to get the working-set manifest (ranked paths with contract roles, snippet stubs, verdict hint) in one call; scout seeds the code pack automatically when a code index exists (docs-only otherwise). The agent keeps the semantic Expand decision — `need_more` triggers Expand; `sufficient` still allows Expand on doubt.
```

Adjust step 2 wording from "If search fails closed" to "If scout fails closed" (same INDEX-first fallback and `doc_miss` note rules).

- [ ] **Step 3: canon-write — `docs/canon/ARCHITECTURE.md`**

Invoke `canon-write` for ARCHITECTURE.md. In the retrieval bullet ("Search-first is mandatory … `doc-canon search` / `code-index search` self-heal …"), extend with: ```doc-canon scout` composes both packs into a working-set manifest (contract-role annotations + verdict hint) for the Scout step.``` Also add `scout` to the CLI-commands bullet in Building blocks if that bullet lists commands (`src/commands/*`).

- [ ] **Step 4: canon-write — `docs/canon/GLOSSARY.md`**

Invoke `canon-write` for GLOSSARY.md. Update the **Working set** term: "Discover via `doc-canon search` first (pack paths and snippet stubs)" → "Discover via `doc-canon scout "<topic>"` (generated manifest: paths, roles, snippet stubs, verdict); fall back to `doc-canon search` / INDEX when scout fails closed". Update the **Scout** term: add that `doc-canon scout` generates the manifest mechanically; the Expand decision stays with the agent.

- [ ] **Step 5: canon-future-plan — absorb P10**

Invoke the `canon-future-plan` skill: set `docs/canon/future_plans/p10-cli-scout-working-set.md` status `refining → absorbed`, update the `future_plans/INDEX.md` row to `absorbed`, and (per the skill) confirm living canon absorb (Steps 1–4) is done first.

- [ ] **Step 6: Full verification**

Run: `npm test`, `npm run build`, `node bin/doc-canon.js validate --root .`
Expected: all green; validate exit 0 with zero `error`-severity issues.

- [ ] **Step 7: Commit**

```bash
git add docs/canon
git commit -m "docs(canon): absorb P10 scout working-set manifest"
```

---

## Self-Review Notes

- **Spec coverage:** every Goals bullet maps to a task — command shape (Task 3), manifest JSON shape (Task 1 types + Task 3 `--json`), role annotation (Task 1), verdict heuristic (Task 1), fail-closed/self-heal (Task 1/3), code probe + `--no-code` (Task 2/3), probe log (Task 1/2), `need_more` exit 0 (Task 3), absorbs (Tasks 4–5). Non-goals untouched (no search-engine changes, no config surface, no `doc_miss`/CLI emission).
- **Placeholder scan:** no TBD/TODO; every step carries real code or exact deltas.
- **Type consistency:** `ScoutManifest`, `ScoutDocHit`, `ScoutCodeHit`, `ScoutOptions`, `ScoutCliOptions`, `buildScoutManifest(root, query, options?)`, `scoutCanonCli(rootFlag, query, opts)` are defined once and referenced consistently; `code?` optional field named the same in types and build; `noCode` CLI flag maps to `code: false`.
