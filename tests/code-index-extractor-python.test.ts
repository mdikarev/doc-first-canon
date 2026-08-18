// tests/code-index-extractor-python.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/python.js";

describe("grammarForFile (python)", () => {
  it("maps .py to the python grammar", () => {
    assert.equal(grammarForFile("main.py"), "python");
    assert.equal(grammarForFile("a/b/main.py"), "python");
  });
});

const SRC = `import os
from . import sibling
from .sibling import Thing

DEFAULT_SCORE = 1
INTERNAL = "x"

class Reader:
    def __init__(self, score):
        self._score = score

    def score(self):
        return self._score

def open_reader():
    return Reader(DEFAULT_SCORE)

def _private_helper(n):
    return n + 1
`;

describe("extractFile (python) symbols", () => {
  it("maps module, class, method, function, and module-level consts", async () => {
    const { symbols } = await extractFile("reader/reader.py", SRC, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.reader.kind, "module");
    assert.equal(byName.DEFAULT_SCORE.kind, "const");
    assert.equal(byName.INTERNAL.kind, "const");
    assert.equal(byName.Reader.kind, "class");
    assert.equal(byName.__init__.kind, "method");
    assert.equal(byName.__init__.scope, "Reader");
    assert.equal(byName.score.kind, "method");
    assert.equal(byName.score.scope, "Reader");
    assert.equal(byName.open_reader.kind, "function");
    assert.equal(byName._private_helper.kind, "function");
    assert.ok(byName.open_reader.signature.includes("def open_reader()"));
  });
});

describe("extractFile (python) references", () => {
  it("emits relative import edges for dot-relative imports only", async () => {
    const text = `from . import sibling
from .sibling import Thing
from ..util import helper
import os
`;
    const { references } = await extractFile(
      "src/package/main.py",
      text,
      new Set(["src/package/sibling.py", "src/util.py"]),
    );
    const imports = references.filter((r) => r.kind === "import");
    assert.equal(imports.length, 3);
    assert.ok(
      imports.some((r) => r.to === "src/package/sibling.py" && r.name === "sibling"),
    );
    assert.ok(
      imports.some((r) => r.to === "src/package/sibling.py" && r.name === "Thing"),
    );
    assert.ok(imports.some((r) => r.to === "src/util.py" && r.name === "helper"));
  });

  it("emits anchors for functions and consts, bindings for params and locals", async () => {
    const text = `DEFAULT = 1

def helper(n):
    total = n + 1
    return total + DEFAULT

result = helper(2)
`;
    const { references } = await extractFile("main.py", text, new Set());
    assert.ok(references.some((r) => r.kind === "anchor" && r.name === "helper"));
    assert.ok(references.some((r) => r.kind === "anchor" && r.name === "DEFAULT"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "n"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "total"));
    assert.ok(!references.some((r) => r.name === "result"));
  });
});

describe("extractFile (python) member-access references", () => {
  it("emits same-file edges for class-backed bare-call bindings (incl. lowercase classes)", async () => {
    const text = `class Reader:
    def score(self):
        return 1

class widget:
    def paint(self):
        pass

def run():
    r = Reader()
    r.score()
    w = widget()
    w.paint()
    return r
`;
    const { references } = await extractFile("main.py", text, new Set());
    const members = references
      .filter((r) => r.kind === "import" && r.name.includes("."))
      .sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [
        { name: "Reader.score", to: "main.py" },
        { name: "widget.paint", to: "main.py" },
      ],
    );
  });

  it("emits no edge when the callee is a same-file function, not a class", async () => {
    const text = `def open():
    return 1

def run():
    z = open()
    return z
`;
    const { references } = await extractFile("main.py", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("resolves PascalCase imported names through the import edge map", async () => {
    const text = `from .common import Reader

def run():
    r = Reader()
    r.score()
    return r
`;
    const known = new Set(["src/package/main.py", "src/package/common.py"]);
    const { references } = await extractFile("src/package/main.py", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Reader.score", to: "src/package/common.py" }],
    );
  });

  it("canonicalizes as-aliased imported names in the edge name", async () => {
    const text = `from .common import Reader as R

def run():
    r = R()
    r.score()
    return r
`;
    const known = new Set(["src/package/main.py", "src/package/common.py"]);
    const { references } = await extractFile("src/package/main.py", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Reader.score", to: "src/package/common.py" }],
    );
  });

  it("emits no edge for lowercase imported names, attribute callees, or external imports", async () => {
    const text = `from .common import thing
from .common import Widget
import requests

def run():
    x = thing()
    x.method()
    y = Widget.make()
    y.run()
    z = requests.get("https://x")
    z.json()
    return (x, y, z)
`;
    const known = new Set(["src/package/main.py", "src/package/common.py"]);
    const { references } = await extractFile("src/package/main.py", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("emits property-read edges for attributes on constructor-backed bindings", async () => {
    const text = `class Reader:
    score = 1

def run():
    r = Reader()
    return r.score
`;
    const { references } = await extractFile("main.py", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Reader.score", to: "main.py" }],
    );
  });

  it("emits an edge for a PascalCase imported name even if it is really a function (documented heuristic)", async () => {
    const text = `from .common import Factory

def run():
    f = Factory()
    f.build()
    return f
`;
    const known = new Set(["src/package/main.py", "src/package/common.py"]);
    const { references } = await extractFile("src/package/main.py", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Factory.build", to: "src/package/common.py" }],
    );
  });
});
