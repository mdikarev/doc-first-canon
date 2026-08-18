// tests/code-index-extractor-go.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/go.js";

describe("grammarForFile (go)", () => {
  it("maps .go to the go grammar", () => {
    assert.equal(grammarForFile("main.go"), "go");
    assert.equal(grammarForFile("a/b/main.go"), "go");
  });
});

const SRC = `package reader

type Handle struct {
	Score int
}

type Reader interface {
	Score(q string) int
}

type Alias = Reader

func open() *Handle {
	return &Handle{}
}

func (h *Handle) Get(q string) int {
	const n = 1
	return n
}

const Default = "x"

var Max = 10
`;

describe("extractFile (go) symbols", () => {
  it("maps package, struct, interface, type alias, function, method, const, var, struct field", async () => {
    const { symbols } = await extractFile("reader/reader.go", SRC, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    const byScopeName = Object.fromEntries(
      symbols.map((s) => [`${s.scope}/${s.name}`, s]),
    );
    assert.equal(byName.reader.kind, "module");
    assert.equal(byName.Handle.kind, "struct");
    assert.equal(byName.Reader.kind, "interface");
    assert.equal(byName.Alias.kind, "type");
    assert.equal(byName.open.kind, "function");
    assert.equal(byName.Get.kind, "method");
    assert.equal(byScopeName["Handle/Get"].scope, "Handle");
    assert.equal(byName.Default.kind, "const");
    assert.equal(byName.Max.kind, "const");
    assert.equal(byScopeName["Handle/Score"].kind, "property");
    assert.equal(byScopeName["Reader/Score"].kind, "method");
    assert.equal(byScopeName["Reader/Score"].scope, "Reader");
    assert.ok(byName.open.line > 0 && byName.open.endLine >= byName.open.line);
    assert.ok(byName.open.signature.includes("func open()"));
  });
});

describe("extractFile (go) references", () => {
  it("emits relative import edges and binding refs for local vars", async () => {
    const text = `package main

import "./reader"

func main() {
	h := &reader.Handle{}
	h.Score = 1
	_ = h
}`;
    const { references } = await extractFile("main.go", text, new Set(["reader.go"]));
    const imports = references.filter((r) => r.kind === "import");
    assert.equal(imports.length, 1);
    assert.equal(imports[0].to, "reader.go");
    assert.equal(imports[0].name, "reader");
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "h"));
  });

  it("skips non-relative imports (no edge emitted)", async () => {
    const text = `package main

import "fmt"

func main() { fmt.Println("hi") }`;
    const { references } = await extractFile("main.go", text, new Set(["fmt"]));
    assert.equal(references.filter((r) => r.kind === "import").length, 0);
  });
});
