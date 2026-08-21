// tests/code-index-io.test.ts
import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { codeIndexManifestPath } from "../src/code-index/paths.js";
import {
  loadCodeIndexManifest,
  saveCodeIndexManifest,
  tryLoadCodeIndexManifest,
} from "../src/code-index/io.js";
import type { CodeIndexManifest } from "../src/code-index/types.js";

const MANIFEST: CodeIndexManifest = {
  schema_version: 2,
  index_fingerprint: "fp-1",
  content_fingerprint: "sha256:" + "0".repeat(64),
  corpus: "src/**",
  grammar_versions: { typescript: "0.23.2" },
  roots: ["src"],
  files: { "src/index.ts": { hash: "sha256:abc", language: "typescript", symbols: 1 } },
};

describe("code-index io", () => {
  let root: string;
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "code-index-io-"));
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("saves and loads a manifest", () => {
    saveCodeIndexManifest(root, MANIFEST);
    const manifest = loadCodeIndexManifest(root);
    assert.equal(manifest.schema_version, 2);
    assert.equal(manifest.index_fingerprint, "fp-1");
    assert.equal(manifest.content_fingerprint, "sha256:" + "0".repeat(64));
    assert.equal(manifest.corpus, "src/**");
    assert.deepEqual(manifest.grammar_versions, { typescript: "0.23.2" });
    assert.deepEqual(manifest.roots, ["src"]);
    assert.deepEqual(manifest.files, MANIFEST.files);
    assert.ok(fs.existsSync(codeIndexManifestPath(root)));
  });

  it("throws on missing manifest", () => {
    assert.throws(() => loadCodeIndexManifest(root), /not found/);
  });

  it("throws on unsupported schema_version", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexManifestPath(root), JSON.stringify({ schema_version: 1 }));
    assert.throws(() => loadCodeIndexManifest(root), /unsupported/);
  });

  it("throws on corrupt manifest json", () => {
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexManifestPath(root), JSON.stringify({ schema_version: 2 }));
    assert.throws(() => loadCodeIndexManifest(root), /invalid/i);
  });

  it("tryLoadCodeIndexManifest returns null on missing or corrupt manifest", () => {
    assert.equal(tryLoadCodeIndexManifest(root), null);
    fs.mkdirSync(path.join(root, ".doc-canon"), { recursive: true });
    fs.writeFileSync(codeIndexManifestPath(root), "{not json");
    assert.equal(tryLoadCodeIndexManifest(root), null);
  });
});
