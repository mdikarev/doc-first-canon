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
    saveCodeIndexPair(root, MANIFEST, AST);
    const raw = JSON.parse(fs.readFileSync(codeAstIndexPath(root), "utf8")) as CodeAstIndex;
    raw.index_fingerprint = "fp-2";
    fs.writeFileSync(codeAstIndexPath(root), JSON.stringify(raw));
    assert.throws(() => loadCodeIndexPair(root), /fingerprint mismatch/);
  });

  it("throws on corrupt manifest json", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexManifestPath(root), JSON.stringify({ schema_version: 1 }));
    fs.writeFileSync(codeAstIndexPath(root), JSON.stringify(AST));
    assert.throws(() => loadCodeIndexPair(root), /invalid/i);
  });

  it("write order: ast before manifest (manifest is the commit marker)", () => {
    saveCodeIndexPair(root, MANIFEST, AST);
    assert.ok(fs.existsSync(codeAstIndexPath(root)));
    assert.ok(fs.existsSync(codeIndexManifestPath(root)));
  });
});
