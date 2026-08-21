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

  it("rejects --max-hits below 1", () => {
    const r = spawnSync(
      "node",
      [bin, "scout", "retrieval", "--root", root, "--max-hits", "0"],
      { encoding: "utf8" },
    );
    assert.notEqual(r.status, 0);
  });

  it("--no-code skips the code probe (code hits present without it)", () => {
    fs.mkdirSync(path.join(root, ".git"));
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(path.join(root, "src", "reader.ts"), "export class Reader {}\n");
    assert.equal(
      spawnSync("node", [bin, "index", "--root", root], { encoding: "utf8" }).status,
      0,
    );
    assert.equal(
      spawnSync("node", [bin, "code-index", "build", "--root", root], {
        encoding: "utf8",
      }).status,
      0,
    );

    const withCode = spawnSync(
      "node",
      [bin, "scout", "Reader", "--root", root, "--json"],
      { encoding: "utf8" },
    );
    assert.equal(withCode.status, 0, withCode.stderr + withCode.stdout);
    const manifest = JSON.parse(withCode.stdout);
    assert.ok(Array.isArray(manifest.code));
    assert.equal(manifest.code[0]!.file, "src/reader.ts");
    assert.equal(manifest.code[0]!.name, "Reader");

    const withoutCode = spawnSync(
      "node",
      [bin, "scout", "Reader", "--root", root, "--json", "--no-code"],
      { encoding: "utf8" },
    );
    assert.equal(withoutCode.status, 0, withoutCode.stderr + withoutCode.stdout);
    const manifestNoCode = JSON.parse(withoutCode.stdout);
    assert.equal(manifestNoCode.code, undefined);
  });
});
