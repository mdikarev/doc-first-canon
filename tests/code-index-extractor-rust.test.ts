// tests/code-index-extractor-rust.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/rust.js";

describe("grammarForFile (rust)", () => {
  it("maps .rs to the rust grammar", () => {
    assert.equal(grammarForFile("main.rs"), "rust");
    assert.equal(grammarForFile("a/b/main.rs"), "rust");
  });
});

const SRC = `mod utils;

pub struct Reader {
    score: u32,
}

pub trait Scoreable {
    fn score(&self) -> u32;
}

impl Scoreable for Reader {
    fn score(&self) -> u32 {
        self.score
    }
}

impl Reader {
    pub fn new() -> Reader {
        Reader { score: 0 }
    }
}

pub enum Kind {
    A,
    B,
}

const DEFAULT: u32 = 1;
static LIMIT: u32 = 2;

pub fn open() -> Reader {
    Reader::new()
}

type Alias = Reader;
`;

describe("extractFile (rust) symbols", () => {
  it("maps mod, struct, trait, enum, type, const, static, function, methods in impl/trait, struct field", async () => {
    const { symbols } = await extractFile("src/lib.rs", SRC, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.utils.kind, "module");
    assert.equal(byName.Reader.kind, "struct");
    assert.equal(byName.Scoreable.kind, "trait");
    assert.equal(byName.Kind.kind, "enum");
    assert.equal(byName.Alias.kind, "type");
    assert.equal(byName.DEFAULT.kind, "const");
    assert.equal(byName.LIMIT.kind, "const");
    assert.equal(byName.open.kind, "function");
    assert.equal(byName.new.kind, "method");
    assert.equal(byName.new.scope, "Reader");
    assert.ok(byName.open.signature.includes("pub fn open()"));
    assert.equal(
      symbols.filter((s) => s.name === "score" && s.kind === "property" && s.scope === "Reader")
        .length,
      1,
    );
    assert.equal(
      symbols.filter((s) => s.name === "score" && s.kind === "method" && s.scope === "Reader")
        .length,
      1,
    );
    assert.equal(
      symbols.filter((s) => s.name === "score" && s.kind === "method" && s.scope === "Scoreable")
        .length,
      1,
    );
  });

  it("maps inline mod contents under the mod scope", async () => {
    const { symbols } = await extractFile(
      "src/lib.rs",
      `mod utils {
    pub fn helper() {}
}
`,
      new Set(),
    );
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.utils.kind, "module");
    assert.equal(byName.helper.kind, "function");
    assert.equal(byName.helper.scope, "utils");
  });
});

describe("extractFile (rust) references", () => {
  it("emits self::/super:: module import edges and skips external crates", async () => {
    const text = `mod common;

use self::common::helper;
use std::fmt;

fn main() {}
`;
    const { references } = await extractFile("src/main.rs", text, new Set(["src/common.rs"]));
    const imports = references.filter((r) => r.kind === "import");
    assert.equal(imports.length, 1);
    assert.equal(imports[0].to, "src/common.rs");
    assert.equal(imports[0].name, "helper");
  });

  it("emits anchors for declared functions and bindings for params and let locals", async () => {
    const text = `fn helper(n: u32) -> u32 {
    n
}

fn main() {
    let x = helper(1);
    println!("{}", x);
}
`;
    const { references } = await extractFile("src/main.rs", text, new Set());
    assert.ok(references.some((r) => r.kind === "anchor" && r.name === "helper"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "x"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "n"));
  });
});

describe("extractFile (rust) member-access references", () => {
  const SAME_FILE = `pub struct Reader {}

impl Reader {
    pub fn new() -> Reader {
        Reader {}
    }
    pub fn score(&self) -> u32 {
        1
    }
}

fn main() {
    let r = Reader::new();
    r.score();
    let f = r.score;
    let _ = f;
}`;

  it("emits same-file edges for let bindings initialized from Type::new()", async () => {
    const { references } = await extractFile("src/main.rs", SAME_FILE, new Set());
    const members = references
      .filter((r) => r.kind === "import" && r.name.includes("."))
      .sort((a, b) => a.line - b.line);
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [
        { name: "Reader.score", to: "src/main.rs" },
        { name: "Reader.score", to: "src/main.rs" },
      ],
    );
  });

  it("emits same-file edges for Type::default() and const bindings", async () => {
    const text = `pub struct Reader {}

impl Reader {
    pub fn new() -> Reader {
        Reader {}
    }
}

const LIMIT: Reader = Reader::default();

fn main() {
    let c = Reader::default();
    LIMIT.score();
    c.score();
}`;
    const { references } = await extractFile("src/main.rs", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [
        { name: "Reader.score", to: "src/main.rs" },
        { name: "Reader.score", to: "src/main.rs" },
      ],
    );
  });

  it("resolves imported names through the import edge map (self::)", async () => {
    const text = `mod common;

use self::common::Reader;

fn main() {
    let r = Reader::new();
    r.score();
}`;
    const known = new Set(["src/main.rs", "src/common.rs"]);
    const { references } = await extractFile("src/main.rs", text, known);
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.deepEqual(
      members.map((r) => ({ name: r.name, to: r.to })),
      [{ name: "Reader.score", to: "src/common.rs" }],
    );
  });

  it("emits no edge for non-new/default associated functions, generics, or external callees", async () => {
    const text = `pub struct Reader {}

impl Reader {
    pub fn open() -> Reader {
        Reader {}
    }
}

fn main() {
    let q = Reader::open();
    q.score();
    let t = std::vec::Vec::new();
    t.push(1);
    let w = 5;
    w.checked_add(1);
}`;
    const { references } = await extractFile("src/main.rs", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });

  it("emits no binding for tuple-pattern lets", async () => {
    const text = `pub struct Reader {}

impl Reader {
    pub fn new() -> Reader {
        Reader {}
    }
}

fn main() {
    let (a, b) = (Reader::new(), Reader::default());
    a.score();
    b.score();
}`;
    const { references } = await extractFile("src/main.rs", text, new Set());
    const members = references.filter((r) => r.kind === "import" && r.name.includes("."));
    assert.equal(members.length, 0);
  });
});
