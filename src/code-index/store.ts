import { createHash } from "node:crypto";
import fs from "node:fs";
import { DatabaseSync, type StatementSync } from "node:sqlite";
import { codeIndexStorePath } from "./paths.js";

export const APPLICATION_ID = 0x434f4445; // "CODE"
export const USER_VERSION = 2;

const SCHEMA_SQL = `
CREATE TABLE symbols (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  name_lower      TEXT NOT NULL,
  kind            TEXT NOT NULL,
  signature       TEXT NOT NULL,
  signature_lower TEXT NOT NULL,
  file            TEXT NOT NULL,
  line            INTEGER NOT NULL,
  end_line        INTEGER NOT NULL,
  scope           TEXT NOT NULL
);
CREATE INDEX symbols_name_lower      ON symbols(name_lower);
CREATE INDEX symbols_file            ON symbols(file);
CREATE INDEX symbols_kind_name_lower ON symbols(kind, name_lower);

CREATE TABLE refs (
  kind      TEXT NOT NULL,
  from_file TEXT NOT NULL,
  to_file   TEXT NOT NULL,
  name      TEXT NOT NULL,
  line      INTEGER NOT NULL
);
CREATE INDEX refs_name ON refs(name);

CREATE VIRTUAL TABLE symbols_fts USING fts5(
  name_lower, signature_lower, content='symbols', content_rowid='id', tokenize='trigram'
);
`;

export function createCodeStore(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`PRAGMA application_id = ${APPLICATION_ID};`);
    db.exec(`PRAGMA user_version = ${USER_VERSION};`);
    db.exec(SCHEMA_SQL);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

function checkIdentity(db: DatabaseSync): void {
  const app = (db.prepare("SELECT * FROM pragma_application_id").get() as { application_id: number }).application_id;
  const ver = (db.prepare("SELECT * FROM pragma_user_version").get() as { user_version: number }).user_version;
  if (app !== APPLICATION_ID) throw new Error(`invalid code-index store application_id: ${app}`);
  if (ver !== USER_VERSION) throw new Error(`unsupported code-index store user_version: ${ver}`);
}

export function openCodeStore(root: string): DatabaseSync {
  const storePath = codeIndexStorePath(root);
  if (!fs.existsSync(storePath)) {
    throw new Error("code index store not found");
  }
  const db = new DatabaseSync(storePath);
  try {
    checkIdentity(db);
  } catch (e) {
    db.close();
    throw e;
  }
  return db;
}

export function storeStatements(db: DatabaseSync): { insertSymbol: StatementSync; insertRef: StatementSync } {
  return {
    insertSymbol: db.prepare(
      "INSERT INTO symbols (name, name_lower, kind, signature, signature_lower, file, line, end_line, scope) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ),
    insertRef: db.prepare(
      "INSERT INTO refs (kind, from_file, to_file, name, line) VALUES (?, ?, ?, ?, ?)",
    ),
  };
}

export function rebuildFts(db: DatabaseSync): void {
  db.exec("INSERT INTO symbols_fts(symbols_fts) VALUES('rebuild')");
}

export function computeContentFingerprint(db: DatabaseSync): string {
  const hash = createHash("sha256");
  for (const row of db.prepare(
    "SELECT name, kind, signature, file, line, end_line, scope FROM symbols ORDER BY name, kind, signature, file, line, end_line, scope",
  ).iterate() as Iterable<Record<string, unknown>>) {
    hash.update(JSON.stringify([row.name, row.kind, row.signature, row.file, row.line, row.end_line, row.scope]));
    hash.update("\n");
  }
  for (const row of db.prepare(
    "SELECT kind, from_file, to_file, name, line FROM refs ORDER BY kind, from_file, to_file, name, line",
  ).iterate() as Iterable<Record<string, unknown>>) {
    hash.update(JSON.stringify([row.kind, row.from_file, row.to_file, row.name, row.line]));
    hash.update("\n");
  }
  return `sha256:${hash.digest("hex")}`;
}
