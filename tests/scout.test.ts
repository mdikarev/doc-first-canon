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
    const manifest = await buildScoutManifest(root, "scout retrieval");
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
