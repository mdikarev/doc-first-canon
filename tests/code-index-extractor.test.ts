// tests/code-index-extractor.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/typescript.js";

describe("grammarForFile", () => {
  it("maps extensions to grammars", () => {
    assert.equal(grammarForFile("a.ts"), "typescript");
    assert.equal(grammarForFile("a.tsx"), "tsx");
    assert.equal(grammarForFile("a.js"), "javascript");
    assert.equal(grammarForFile("a.mjs"), "javascript");
    assert.equal(grammarForFile("a.cjs"), "javascript");
  });
});

describe("extractFile symbols", () => {
  it("extracts class, method, property, function, const, type", async () => {
    const text = `export type Handle = { score(q: string): number };
export class Reader {
  private scores: number[] = [];
  score(q: string): number {
    const n = 1;
    return this.scores.length + n;
  }
}
export function openReader(): Reader {
  return new Reader();
}
export const DEFAULT = openReader();
export enum Kind { A, B }
export namespace NS { export const v = 1; }`;
    const { symbols } = await extractFile("src/reader.ts", text, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.Handle.kind, "type");
    assert.equal(byName.Reader.kind, "class");
    assert.equal(byName.score.kind, "method");
    assert.equal(byName.openReader.kind, "function");
    assert.equal(byName.DEFAULT.kind, "const");
    assert.equal(byName.Kind.kind, "enum");
    assert.equal(byName.NS.kind, "module");
    assert.equal(byName.score.scope, "Reader");
    assert.ok(byName.Reader.file === "src/reader.ts");
    assert.ok(byName.score.line > 0 && byName.score.endLine >= byName.score.line);
  });

  it("extracts interface and nested method in interface", async () => {
    const { symbols } = await extractFile(
      "src/api.ts",
      `export interface Api { get(id: string): Promise<string>; }`,
      new Set(),
    );
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.Api.kind, "interface");
    assert.equal(byName.get.kind, "method");
    assert.equal(byName.get.scope, "Api");
  });
});
