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

  it("go.mod dir becomes a root", () => {
    write(repo, "go.mod", "module example.com/reader\n");
    write(repo, "reader.go", "package reader\n");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["reader.go"]);
  });

  it("nested go.mod is a separate root (workspace member)", () => {
    write(repo, "go.mod", "module example.com/root\n");
    write(repo, "cmd/tool/go.mod", "module example.com/tool\n");
    write(repo, "cmd/tool/main.go", "package main\n");
    write(repo, "reader.go", "package reader\n");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(roots, ["", "cmd/tool"]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), [
      "cmd/tool/main.go",
      "reader.go",
    ]);
  });

  it(".csproj dir becomes a root", () => {
    write(repo, "src/App/App.csproj", "<Project Sdk=\"Microsoft.NET.Sdk\" />");
    write(repo, "src/App/Program.cs", "class Program { }");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, ["src/App"]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/App/Program.cs"]);
  });

  it(".sln dir is a root and nested project files are listed once", () => {
    write(repo, "App.sln", "");
    write(repo, "src/App/App.csproj", "<Project />");
    write(repo, "src/App/Program.cs", "class Program { }");
    write(repo, "Shared.cs", "class Shared { }");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(roots, ["", "src/App"]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), [
      "Shared.cs",
      "src/App/Program.cs",
    ]);
  });

  it("Cargo.toml dir becomes a root", () => {
    write(repo, "Cargo.toml", "[package]\nname = \"x\"\n");
    write(repo, "src/lib.rs", "fn f() {}");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/lib.rs"]);
  });

  it("nested Cargo.toml (workspace member) is a separate root", () => {
    write(repo, "Cargo.toml", "[workspace]\n");
    write(repo, "crates/foo/Cargo.toml", "[package]\nname = \"foo\"\n");
    write(repo, "crates/foo/src/lib.rs", "fn f() {}");
    write(repo, "src/lib.rs", "fn g() {}");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(roots, ["", "crates/foo"]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), [
      "crates/foo/src/lib.rs",
      "src/lib.rs",
    ]);
  });

  it("pyproject.toml dir becomes a root", () => {
    write(repo, "pyproject.toml", "[project]\nname = \"x\"\n");
    write(repo, "src/x/__init__.py", "");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/x/__init__.py"]);
  });

  it("setup.py dir becomes a root", () => {
    write(repo, "setup.py", "from setuptools import setup\n");
    write(repo, "x.py", "def f(): pass\n");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.equal(vcsRoot, repo);
    assert.deepEqual(roots, [""]);
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

  it("default ignore excludes .worktrees", () => {
    write(repo, "package.json", "{}");
    write(repo, "src/index.ts", "export const x = 1;");
    write(repo, ".worktrees/feat/src/other.ts", "export const y = 1;");
    const { vcsRoot, roots } = discoverSourceRoots(repo, {});
    assert.deepEqual(listSourceFiles(vcsRoot, roots, []), ["src/index.ts"]);
  });
});
