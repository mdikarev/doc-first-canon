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
      imports.map((r) => ({ name: r.name, to: r.to, from: r.from, line: r.line })),
      [
        { name: "NS", to: "src/ns.ts", from: "src/run.ts", line: 2 },
        { name: "Reader", to: "src/reader.ts", from: "src/run.ts", line: 1 },
        { name: "Reader", to: "src/reader.ts", from: "src/run.ts", line: 5 },
        { name: "def", to: "src/def.ts", from: "src/run.ts", line: 3 },
        { name: "openReader", to: "src/reader.ts", from: "src/run.ts", line: 1 },
        { name: "openReader", to: "src/reader.ts", from: "src/run.ts", line: 5 },
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

  it("resolves ESM .js-extension specifiers to TS sources", async () => {
    const text = `import { Reader } from "./reader.js";
export function open(): Reader {
  return new Reader();
}`;
    const known = new Set(["src/reader.ts", "src/open.ts"]);
    const { references } = await extractFile("src/open.ts", text, known);
    const atStatement = references.find((r) => r.kind === "import" && r.line === 1);
    assert.deepEqual(atStatement, {
      kind: "import",
      from: "src/open.ts",
      to: "src/reader.ts",
      name: "Reader",
      line: 1,
    });
  });

  it("resolves index.js and .mjs/.cjs specifiers", async () => {
    const text = `import { a } from "./dir/index.js";
import { b } from "./util.mjs";
import { c } from "./shim.cjs";`;
    const known = new Set(["src/dir/index.ts", "src/util.mts", "src/shim.cts", "src/x.ts"]);
    const { references } = await extractFile("src/x.ts", text, known);
    const imports = references.filter((r) => r.kind === "import");
    const byName = Object.fromEntries(imports.map((r) => [r.name, r]));
    assert.equal(byName.a?.to, "src/dir/index.ts");
    assert.equal(byName.b?.to, "src/util.mts");
    assert.equal(byName.c?.to, "src/shim.cts");
  });

  it("emits call-site edges for imported-name usages", async () => {
    const text = `import { openReader } from "./reader.js";
export function run(): number {
  const r: Reader = openReader();
  return openReader().score("q");
}`;
    const known = new Set(["src/reader.ts", "src/run.ts"]);
    const { references } = await extractFile("src/run.ts", text, known);
    const callSites = references.filter((r) => r.kind === "import" && r.line > 1);
    assert.deepEqual(
      callSites.map((r) => ({ name: r.name, to: r.to, line: r.line })),
      [
        { name: "openReader", to: "src/reader.ts", line: 3 },
        { name: "openReader", to: "src/reader.ts", line: 4 },
      ],
    );
  });

  it("does not emit call-site edges for same-file symbols", async () => {
    const text = `export function openReader(): Reader {
  return new Reader();
}
export class Reader {}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    assert.equal(references.filter((r) => r.kind === "import").length, 0);
  });

  it("maps aliased import names to their canonical definition", async () => {
    const text = `import { openReader as open } from "./reader.js";
export function run(): void {
  open();
}`;
    const known = new Set(["src/reader.ts", "src/run.ts"]);
    const { references } = await extractFile("src/run.ts", text, known);
    const callSites = references.filter((r) => r.kind === "import" && r.line > 1);
    assert.deepEqual(
      callSites.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "openReader", to: "src/reader.ts" }],
    );
  });

  it("emits member-access edges for constructor-backed imported bindings", async () => {
    const text = `import { Bm25Index } from "./bm25.js";
export function run(): void {
  const h = new Bm25Index();
  h.build("q");
  const v = h.score;
}`;
    const known = new Set(["src/index/bm25.ts", "src/index/run.ts"]);
    const { references } = await extractFile("src/index/run.ts", text, known);
    const members = references
      .filter((r) => r.kind === "import" && r.name.includes("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to, from: r.from })),
      [
        { name: "Bm25Index.build", to: "src/index/bm25.ts", from: "src/index/run.ts" },
        { name: "Bm25Index.score", to: "src/index/bm25.ts", from: "src/index/run.ts" },
      ],
    );
  });

  it("emits member-access edges for same-file class constructors", async () => {
    const text = `export class Reader {
  score(q: string): number { return q.length; }
}
export function run(): void {
  const r = new Reader();
  r.score("q");
}`;
    const { references } = await extractFile("src/reader.ts", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name === "Reader.score");
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Reader.score", to: "src/reader.ts" }],
    );
  });

  it("resolves aliased constructors to canonical member names", async () => {
    const text = `import { Bm25Index as BM } from "./bm25.js";
const h = new BM();
h.build("q");`;
    const known = new Set(["src/index/bm25.ts", "src/index/run.ts"]);
    const { references } = await extractFile("src/index/run.ts", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Bm25Index.build", to: "src/index/bm25.ts" }],
    );
  });

  it("does not emit member-access edges for factory or namespace objects", async () => {
    const text = `import * as NS from "./ns.js";
export function run(): void {
  const h = openCanonIndex();
  h.score("q");
  const ns = new NS.Bm25Index();
  ns.build();
}`;
    const known = new Set(["src/ns.ts", "src/run.ts"]);
    const { references } = await extractFile("src/run.ts", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("emits only the resolvable leading link in chained member access", async () => {
    const text = `export class Chained {
  get(): Chained { return this; }
  run(): void {}
}
export function run(): void {
  const chained = new Chained();
  chained.get().run();
}`;
    const { references } = await extractFile("src/run.ts", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })).sort((a, b) => a.name.localeCompare(b.name)),
      [{ name: "Chained.get", to: "src/run.ts" }],
    );
  });
});
