import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createCodeStore, openCodeStore, storeStatements, rebuildFts, computeContentFingerprint, APPLICATION_ID } from "../src/code-index/store.js";
import { codeIndexStorePath } from "../src/code-index/paths.js";

describe("code-index store", () => {
  let dir: string;
  beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), "code-store-")); });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const storePath = () => codeIndexStorePath(dir);

  function seed(): void {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    const db = createCodeStore(storePath());
    const st = storeStatements(db);
    db.exec("BEGIN");
    st.insertSymbol.run("Reader", "reader", "class", "class Reader {}", "class reader {}", "src/reader.ts", 1, 1, "");
    st.insertSymbol.run("openCanonIndex", "opencanonindex", "function", "function openCanonIndex(root: string)", "function opencanonindex(root: string)", "src/reader.ts", 5, 9, "");
    st.insertRef.run("import", "src/main.ts", "src/reader.ts", "Reader", 1);
    st.insertRef.run("binding", "src/reader.ts", "src/reader.ts", "root", 7);
    rebuildFts(db);
    db.exec("COMMIT");
    db.close();
  }

  it("round-trips symbols and refs with JS-folded search columns", () => {
    seed();
    const db = new DatabaseSync(storePath());
    const sym = db.prepare("SELECT name, name_lower, kind, signature_lower, file, line, end_line, scope FROM symbols ORDER BY line").all();
    assert.equal(sym.length, 2);
    assert.equal(sym[0].name, "Reader");
    assert.equal(sym[0].name_lower, "reader");
    assert.equal(sym[0].signature_lower, "class reader {}");
    const ref = db.prepare("SELECT kind, from_file, to_file, name, line FROM refs ORDER BY from_file").all();
    assert.equal(ref.length, 2);
    assert.equal(ref[0].to_file, "src/reader.ts");
    const hit = db.prepare("SELECT rowid FROM symbols_fts WHERE symbols_fts MATCH ?").all("canon");
    assert.equal(hit.length, 1);
    db.close();
  });

  it("content_fingerprint is stable across reads", () => {
    seed();
    const a = computeContentFingerprint(new DatabaseSync(storePath()));
    const b = computeContentFingerprint(new DatabaseSync(storePath()));
    assert.equal(a, b);
    assert.match(a, /^sha256:[0-9a-f]{64}$/);
  });

  it("openCodeStore fails closed on a wrong application_id", () => {
    seed();
    const db = new DatabaseSync(storePath());
    db.exec(`PRAGMA application_id = ${APPLICATION_ID + 1};`);
    db.close();
    assert.throws(() => openCodeStore(dir), /application_id/);
  });

  it("openCodeStore throws without creating a stray file when the store is missing", () => {
    assert.throws(() => openCodeStore(dir), /code index store not found/);
    assert.equal(fs.existsSync(storePath()), false);
  });
});
