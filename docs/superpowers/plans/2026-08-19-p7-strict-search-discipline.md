# P7 — Strict Search Discipline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the search-first rule structurally enforced: `search`/`code-index search` self-heal stale indexes at the CLI layer, every successful search writes a probe-log line, a new `discipline` command + `check` findings gate on un-probed state, and the skill/pointer gate makes search mandatory when an index is available.

**Architecture:** All runtime changes live in the CLI command layer — the public sync APIs `searchCanon` (`doc-canon/search`) and `searchCodeIndex` (`doc-canon/code-search`) stay byte-identical in behavior. Commands run the search, and when the returned pack is `stale` with no live watch pid, rebuild via the existing `syncCanonIndex`/`syncCodeIndex`, re-run, and append `"auto_reindexed"` to the pack's `warnings` (no Pack schema change). A shared `src/probe-log.ts` appends one JSON line per successful CLI search. A new `src/discipline/state.ts` computes probe currency from the probe log + index manifests; `doc-canon discipline` reports it and exits ≠0 on un-probed state; `check` merges informational `kind: "discipline"` findings (lenient report reader → no schema bump).

**Tech Stack:** Node ≥20, TypeScript ESM, `commander` CLI, tree-sitter WASM (existing), `node:test` runner via `tsx` (`npm test` = `tsx --test tests/**/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-08-19-p7-strict-search-discipline-design.md` (SoT; the plan argues from it). Canon already updated and validated (`docs/canon/CLI.md`, `GLOSSARY.md`, `SKILLS.md`, `ARCHITECTURE.md`, `future_plans/INDEX.md` + `p7-strict-search-discipline.md`).

## Global Constraints

- **Public API freeze:** `searchCanon` (`src/search/search.ts`) and `searchCodeIndex` (`src/code-search/search.ts`) must NOT change signature or behavior — auto-reindex and probe logging live only in `src/commands/search.ts` and `src/commands/code-index-search-cmd.ts`.
- **Missing index stays fail-closed:** never auto-build a missing index; keep exit ≠0 + hint (`doc-canon index` / `doc-canon code-index build`).
- **Watch owns freshness:** when a live watch pid exists, stale stays warn + serve (exit 0) — never rebuild.
- **Probe-log writes are non-fatal:** an unwritable `.doc-canon/` warns nothing and never breaks search.
- **Build before CLI tests:** CLI tests spawn `node bin/doc-canon.js`, which runs compiled `dist/` — run `npm run build` before `npm test` and before each CLI-level test step.
- **Flags invariant (canon):** `discipline` supports only `--root <path>` (default `.`) and `--json` — nothing else.
- **Report schema stays `schema_version: 1`:** adding `"discipline"` to `FindingKind` is safe because `readReport` is a lenient `JSON.parse` and `mergeCliFindings` preserves skill findings.
- **Quality over thrift unchanged:** the expand valve and legal deep reads stay as documented; this plan only adds the gate and the observability.
- Conventional commits (`feat:`, `test:`, `chore:`); Node ≥20 ESM; TypeScript strict (tsconfig already set).

---

### Task 1: Probe log module

**Files:**
- Create: `src/probe-log.ts`
- Test: `tests/probe-log.test.ts`

**Interfaces:**
- Consumes: `docCanonDir` from `src/paths.ts` (existing).
- Produces (used by Tasks 2–5):
  - `type ProbeKind = "doc" | "code"`
  - `type ProbeMode = "symbols" | "refs"`
  - `interface ProbeEntry { ts: string; kind: ProbeKind; query: string; mode?: ProbeMode; hits: number; freshness: "fresh" | "stale"; reindexed: boolean }`
  - `const PROBE_LOG_TRIM = 1000`
  - `function probeLogPath(root: string): string`
  - `function appendProbe(root: string, entry: ProbeEntry): void` — never throws
  - `function readProbeLog(root: string): ProbeEntry[]` — trims to last 1000 lines (best-effort rewrite), skips corrupt lines
  - `function lastProbeByKind(root: string, kind: ProbeKind): ProbeEntry | null`

- [ ] **Step 1: Write the failing test**

Create `tests/probe-log.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  appendProbe,
  lastProbeByKind,
  probeLogPath,
  readProbeLog,
} from "../src/probe-log.js";

describe("probe log", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "probe-log-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("appends one JSON line per probe and reads them back", () => {
    appendProbe(root, {
      ts: "2026-08-19T00:00:00.000Z",
      kind: "doc",
      query: "x",
      hits: 1,
      freshness: "fresh",
      reindexed: false,
    });
    appendProbe(root, {
      ts: "2026-08-19T00:00:01.000Z",
      kind: "code",
      query: "y",
      mode: "symbols",
      hits: 2,
      freshness: "fresh",
      reindexed: true,
    });
    const entries = readProbeLog(root);
    assert.equal(entries.length, 2);
    assert.equal(entries[0]!.kind, "doc");
    assert.equal(entries[1]!.kind, "code");
    assert.equal(entries[1]!.mode, "symbols");
    assert.equal(entries[1]!.reindexed, true);
  });

  it("lastProbeByKind returns the newest entry of that kind", () => {
    appendProbe(root, { ts: "2026-08-19T00:00:00.000Z", kind: "doc", query: "a", hits: 0, freshness: "stale", reindexed: false });
    appendProbe(root, { ts: "2026-08-19T00:00:02.000Z", kind: "code", query: "b", hits: 0, freshness: "fresh", reindexed: false });
    appendProbe(root, { ts: "2026-08-19T00:00:03.000Z", kind: "doc", query: "c", hits: 0, freshness: "fresh", reindexed: false });
    assert.equal(lastProbeByKind(root, "doc")?.query, "c");
    assert.equal(lastProbeByKind(root, "code")?.query, "b");
    assert.equal(lastProbeByKind(root, "doc")?.mode, undefined);
  });

  it("trims the log to the last 1000 lines", () => {
    for (let i = 0; i < 1005; i++) {
      appendProbe(root, { ts: `2026-08-19T00:00:${String(i % 60).padStart(2, "0")}.000Z`, kind: "doc", query: `q${i}`, hits: 0, freshness: "fresh", reindexed: false });
    }
    const entries = readProbeLog(root);
    assert.equal(entries.length, 1000);
    assert.equal(entries[0]!.query, "q5");
    assert.equal(entries[999]!.query, "q1004");
  });

  it("missing log reads empty; appendProbe never throws", () => {
    assert.deepEqual(readProbeLog(root), []);
    appendProbe(root, { ts: "2026-08-19T00:00:00.000Z", kind: "doc", query: "x", hits: 0, freshness: "fresh", reindexed: false });
    assert.ok(fs.existsSync(probeLogPath(root)));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/probe-log.test.ts`
Expected: FAIL — `Cannot find module '../src/probe-log.js'`.

- [ ] **Step 3: Write the module**

Create `src/probe-log.ts`:

```ts
// src/probe-log.ts
import fs from "node:fs";
import path from "node:path";
import { docCanonDir } from "./paths.js";

export type ProbeKind = "doc" | "code";
export type ProbeMode = "symbols" | "refs";

export interface ProbeEntry {
  ts: string;
  kind: ProbeKind;
  query: string;
  mode?: ProbeMode;
  hits: number;
  freshness: "fresh" | "stale";
  reindexed: boolean;
}

export const PROBE_LOG_TRIM = 1000;

export function probeLogPath(root: string): string {
  return path.join(docCanonDir(root), "probe-log.jsonl");
}

export function appendProbe(root: string, entry: ProbeEntry): void {
  try {
    fs.mkdirSync(docCanonDir(root), { recursive: true });
    fs.appendFileSync(probeLogPath(root), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Non-fatal: probe logging must never break search.
  }
}

export function readProbeLog(root: string): ProbeEntry[] {
  let lines: string[];
  try {
    const raw = fs.readFileSync(probeLogPath(root), "utf8");
    lines = raw.split("\n").filter((l) => l.trim() !== "");
  } catch {
    return [];
  }
  const kept = lines.slice(-PROBE_LOG_TRIM);
  if (kept.length < lines.length) {
    try {
      fs.writeFileSync(probeLogPath(root), `${kept.join("\n")}\n`, "utf8");
    } catch {
      // Trim is best-effort.
    }
  }
  const entries: ProbeEntry[] = [];
  for (const line of kept) {
    try {
      entries.push(JSON.parse(line) as ProbeEntry);
    } catch {
      // Skip corrupt lines.
    }
  }
  return entries;
}

export function lastProbeByKind(root: string, kind: ProbeKind): ProbeEntry | null {
  const entries = readProbeLog(root);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.kind === kind) return entries[i]!;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/probe-log.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/probe-log.ts tests/probe-log.test.ts
git commit -m "feat: probe log module (append/read/trim 1000) for search discipline"
```

---

### Task 2: Auto-reindex helper + doc `search` wiring

**Files:**
- Create: `src/commands/auto-reindex.ts`
- Modify: `src/commands/search.ts` (after the `searchCanon` call, before printing)
- Test: `tests/auto-reindex.test.ts` (unit, helper) and `tests/search-auto-reindex.test.ts` (CLI)

**Interfaces:**
- Consumes: `readWatchPid`, `isPidAlive` from `src/index/pid-lock.ts`; `readCodeIndexWatchPid` from `src/code-index/pid-lock.ts`; `syncCanonIndex` from `src/index/sync.ts`; `syncCodeIndex` from `src/code-index/sync.ts`; `appendProbe` from `src/probe-log.js` (Task 1).
- Produces (used by Tasks 3–4):
  - `type IndexKind = "doc" | "code"`
  - `function watchOwnsIndex(root: string, kind: IndexKind): boolean`
  - `async function refreshStaleIndex(root: string, kind: IndexKind, freshness: "fresh" | "stale"): Promise<boolean>` — returns true iff it rebuilt
- `searchCanonCli` behavior after this task: on stale + no watch → rebuild, re-run, append `"auto_reindexed"` to `warnings`, print stderr warning; append probe line; otherwise unchanged.

- [ ] **Step 1: Write the failing helper test**

Create `tests/auto-reindex.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { indexWatchPidPath } from "../src/index/paths.js";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";
import { watchOwnsIndex } from "../src/commands/auto-reindex.js";

describe("watchOwnsIndex", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "auto-reindex-"));
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("false when no pid files exist", () => {
    assert.equal(watchOwnsIndex(root, "doc"), false);
    assert.equal(watchOwnsIndex(root, "code"), false);
  });

  it("true when a live doc watch pid exists", () => {
    fs.writeFileSync(indexWatchPidPath(root), `${process.pid}\n`);
    assert.equal(watchOwnsIndex(root, "doc"), true);
    assert.equal(watchOwnsIndex(root, "code"), false);
  });

  it("true when a live code watch pid exists", () => {
    fs.writeFileSync(codeIndexWatchPidPath(root), `${process.pid}\n`);
    assert.equal(watchOwnsIndex(root, "code"), true);
    assert.equal(watchOwnsIndex(root, "doc"), false);
  });

  it("false when the pid file is stale (dead pid)", () => {
    fs.writeFileSync(indexWatchPidPath(root), "999999999\n");
    assert.equal(watchOwnsIndex(root, "doc"), false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/auto-reindex.test.ts`
Expected: FAIL — `Cannot find module '../src/commands/auto-reindex.js'`.

- [ ] **Step 3: Write the helper**

Create `src/commands/auto-reindex.ts`:

```ts
// src/commands/auto-reindex.ts
import { isPidAlive, readWatchPid } from "../index/pid-lock.js";
import { readCodeIndexWatchPid } from "../code-index/pid-lock.js";
import { syncCanonIndex } from "../index/sync.js";
import { syncCodeIndex } from "../code-index/sync.js";

export type IndexKind = "doc" | "code";

export function watchOwnsIndex(root: string, kind: IndexKind): boolean {
  const pid = kind === "doc" ? readWatchPid(root) : readCodeIndexWatchPid(root);
  return pid !== null && isPidAlive(pid);
}

/** Rebuilds a stale index when no watch owns it; returns true iff it rebuilt. */
export async function refreshStaleIndex(
  root: string,
  kind: IndexKind,
  freshness: "fresh" | "stale",
): Promise<boolean> {
  if (freshness !== "stale") return false;
  if (watchOwnsIndex(root, kind)) return false;
  if (kind === "doc") {
    await syncCanonIndex(root);
  } else {
    await syncCodeIndex(root);
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/auto-reindex.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the failing CLI test**

Create `tests/search-auto-reindex.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { indexWatchPidPath } from "../src/index/paths.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "search-auto-"));
  fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma\n");
  return root;
}

describe("doc search auto-reindex", () => {
  let root: string;
  beforeEach(() => { root = makeRoot(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("self-heals a stale index and serves fresh with auto_reindexed", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    const res = spawnSync("node", [bin, "search", "delta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "fresh");
    assert.ok(pack.warnings.includes("auto_reindexed"));
    assert.ok(pack.hits.some((h: { path: string }) => h.path === "docs/canon/a.md"));
  });

  it("serves stale with a warning when a watch owns the index", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(indexWatchPidPath(root), String(process.pid));
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    const res = spawnSync("node", [bin, "search", "delta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "stale");
    assert.ok(!pack.warnings.includes("auto_reindexed"));
  });

  it("fails closed on a missing index with a hint", () => {
    const res = spawnSync("node", [bin, "search", "delta", "--root", root], { encoding: "utf8" });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /doc-canon index/);
  });

  it("writes one probe-log line per successful search", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    spawnSync("node", [bin, "search", "alpha", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.kind, "doc");
    assert.equal(entry.query, "alpha");
    assert.equal(entry.reindexed, false);
  });

  it("records reindexed:true when the command rebuilt", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma delta\n");
    spawnSync("node", [bin, "search", "delta", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(JSON.parse(lines[0]!).reindexed, true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run build && npx tsx --test tests/search-auto-reindex.test.ts`
Expected: FAIL — current `search` never reindexes; the first test's pack stays `stale`.

- [ ] **Step 7: Wire auto-reindex + probe into `searchCanonCli`**

Modify `src/commands/search.ts`. Add imports:

```ts
import { refreshStaleIndex } from "./auto-reindex.js";
import { appendProbe } from "../probe-log.js";
```

Replace the block from `const pack = searchCanon(root, query, { maxHits, snippetLines });` through the end of the `try` so it reads:

```ts
  try {
    const runSearch = () => searchCanon(root, query, { maxHits, snippetLines });
    let served = runSearch();
    const reindexed = await refreshStaleIndex(root, "doc", served.freshness);
    if (reindexed) {
      served = runSearch();
      if (!served.warnings.includes("auto_reindexed")) {
        served.warnings = [...served.warnings, "auto_reindexed"];
      }
    }
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "doc",
      query: query.trim(),
      hits: served.hits.length,
      freshness: served.freshness,
      reindexed,
    });

    if (opts.json) {
      console.log(JSON.stringify(served));
    } else {
      if (reindexed) {
        console.error("warning: auto_reindexed (stale index rebuilt before serving)");
      }
      if (served.freshness === "stale") {
        console.error("warning: index_stale (run doc-canon index to refresh)");
      }
      if (served.hits.length === 0) {
        console.log("no hits");
      }
      for (const hit of served.hits) {
        console.log(`${hit.path}  score=${hit.score}`);
        for (const snip of hit.snippets) {
          console.log(`  L${snip.start_line}:`);
          for (const line of snip.text.split("\n")) {
            console.log(`    ${line}`);
          }
        }
      }
    }
    return 0;
  } catch (error) {
    // unchanged: SearchError handling
```

Keep the existing `catch` block as-is.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run build && npx tsx --test tests/search-auto-reindex.test.ts tests/auto-reindex.test.ts`
Expected: PASS (5 + 4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/commands/auto-reindex.ts src/commands/search.ts tests/auto-reindex.test.ts tests/search-auto-reindex.test.ts
git commit -m "feat: search self-heals a stale canon index and logs probes (P7)"
```

---

### Task 3: Code-index search auto-reindex + probe

**Files:**
- Modify: `src/commands/code-index-search-cmd.ts`
- Test: `tests/code-search-auto-reindex.test.ts`

**Interfaces:**
- Consumes: `refreshStaleIndex` from `src/commands/auto-reindex.js` (Task 2); `appendProbe` from `src/probe-log.js` (Task 1); `findVcsRoot` from `src/code-index/discovery.js` (existing).
- Produces: `codeIndexSearch` behavior — stale + no watch (checked at `vcsRoot`) → rebuild via `syncCodeIndex(vcsRoot)`, re-run, `"auto_reindexed"` warning; probe line with `kind: "code"`, `mode` = `refs` or `symbols`.

- [ ] **Step 1: Write the failing CLI test**

Create `tests/code-search-auto-reindex.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { codeIndexWatchPidPath } from "../src/code-index/paths.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "code-search-auto-"));
  fs.mkdirSync(path.join(root, ".git"));
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), "{}");
  fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\n");
  return root;
}

describe("code-index search auto-reindex", () => {
  let root: string;
  beforeEach(() => { root = makeRepo(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("self-heals a stale code index and serves fresh with auto_reindexed", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const res = spawnSync("node", [bin, "code-index", "search", "Beta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0, res.stderr);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "fresh");
    assert.ok(pack.warnings.includes("auto_reindexed"));
    assert.ok(pack.hits.some((h: { file: string; name: string }) => h.name === "Beta"));
  });

  it("serves stale with a warning when a watch owns the index", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(codeIndexWatchPidPath(root), String(process.pid));
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const res = spawnSync("node", [bin, "code-index", "search", "Beta", "--root", root, "--json"], { encoding: "utf8" });
    assert.equal(res.status, 0);
    const pack = JSON.parse(res.stdout);
    assert.equal(pack.freshness, "stale");
    assert.ok(!pack.warnings.includes("auto_reindexed"));
  });

  it("fails closed on a missing code index with a hint", () => {
    const res = spawnSync("node", [bin, "code-index", "search", "Alpha", "--root", root], { encoding: "utf8" });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /code-index build/);
  });

  it("writes a code probe line with mode", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    spawnSync("node", [bin, "code-index", "search", "--refs", "Alpha", "--root", root], { encoding: "utf8" });
    const lines = fs.readFileSync(path.join(root, ".doc-canon", "probe-log.jsonl"), "utf8").trim().split("\n");
    assert.equal(lines.length, 1);
    const entry = JSON.parse(lines[0]!);
    assert.equal(entry.kind, "code");
    assert.equal(entry.mode, "refs");
    assert.equal(entry.query, "Alpha");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx tsx --test tests/code-search-auto-reindex.test.ts`
Expected: FAIL — first test's pack stays `stale` (no auto-reindex yet).

- [ ] **Step 3: Wire auto-reindex + probe into `codeIndexSearch`**

Modify `src/commands/code-index-search-cmd.ts`. Add imports:

```ts
import { findVcsRoot } from "../code-index/discovery.js";
import { refreshStaleIndex } from "./auto-reindex.js";
import { appendProbe } from "../probe-log.js";
```

Replace the block inside `try` from `const pack = searchCodeIndex(...)` to the `if (opts.json)` branch so it reads:

```ts
  try {
    const runSearch = () =>
      searchCodeIndex(root, query ?? "", {
        maxHits,
        snippetLines,
        refs: opts.refs,
        kind: opts.kind as SymbolKind | undefined,
        file: opts.file,
        body: opts.body,
      });
    let served = runSearch();
    const vcsRoot = findVcsRoot(root);
    const reindexed = await refreshStaleIndex(vcsRoot, "code", served.freshness);
    if (reindexed) {
      served = runSearch();
      if (!served.warnings.includes("auto_reindexed")) {
        served.warnings = [...served.warnings, "auto_reindexed"];
      }
    }
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "code",
      query: (opts.refs ?? query ?? "").trim(),
      mode: opts.refs !== undefined ? "refs" : "symbols",
      hits: served.hits.length,
      freshness: served.freshness,
      reindexed,
    });

    if (opts.json) {
      console.log(JSON.stringify(served));
      return 0;
    }

    if (reindexed) {
      console.error("warning: auto_reindexed (stale code index rebuilt before serving)");
    }
    if (served.freshness === "stale") {
      console.error("warning: code_index_stale (run doc-canon code-index build to refresh)");
    }
    if (served.hits.length === 0) {
      console.log("no hits");
      return 0;
    }
    if (served.mode === "refs") {
      for (const hit of served.hits as CodeRefHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.refKind}  ${hit.name}  → ${hit.to}`, hit.snippets);
      }
    } else {
      for (const hit of served.hits as CodeSearchHit[]) {
        printHitLines(`${hit.file}  L${hit.line}  ${hit.kind}  ${hit.name}`, hit.snippets);
      }
    }
    return 0;
  } catch (error) {
    // unchanged: CodeSearchError handling
```

Keep the existing `catch` block as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run build && npx tsx --test tests/code-search-auto-reindex.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/code-index-search-cmd.ts tests/code-search-auto-reindex.test.ts
git commit -m "feat: code-index search self-heals a stale AST index and logs probes (P7)"
```

---

### Task 4: Discipline state + `doc-canon discipline` command

**Files:**
- Create: `src/discipline/state.ts`, `src/commands/discipline.ts`
- Modify: `src/cli.ts` (register the command)
- Test: `tests/discipline-cmd.test.ts`

**Interfaces:**
- Consumes: `tryLoadManifest` from `src/index/io.js`; `listCanonMarkdown` from `src/index/list.js`; `contentHash` from `src/index/hash.js`; `findVcsRoot` from `src/code-index/discovery.js`; `openCodeIndex` from `src/code-index/reader.js`; `lastProbeByKind` from `src/probe-log.js` (Task 1); `resolveRoot` from `src/paths.js`.
- Produces:
  - `interface KindState { indexExists: boolean; changed: string[]; lastProbe: ProbeEntry | null; unprobed: boolean }`
  - `interface DisciplineState { doc: KindState; code: KindState }`
  - `function computeDisciplineState(root: string): DisciplineState`
  - `async function disciplineReport(rootFlag: string, opts: { json?: boolean }): Promise<number>` — exit 1 iff `doc.unprobed || code.unprobed`

Semantics: `unprobed = indexExists && changed.length > 0 && (no probe of that kind || every changed file's mtime is newer than the last probe ts)`. Missing index / no changes → not un-probed.

- [ ] **Step 1: Write the failing test**

Create `tests/discipline-cmd.test.ts`:

```ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { appendProbe } from "../src/probe-log.js";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(repo, "bin", "doc-canon.js");

function makeDocRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "discipline-doc-"));
  fs.mkdirSync(path.join(root, "docs", "canon"), { recursive: true });
  fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta\n");
  return root;
}

function run(root: string, args: string[]): { status: number | null; stdout: string } {
  const res = spawnSync("node", [bin, "discipline", "--root", root, ...args], { encoding: "utf8" });
  return { status: res.status, stdout: res.stdout };
}

describe("doc-canon discipline", () => {
  let root: string;
  beforeEach(() => { root = makeDocRoot(); });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("exits 0 with no index (not applicable)", () => {
    const { status, stdout } = run(root, []);
    assert.equal(status, 0);
    assert.match(stdout, /no index/);
  });

  it("exits 0 when the index is fresh and nothing changed", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const { status } = run(root, []);
    assert.equal(status, 0);
  });

  it("exits 1 when files changed after the last probe (un-probed)", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "docs", "canon", "a.md"), "# Alpha\n\nalpha beta gamma\n");
    const { status } = run(root, []);
    assert.equal(status, 1);
  });

  it("exits 0 when a probe is newer than the change", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const doc = path.join(root, "docs", "canon", "a.md");
    fs.writeFileSync(doc, "# Alpha\n\nalpha beta gamma\n");
    const past = new Date("2020-01-01T00:00:00.000Z");
    fs.utimesSync(doc, past, past);
    appendProbe(root, {
      ts: new Date().toISOString(),
      kind: "doc",
      query: "alpha",
      hits: 1,
      freshness: "fresh",
      reindexed: false,
    });
    const { status } = run(root, []);
    assert.equal(status, 0);
  });

  it("--json emits a stable shape", () => {
    assert.equal(spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status, 0);
    const { status, stdout } = run(root, ["--json"]);
    assert.equal(status, 0);
    const parsed = JSON.parse(stdout);
    assert.equal(typeof parsed.doc.index_exists, "boolean");
    assert.equal(typeof parsed.doc.changed, "number");
    assert.equal(typeof parsed.doc.unprobed, "boolean");
    assert.equal(typeof parsed.code.index_exists, "boolean");
  });
});

describe("doc-canon discipline (code kind)", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "discipline-code-"));
    fs.mkdirSync(path.join(root, ".git"));
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\n");
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("exits 1 when source changed after the last code probe", () => {
    assert.equal(spawnSync("node", [bin, "code-index", "build", "--root", root], { encoding: "utf8" }).status, 0);
    fs.writeFileSync(path.join(root, "src", "a.ts"), "export class Alpha { field = 1; }\nexport class Beta { field = 2; }\n");
    const { status } = run(root, []);
    assert.equal(status, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run build && npx tsx --test tests/discipline-cmd.test.ts`
Expected: FAIL — `doc-canon discipline` is an unknown command (exit code 1 / `error: unknown command`).

- [ ] **Step 3: Write the state module**

Create `src/discipline/state.ts`:

```ts
// src/discipline/state.ts
import fs from "node:fs";
import path from "node:path";
import { listCanonMarkdown } from "../index/list.js";
import { contentHash } from "../index/hash.js";
import { tryLoadManifest } from "../index/io.js";
import { findVcsRoot } from "../code-index/discovery.js";
import { openCodeIndex } from "../code-index/reader.js";
import { lastProbeByKind, type ProbeEntry } from "../probe-log.js";

export interface KindState {
  indexExists: boolean;
  changed: string[];
  lastProbe: ProbeEntry | null;
  unprobed: boolean;
}

export interface DisciplineState {
  doc: KindState;
  code: KindState;
}

function changedAfterProbe(
  changed: string[],
  baseDir: string,
  probe: ProbeEntry | null,
): boolean {
  if (changed.length === 0) return false;
  if (probe === null) return true;
  const probeTs = Date.parse(probe.ts);
  if (Number.isNaN(probeTs)) return true;
  return changed.some((rel) => {
    try {
      return fs.statSync(path.join(baseDir, rel)).mtimeMs > probeTs;
    } catch {
      return true;
    }
  });
}

export function computeDocState(root: string): KindState {
  const manifest = tryLoadManifest(root);
  if (manifest === null) {
    return { indexExists: false, changed: [], lastProbe: null, unprobed: false };
  }
  const paths = listCanonMarkdown(root);
  const changed = paths.filter(
    (p) => manifest.docs[p]?.hash !== contentHash(fs.readFileSync(path.join(root, p), "utf8")),
  );
  const lastProbe = lastProbeByKind(root, "doc");
  return {
    indexExists: true,
    changed,
    lastProbe,
    unprobed: changedAfterProbe(changed, root, lastProbe),
  };
}

export function computeCodeState(root: string): KindState {
  try {
    const vcsRoot = findVcsRoot(root);
    const handle = openCodeIndex(vcsRoot);
    const live = handle.liveHashes();
    const manifestFiles = handle.manifest.files;
    const changed = [
      ...Object.keys(manifestFiles).filter((rel) => manifestFiles[rel]!.hash !== live[rel]),
      ...Object.keys(live).filter((rel) => manifestFiles[rel] === undefined),
    ];
    const lastProbe = lastProbeByKind(root, "code");
    return {
      indexExists: true,
      changed,
      lastProbe,
      unprobed: changedAfterProbe(changed, vcsRoot, lastProbe),
    };
  } catch {
    return { indexExists: false, changed: [], lastProbe: null, unprobed: false };
  }
}

export function computeDisciplineState(root: string): DisciplineState {
  return { doc: computeDocState(root), code: computeCodeState(root) };
}
```

- [ ] **Step 4: Write the command**

Create `src/commands/discipline.ts`:

```ts
// src/commands/discipline.ts
import { resolveRoot } from "../paths.js";
import {
  computeDisciplineState,
  type KindState,
} from "../discipline/state.js";

function describeKind(label: string, s: KindState): string {
  if (!s.indexExists) return `${label}: no index (not-applicable)`;
  const probe =
    s.lastProbe === null
      ? "never probed"
      : `last probe ${s.lastProbe.ts}`;
  return `${label}: ${s.changed.length} file(s) changed; ${probe}; un-probed: ${s.unprobed}`;
}

export async function disciplineReport(
  rootFlag: string,
  opts: { json?: boolean },
): Promise<number> {
  let root: string;
  try {
    root = resolveRoot(process.cwd(), rootFlag);
  } catch (error) {
    console.error(`error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
  const state = computeDisciplineState(root);
  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          doc: {
            index_exists: state.doc.indexExists,
            changed: state.doc.changed.length,
            last_probe: state.doc.lastProbe?.ts ?? null,
            unprobed: state.doc.unprobed,
          },
          code: {
            index_exists: state.code.indexExists,
            changed: state.code.changed.length,
            last_probe: state.code.lastProbe?.ts ?? null,
            unprobed: state.code.unprobed,
          },
        },
        null,
        2,
      ),
    );
  } else {
    console.log(describeKind("doc", state.doc));
    console.log(describeKind("code", state.code));
  }
  return state.doc.unprobed || state.code.unprobed ? 1 : 0;
}
```

- [ ] **Step 5: Register the command in `src/cli.ts`**

Insert after the `search` command block (after line 122 `);`):

```ts
program
  .command("discipline")
  .description("Report probe discipline; exit ≠0 when the index is un-probed")
  .option("--root <path>", "target repo root", ".")
  .option("--json", "emit JSON on stdout")
  .action(async (opts: { root: string; json?: boolean }) => {
    const { disciplineReport } = await import("./commands/discipline.js");
    process.exitCode = await disciplineReport(opts.root, opts);
  });
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm run build && npx tsx --test tests/discipline-cmd.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Commit**

```bash
git add src/discipline/state.ts src/commands/discipline.ts src/cli.ts tests/discipline-cmd.test.ts
git commit -m "feat: doc-canon discipline command — probe-currency report and un-probed exit gate (P7)"
```

---

### Task 5: `check` merges discipline findings

**Files:**
- Modify: `src/report/types.ts` (FindingKind), `src/commands/check.ts`
- Test: `tests/discipline-findings.test.ts`

**Interfaces:**
- Consumes: `computeDisciplineState` from `src/discipline/state.js` (Task 4); existing `stableFindingId`, `mergeCliFindings`, `readReport`, `writeReport` in `check.ts`; `syncCanonIndex` from `src/index/sync.js` (test); `checkCanon` from `src/commands/check.js` (test); `readReport` from `src/report/io.js` (test).
- Produces: `FindingKind` includes `"discipline"`; `check` report gains `source: "cli"`, `kind: "discipline"` findings. `check` exit code unchanged (validation-only).

- [ ] **Step 1: Write the failing test**

Create `tests/discipline-findings.test.ts`:

```ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkCanon } from "../src/commands/check.js";
import { readReport } from "../src/report/io.js";
import { syncCanonIndex } from "../src/index/sync.js";

const testsDir = dirname(fileURLToPath(import.meta.url));
const happyCanon = join(testsDir, "fixtures", "happy-canon");

describe("check discipline findings", () => {
  it("merges a kind=discipline finding when docs changed after the index", async () => {
    const root = mkdtempSync(join(tmpdir(), "discipline-findings-"));
    try {
      cpSync(happyCanon, root, { recursive: true });
      await syncCanonIndex(root);
      const overview = join(root, "docs", "canon", "OVERVIEW.md");
      writeFileSync(overview, `${readFileSync(overview, "utf8")}\n\nExtra drift line.\n`);

      const exit = await checkCanon(root);
      assert.equal(exit, 0, "discipline findings must not change the check exit code");

      const report = readReport(root);
      assert.ok(report !== null);
      const discipline = report.findings.filter((f) => f.kind === "discipline");
      assert.ok(discipline.length >= 1, `expected a discipline finding, got ${JSON.stringify(report.findings)}`);
      assert.equal(discipline[0]!.source, "cli");
      assert.ok(discipline[0]!.summary.includes("docs/canon/OVERVIEW.md") || discipline[0]!.paths.includes("docs/canon/OVERVIEW.md"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/discipline-findings.test.ts`
Expected: FAIL — no `discipline` finding in the report (and TS type error if the union is not extended yet).

- [ ] **Step 3: Extend `FindingKind`**

In `src/report/types.ts`, line 1, replace:

```ts
export type FindingKind = "structure" | "consistency" | "drift" | "conflict";
```

with:

```ts
export type FindingKind = "structure" | "consistency" | "drift" | "conflict" | "discipline";
```

- [ ] **Step 4: Merge discipline findings in `checkCanon`**

Modify `src/commands/check.ts`:

1. Add import:

```ts
import { computeDisciplineState, type KindState } from "../discipline/state.js";
```

2. In `checkCanon`, after the `cliFindings` array is built and before `writeReport`, insert:

```ts
  const discipline = computeDisciplineState(resolvedRoot);
  const disciplineFindings: Finding[] = [];
  const pushDiscipline = (label: "doc" | "code", s: KindState): void => {
    if (!s.indexExists || (s.changed.length === 0 && !s.unprobed)) return;
    disciplineFindings.push({
      id: stableFindingId("discipline", [label], `${label} index un-probed`),
      kind: "discipline",
      paths: s.changed,
      summary: `${label} index exists but ${s.changed.length} file(s) changed since the last probe (un-probed: ${s.unprobed})`,
      status: "open",
      source: "cli",
    });
  };
  pushDiscipline("doc", discipline.doc);
  pushDiscipline("code", discipline.code);
```

3. Replace `writeReport(resolvedRoot, mergeCliFindings(existing, cliFindings));` with:

```ts
  writeReport(resolvedRoot, mergeCliFindings(existing, [...cliFindings, ...disciplineFindings]));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx tsx --test tests/discipline-findings.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/report/types.ts src/commands/check.ts tests/discipline-findings.test.ts
git commit -m "feat: check merges kind=discipline findings (probe currency) into report.json (P7)"
```

---

### Task 6: Managed overlays — mandatory gate + `skills_stamp`

**Files:**
- Modify: `embedded/agents/AGENTS.block.md`, `embedded/rules/doc-canon.mdc`, `embedded/skills/canon-write/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`, `embedded/skills/canon-bootstrap/SKILL.md`, `src/version.ts`
- Regenerate repo copies: run `node bin/doc-canon.js upgrade-skills` after `npm run build` (updates this repo's `AGENTS.md`, `CLAUDE.md`, `.cursor/`, `.claude/`)
- Modify: `tests/embedded-assets.test.ts` (phrase locks)
- Test: `tests/embedded-assets.test.ts`

**Interfaces:**
- Consumes: embedded files listed above; `SKILLS_STAMP` in `src/version.ts`.
- Produces: managed content carrying the mandatory gate; `SKILLS_STAMP = "0.14.0"`; repo copies regenerated.

- [ ] **Step 1: Write the failing phrase-lock tests**

In `tests/embedded-assets.test.ts`, add a new `describe` block (after the existing ones, reusing the file's existing `readEmbedded` helper):

```ts
describe("P7 strict search discipline phrases", () => {
  it("AGENTS block makes search first mandatory", () => {
    const block = readEmbedded("agents", "AGENTS.block.md");
    assert.match(block, /Search first — it is mandatory when the index is available/);
    assert.match(block, /doc_miss/);
  });

  it("pointer rule carries the mandatory gate and miss formats", () => {
    const rule = readEmbedded("rules", "doc-canon.mdc");
    assert.match(rule, /## Search-first is mandatory/);
    assert.match(rule, /doc_miss: <query> -> docs:<path>/);
    assert.match(rule, /code_miss: <query> -> source:<path>/);
  });

  it("canon-write hardens the Scout gate", () => {
    const skill = readEmbedded("skills", "canon-write", "SKILL.md");
    assert.match(skill, /Mandatory probe/);
    assert.match(skill, /never licenses INDEX-first fallback/);
    assert.match(skill, /doc_miss: <query> -> docs:<path>/);
  });

  it("canon-audit and canon-bootstrap mirror the gate", () => {
    const audit = readEmbedded("skills", "canon-audit", "SKILL.md");
    const bootstrap = readEmbedded("skills", "canon-bootstrap", "SKILL.md");
    assert.match(audit, /doc_miss: <query> -> docs:<path>/);
    assert.match(bootstrap, /doc_miss: <query> -> docs:<path>/);
    assert.match(bootstrap, /mandatory when the indexes exist/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/embedded-assets.test.ts`
Expected: FAIL — the new phrases are absent from embedded content.

- [ ] **Step 3: Update `embedded/agents/AGENTS.block.md`**

Replace the opening sentence of the doc-canon block (the line starting `For design and development, treat \`docs/canon/\` as the context source of truth. Try \`doc-canon search\` first;`) so the first sentence reads:

> For design and development, treat `docs/canon/` as the context source of truth. **Search first — it is mandatory when the index is available:** run `doc-canon search "<topic>"` (and `doc-canon code-index search` for covered-language code) before deep reads; on fail-closed (missing index) run `doc-canon index` / `code-index build` and retry; only if building fails, fall back to `docs/canon/INDEX.md` and note every read outside a pack (`doc_miss` / `code_miss`).

Keep the rest of the block unchanged.

- [ ] **Step 4: Update `embedded/rules/doc-canon.mdc`**

After the `# doc-canon context rule` intro paragraph (and before `## Feature-change order (canon-first)`), insert a new section:

```markdown
## Search-first is mandatory

For design and development, `doc-canon search "<topic>"` (and `doc-canon code-index search` for covered languages) is **mandatory before deep reads when an index exists or can be built** — `doc-canon search` self-heals a stale index, and a missing index fails closed with a build hint; run `doc-canon index` / `doc-canon code-index build`, then retry. Only if building fails, fall back to INDEX-first / source-first and note each read outside a pack: `doc_miss: <query> -> docs:<path>` or `code_miss: <query> -> source:<path>`. The expand valve is unchanged: a thin probe licenses targeted reads as evidence with a miss note — never silent under-reading, never silent skipping.
```

Also, in the existing `## Code analysis order` section, replace the first sentence `For code analysis in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), try \`doc-canon code-index search <symbol> --root <repo>\` before reading whole source files.` with `For code analysis in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), run \`doc-canon code-index search <symbol> --root <repo>\` before reading whole source files — mandatory when the index is available.`

- [ ] **Step 5: Update `embedded/skills/canon-write/SKILL.md`**

In the `## Scout → Expand before deep reads` section, replace steps 1–3:

```markdown
1. **Try search first:** run `doc-canon search "<topic>"` and build the working-set manifest from pack paths and brief snippet stubs. Do not dump all canon markdown.
2. **If search fails closed** (missing/corrupt index): surface an explicit hint to run `doc-canon index`, then continue with INDEX-first progressive disclosure (`docs/canon/INDEX.md`; select only relevant rows). Do not hard-stop the skill.
3. **If search returns `index_stale`:** surface the warning, continue with the pack, and Expand when evidence feels thin.
```

with:

```markdown
1. **Mandatory probe:** run `doc-canon search "<topic>"` (and `doc-canon code-index search` when covered source is in scope) and build the working-set manifest from pack paths and brief snippet stubs. Do not dump all canon markdown.
2. **If search fails closed** (missing/corrupt index): run `doc-canon index` (and `code-index build` when covered source exists), then re-run the search. Only if building fails, continue with INDEX-first progressive disclosure (`docs/canon/INDEX.md`; select only relevant rows) and record `doc_miss: <query> -> docs:<path>` for every file read outside the pack. Search failure alone never licenses INDEX-first fallback.
3. **If search returns `index_stale`:** the CLI self-heals when no watch owns the index; with a live watch, surface the warning, continue with the pack, and Expand when evidence feels thin.
```

- [ ] **Step 6: Update `embedded/skills/canon-audit/SKILL.md`**

In the Scout step (currently step 3, starting `**Try search first:** ensure the indexes are built`), replace the sentence `If search fails closed, hint \`doc-canon index\` and fall back to INDEX-first Scout.` with `If search fails closed, run \`doc-canon index\` (and \`code-index build\` when covered source is in scope), then re-run the search; only if building fails, fall back to INDEX-first Scout and record \`doc_miss: <query> -> docs:<path>\` for every file read outside the pack.`

- [ ] **Step 7: Update `embedded/skills/canon-bootstrap/SKILL.md`**

In step 6 (index-first step), replace `Later goal steps prefer \`doc-canon search\` / \`code-index search\` when the indexes exist; on empty/thin probe results, read source as evidence and note the miss (\`code_miss: <query> -> source:<path>\`).` with `Later goal steps run \`doc-canon search\` / \`code-index search\` first — mandatory when the indexes exist — and on empty/thin probe results read source as evidence and note the miss (\`code_miss: <query> -> source:<path>\` / \`doc_miss: <query> -> docs:<path>\`).`

- [ ] **Step 8: Bump `skills_stamp`**

In `src/version.ts`, replace `export const SKILLS_STAMP = "0.13.0";` with `export const SKILLS_STAMP = "0.14.0";`.

- [ ] **Step 9: Regenerate repo copies**

Run: `npm run build && node bin/doc-canon.js upgrade-skills`
Expected: `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/doc-canon.mdc`, `.cursor/skills/*`, `.claude/skills/*` refreshed from `embedded/`. `git diff --stat` shows those files changed.

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx tsx --test tests/embedded-assets.test.ts`
Expected: PASS (new phrase-lock tests included).

- [ ] **Step 11: Commit**

```bash
git add embedded src/version.ts AGENTS.md CLAUDE.md .cursor .claude tests/embedded-assets.test.ts
git commit -m "feat: mandatory search-first gate in managed overlays; skills_stamp 0.14.0 (P7)"
```

---

### Task 7: README mirror, release notes, full verification

**Files:**
- Modify: `README.md` (EN + RU mirrors), `CHANGELOG.md`, `package.json` (version)

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: user-facing docs aligned with the new behavior; `doc-canon@0.5.0`.

- [ ] **Step 1: Update README (EN)**

1. In the `### search` section, replace the line `Search the existing BM25 index and print a bounded context pack (ranked paths, scores, live-file snippets). Does not auto-reindex. Missing/corrupt index → exit ≠0 with a hint to run \`doc-canon index\`. Stale index → exit 0 with an \`index_stale\` warning (stderr in human mode; Pack \`warnings\` / \`freshness\` with \`--json\`).` with `Search the existing BM25 index and print a bounded context pack (ranked paths, scores, live-file snippets). A stale index is self-healed at the CLI layer when no watch owns it (rebuild then serve, \`auto_reindexed\` warning); with a live watch, stale is served with exit 0 and an \`index_stale\` warning. Missing/corrupt index → exit ≠0 with a hint to run \`doc-canon index\`. Every successful search appends a line to \`.doc-canon/probe-log.jsonl\`.`

2. In the `### code-index search` section, replace `Search the code AST index and print a bounded code pack ... Does not auto-reindex. Missing/corrupt index → exit ≠0 with a hint to run \`doc-canon code-index build\`. Stale index → exit 0 with a \`code_index_stale\` warning (stderr in human mode; \`warnings\` / \`freshness\` in \`--json\`).` with the same self-healing wording, plus the probe-log sentence.

3. Add a new `### discipline` subsection after `### report`:

```markdown
### discipline

Report probe discipline: reads `.doc-canon/probe-log.jsonl` (last doc/code probe age, probe count) plus the index manifests (files changed since each probe). Exits ≠0 when an index exists and relevant files changed after the last probe of that kind (un-probed state). Missing index or never-probed fresh clone → not-applicable, exit 0.

```bash
doc-canon discipline
doc-canon discipline --root /path/to/repo
doc-canon discipline --json
```
```

4. In the `Agent skills` / README overview list of commands (the `## Usage` command list) add `discipline`.

5. Repeat steps 1–4 in the Russian (`-ru`) mirror with the same content translated.

- [ ] **Step 2: Update CHANGELOG.md**

Add under an `## 0.5.0` heading (above the current top entry):

```markdown
## 0.5.0

- **feat:** `search` / `code-index search` self-heal a stale index at the CLI layer when no watch owns it (rebuild then serve; `auto_reindexed` warning); missing index stays fail-closed
- **feat:** every successful CLI search appends one line to `.doc-canon/probe-log.jsonl` (trimmed to 1000)
- **feat:** new `doc-canon discipline` command — probe-currency report (`--json`), exit ≠0 on un-probed state; `check` merges `kind: "discipline"` findings
- **feat:** mandatory search-first gate in managed overlays (pointer rule, `AGENTS.md`, `CLAUDE.md`, canon skills); machine-parseable `code_miss` / new `doc_miss`; `skills_stamp` 0.14.0
```

- [ ] **Step 3: Bump the package version**

In `package.json`, replace `"version": "0.4.0"` with `"version": "0.5.0"`. Run `npm install --package-lock-only` to sync `package-lock.json`.

- [ ] **Step 4: Full verification**

Run, in order:

```bash
npm run build
npm test
node bin/doc-canon.js validate
node bin/doc-canon.js check
node bin/doc-canon.js discipline   # expect exit 0 (probe log just written by tests? no — expect report on this repo's state)
node bin/doc-canon.js search "CLI commands" --json
node bin/doc-canon.js code-index search "searchCanon"
```

Expected: build clean; full suite green (including the new probe-log / auto-reindex / discipline / phrase-lock tests and the existing token-cost guard); `validate` says valid; `search`/`code-index search` serve fresh packs and append probe-log lines (dogfood: this repo now has a probe log).

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md package.json package-lock.json
git commit -m "chore: doc-canon 0.5.0 — README/CHANGELOG mirror for P7 strict search discipline"
```

- [ ] **Step 6: (Optional, before publishing) dry-run release**

Run: `DRY_RUN=1 npm run release`
Expected: test + build + validate + pack-check pass without publishing.

---

## Self-Review

- **Spec coverage:** Spec Goals 1–2 (self-healing freshness + observable probes) → Tasks 2–4; Goal 3 (hard skill gate) → Task 6; Goal 4 (managed overlays + stamp) → Task 6; Goal 5 (tests) → Tasks 1–6; Goal 6 (measurement foundation) → probe log in Tasks 2–3. Spec Non-goals respected: public APIs untouched (Tasks 2–3 only touch commands), missing index fail-closed (tests assert), watch-owned stale warn+serve (tests assert), no incremental BM25 (full `sync*` rebuild used), miss notes stay format-only (Task 6 text). Decisions table: `reindexed` signal via `warnings` (Tasks 2–3), probe-log fields incl. `mode` code-only (Task 3), `FindingKind` + lenient reader (Task 5), `discipline` exit gate + not-applicable (Task 4), canon absorption already applied.
- **Placeholder scan:** every step carries real code or exact text; no TBD/TODO.
- **Type consistency:** `appendProbe`/`readProbeLog`/`lastProbeByKind` signatures match Task 1 and all consumers (Tasks 2–4); `refreshStaleIndex(root, kind, freshness)` matches Tasks 2–3; `computeDisciplineState`/`KindState`/`DisciplineState` match Tasks 4–5; `disciplineReport(rootFlag, opts)` matches `src/cli.ts` registration (Task 4). `probeLogPath` used only in tests. `finding` field names (`kind`, `paths`, `summary`, `status`, `source`) match `src/report/types.ts`.
