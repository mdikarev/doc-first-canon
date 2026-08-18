// tests/code-index-references.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile } from "../src/code-index/extractors/typescript.js";

describe("extractFile references", () => {
  it("extracts anchors for same-file symbol usages", async () => {
    const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    const anchors = references.filter((r) => r.kind === "anchor");
    assert.ok(anchors.some((r) => r.name === "Reader" && r.to === "src/reader.ts"));
  });

  it("extracts import edges resolved against knownFiles", async () => {
    const text = `import { openReader, Reader } from "./reader";
import * as NS from "./ns";
import def from "./def";
export function run(): number {
  const r: Reader = openReader();
  return r.score("q");
}`;
    const known = new Set(["src/reader.ts", "src/ns.ts", "src/def.ts", "src/run.ts"]);
    const { references } = await extractFile("src/run.ts", text, known);
    const imports = references
      .filter((r) => r.kind === "import")
      .sort((a, b) => (a.name + a.to < b.name + b.to ? -1 : a.name + a.to > b.name + b.to ? 1 : 0));
    assert.deepEqual(
      imports.map((r) => ({ name: r.name, to: r.to, from: r.from })),
      [
        { name: "NS", to: "src/ns.ts", from: "src/run.ts" },
        { name: "Reader", to: "src/reader.ts", from: "src/run.ts" },
        { name: "def", to: "src/def.ts", from: "src/run.ts" },
        { name: "openReader", to: "src/reader.ts", from: "src/run.ts" },
      ],
    );
  });

  it("resolves extensionless and index imports", async () => {
    const text = `import { a } from "./mod";
import { b } from "./dir";`;
    const known = new Set(["src/mod.ts", "src/dir/index.ts", "src/a.ts"]);
    const { references } = await extractFile("src/a.ts", text, known);
    const imports = references.filter((r) => r.kind === "import").sort((x, y) => x.name.localeCompare(y.name));
    assert.deepEqual(
      imports.map((r) => ({ name: r.name, to: r.to })),
      [
        { name: "a", to: "src/mod.ts" },
        { name: "b", to: "src/dir/index.ts" },
      ],
    );
  });

  it("skips bare-package imports", async () => {
    const text = `import { x } from "commander";`;
    const { references } = await extractFile("src/a.ts", text, new Set());
    assert.equal(references.filter((r) => r.kind === "import").length, 0);
  });

  it("extracts bindings for const and parameter usages", async () => {
    const text = `export function run(q: string): number {
  const n = 1;
  return n + q.length + q.length;
}`;
    const { references } = await extractFile("src/run.ts", text, new Set());
    const bindings = references.filter((r) => r.kind === "binding");
    const names = bindings.map((r) => r.name).sort();
    assert.ok(names.includes("n"));
    assert.ok(names.includes("q"));
    assert.equal(bindings.filter((r) => r.name === "q").length, 2);
  });

  it("does not emit anchors/bindings for declaration names themselves", async () => {
    const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    const declNameRefs = references.filter(
      (r) => r.kind === "anchor" && r.name === "openReader" && r.line === 1,
    );
    assert.equal(declNameRefs.length, 0);
  });
});
