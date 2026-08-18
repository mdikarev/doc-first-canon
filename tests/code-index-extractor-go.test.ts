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
    assert.equal(imports.length, 2);
    assert.ok(imports.some((r) => r.to === "reader.go" && r.name === "reader"));
    assert.ok(imports.some((r) => r.to === "reader.go" && r.name === "Handle.Score"));
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

describe("extractFile (go) member-access references", () => {
  it("emits same-file edges for := &T{}, := T{}, and var x = T{} bindings", async () => {
    const text = `package main

type Handle struct {
	Field int
}

func main() {
	x := &Handle{}
	y := Handle{}
	var v = Handle{}
	x.Score("q")
	_ = y
	_ = v
	_ = x
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references
      .filter((r) => r.kind === "import" && r.name.includes("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Score", to: "main.go" }],
    );
  });

  it("emits property-read edges for struct fields", async () => {
    const text = `package main

type Handle struct {
	Field int
}

func main() {
	x := &Handle{}
	_ = x.Field
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Field", to: "main.go" }],
    );
  });

  it("resolves qualified imported types through the import edge map", async () => {
    const text = `package main

import "./reader"

func main() {
	h := &reader.Handle{}
	h.Score("q")
}`;
    const known = new Set(["main.go", "reader.go"]);
    const { references } = await extractFile("main.go", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Handle.Score", to: "reader.go" }],
    );
  });

  it("emits no edge for factory calls, slice/map literals, or uninitialized var", async () => {
    const text = `package main

func NewT() *Handle { return nil }

func main() {
	x := NewT()
	y := []Handle{}
	z := map[string]Handle{}
	var w Handle
	x.Score("q")
	_ = y
	_ = z
	_ = w
}`;
    const { references } = await extractFile("main.go", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("surfaces same-package candidates in unresolvedMembers", async () => {
    const text = `package main

func main() {
	x := &Handle{}
	x.Score("q")
}`;
    const { unresolvedMembers } = await extractFile("main.go", text, new Set());
    assert.deepEqual(unresolvedMembers, [
      { file: "main.go", typeName: "Handle", memberName: "Score", line: 5 },
    ]);
  });
});
