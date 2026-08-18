// tests/code-index-extractor-csharp.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFile, grammarForFile } from "../src/code-index/extractors/csharp.js";

describe("grammarForFile (csharp)", () => {
  it("maps .cs to the c-sharp grammar", () => {
    assert.equal(grammarForFile("Program.cs"), "c-sharp");
    assert.equal(grammarForFile("a/b/Program.cs"), "c-sharp");
  });
});

const SRC = `namespace MyApp.Models
{
    public interface IReader
    {
        int Score(string q);
    }

    public class Reader : IReader
    {
        public const int Default = 1;
        private int _score;

        public int Score { get; set; }

        public int Get(string q)
        {
            return _score;
        }
    }

    public enum Kind { A, B }

    public struct Point { public int X; }
}
`;

describe("extractFile (csharp) symbols", () => {
  it("maps namespace, interface, class, enum, struct, method, property, const field", async () => {
    const { symbols } = await extractFile("src/App/Models.cs", SRC, new Set());
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    const byScopeName = Object.fromEntries(
      symbols.map((s) => [`${s.scope}/${s.name}`, s]),
    );
    assert.equal(byName["MyApp.Models"].kind, "module");
    assert.equal(byScopeName["MyApp.Models/IReader"].kind, "interface");
    assert.equal(byScopeName["IReader/Score"].kind, "method");
    assert.equal(byScopeName["MyApp.Models/Reader"].kind, "class");
    assert.equal(byScopeName["Reader/Default"].kind, "const");
    assert.equal(byScopeName["Reader/_score"].kind, "property");
    assert.equal(byScopeName["Reader/Score"].kind, "property");
    assert.equal(byScopeName["Reader/Get"].kind, "method");
    assert.equal(byScopeName["MyApp.Models/Kind"].kind, "enum");
    assert.equal(byScopeName["MyApp.Models/Point"].kind, "struct");
    assert.equal(byScopeName["Point/X"].kind, "property");
    assert.ok(byName["MyApp.Models"].line > 0);
    assert.ok(
      byScopeName["Reader/Get"].signature.includes("public int Get(string q)"),
    );
  });

  it("maps file-scoped namespace and record to module and class", async () => {
    const { symbols } = await extractFile(
      "src/App/Point.cs",
      `namespace App;

public record Point(int X, int Y);
`,
      new Set(),
    );
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.App.kind, "module");
    assert.equal(byName.Point.kind, "class");
  });

  it("maps nested namespaces to dotted module names", async () => {
    const { symbols } = await extractFile(
      "src/App/Nested.cs",
      `namespace Outer
{
    namespace Inner
    {
        public class Widget { }
    }
}
`,
      new Set(),
    );
    const byName = Object.fromEntries(symbols.map((s) => [s.name, s]));
    assert.equal(byName.Outer.kind, "module");
    assert.equal(byName["Outer.Inner"].kind, "module");
    assert.equal(byName.Widget.kind, "class");
    assert.equal(byName.Widget.scope, "Outer.Inner");
  });
});

describe("extractFile (csharp) references", () => {
  it("emits anchors for declared types and bindings for params and locals", async () => {
    const text = `using System;

namespace App
{
    public class Widget
    {
        public int Score { get; set; }

        public int Add(int a, int b)
        {
            int sum = a + b;
            return sum + this.Score;
        }
    }

    public class App
    {
        public Widget Make()
        {
            return new Widget();
        }
    }
}
`;
    const { symbols, references } = await extractFile("src/App/App.cs", text, new Set());
    assert.equal(references.filter((r) => r.kind === "import").length, 0);
    assert.ok(references.some((r) => r.kind === "anchor" && r.name === "Widget"));
    assert.ok(references.some((r) => r.kind === "anchor" && r.name === "Score"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "sum"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "a"));
    assert.ok(references.some((r) => r.kind === "binding" && r.name === "b"));
    assert.ok(symbols.some((s) => s.name === "App" && s.kind === "class"));
  });
});
