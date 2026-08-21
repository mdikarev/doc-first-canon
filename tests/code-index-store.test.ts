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

  const SYMBOL_ROWS = [
    { name: "Reader", name_lower: "reader", kind: "class", signature: "class Reader {}", signature_lower: "class reader {}", file: "src/reader.ts", line: 1, end_line: 1, scope: "" },
    { name: "openCanonIndex", name_lower: "opencanonindex", kind: "function", signature: "function openCanonIndex(root: string)", signature_lower: "function opencanonindex(root: string)", file: "src/reader.ts", line: 5, end_line: 9, scope: "" },
  ];
  const REF_ROWS = [
    { kind: "import", from_file: "src/main.ts", to_file: "src/reader.ts", name: "Reader", line: 1 },
    { kind: "binding", from_file: "src/reader.ts", to_file: "src/reader.ts", name: "root", line: 7 },
  ];

  function buildStore(target: string, symbolOrder: number[], refOrder: number[]): void {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const db = createCodeStore(target);
    const st = storeStatements(db);
    db.exec("BEGIN");
    for (const i of symbolOrder) {
      const s = SYMBOL_ROWS[i];
      st.insertSymbol.run(s.name, s.name_lower, s.kind, s.signature, s.signature_lower, s.file, s.line, s.end_line, s.scope);
    }
    for (const i of refOrder) {
      const r = REF_ROWS[i];
      st.insertRef.run(r.kind, r.from_file, r.to_file, r.name, r.line);
    }
    rebuildFts(db);
    db.exec("COMMIT");
    db.close();
  }

  function seed(): void {
    buildStore(storePath(), [0, 1], [0, 1]);
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

  it("content_fingerprint is independent of insertion order", () => {
    const a = path.join(dir, "a.sqlite");
    const b = path.join(dir, "b.sqlite");
    buildStore(a, [0, 1], [0, 1]);
    buildStore(b, [1, 0], [1, 0]);
    const dbA = new DatabaseSync(a);
    const dbB = new DatabaseSync(b);
    try {
      const fa = computeContentFingerprint(dbA);
      const fb = computeContentFingerprint(dbB);
      assert.equal(fa, fb);
      assert.match(fa, /^sha256:[0-9a-f]{64}$/);
    } finally {
      dbA.close();
      dbB.close();
    }
  });

  it("openCodeStore fails closed on a wrong application_id", () => {
    seed();
    const db = new DatabaseSync(storePath());
    db.exec(`PRAGMA application_id = ${APPLICATION_ID + 1};`);
    db.close();
    assert.throws(() => openCodeStore(dir), /application_id/);
  });

  it("openCodeStore fails closed on a wrong user_version", () => {
    seed();
    const db = new DatabaseSync(storePath());
    db.exec("PRAGMA user_version = 9999;");
    db.close();
    assert.throws(() => openCodeStore(dir), /user_version/);
  });

  it("openCodeStore throws without creating a stray file when the store is missing", () => {
    assert.throws(() => openCodeStore(dir), /code index store not found/);
    assert.equal(fs.existsSync(storePath()), false);
  });
});
