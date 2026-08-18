// tests/code-analysis-token-guard.test.ts
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { syncCodeIndex } from "../src/code-index/sync.js";
import { searchCodeIndex } from "../src/code-search/search.js";

function makeRepo(): string {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "token-guard-"));
  fs.mkdirSync(path.join(repo, ".git"));
  return repo;
}

function write(root: string, rel: string, body: string): void {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body);
}

function bigFile(prefix: string, lines: number): string {
  const body: string[] = [`export class ${prefix} {`];
  for (let i = 0; i < lines; i++) body.push(`  field${i} = ${i};`);
  body.push("}");
  return body.join("\n");
}

describe("code-analysis token-cost guard", () => {
  let repo: string;
  beforeEach(async () => {
    repo = makeRepo();
    write(repo, "package.json", "{}");
    write(repo, "src/a.ts", bigFile("Alpha", 200));
    write(repo, "src/b.ts", bigFile("Beta", 200));
    write(repo, "src/c.ts", bigFile("Gamma", 200));
    write(repo, "src/d.ts", bigFile("Delta", 200));
    await syncCodeIndex(repo);
  });
  afterEach(() => fs.rmSync(repo, { recursive: true, force: true }));

  it("bounded code pack reads fewer bytes than full source files", () => {
    const pack = searchCodeIndex(repo, "Alpha");
    assert.ok(pack.hits.length >= 1);
    const packBytes = pack.hits.reduce(
      (sum, h) => sum + h.snippets.reduce((s, w) => s + Buffer.byteLength(w.text, "utf8"), 0),
      0,
    );
    let fullBytes = 0;
    for (const rel of ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"]) {
      fullBytes += Buffer.byteLength(fs.readFileSync(path.join(repo, rel), "utf8"));
    }
    assert.ok(packBytes > 0, "pack must contain snippet bytes");
    assert.ok(
      packBytes < fullBytes,
      `pack ${packBytes}B should be < full source ${fullBytes}B`,
    );
  });
});
