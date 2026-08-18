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
    const config: CodeIndexConfig = { ignore: ["**/generated/**"] };
    const { vcsRoot, roots } = discoverSourceRoots(repo, config);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, config.ignore ?? []), [
      "src/index.ts",
    ]);
  });
});
