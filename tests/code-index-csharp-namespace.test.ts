// tests/code-index-csharp-namespace.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeSymbol } from "../src/code-index/types.js";
import { resolveCSharpNamespaceReferences } from "../src/code-index/resolvers/csharp.js";

function moduleSym(file: string, ns: string): CodeSymbol {
  return { name: ns, kind: "module", signature: `namespace ${ns}`, file, line: 1, endLine: 1, scope: "" };
}

function typeSym(file: string, name: string, ns: string, kind: "class" | "interface" | "struct" = "class"): CodeSymbol {
  return { name, kind, signature: `${kind} ${name}`, file, line: 2, endLine: 2, scope: ns };
}

describe("resolveCSharpNamespaceReferences", () => {
  it("resolves a same-namespace type declared in a sibling file", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Widget.cs", "App"),
      typeSym("src/App/Widget.cs", "Widget", "App"),
    ];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 8 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Widget.cs", name: "Widget.Score", line: 8 },
    ]);
  });

  it("resolves interface and struct kinds too", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/IReader.cs", "App"),
      moduleSym("src/App/Point.cs", "App"),
      typeSym("src/App/IReader.cs", "IReader", "App", "interface"),
      typeSym("src/App/Point.cs", "Point", "App", "struct"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "IReader", memberName: "Score", line: 2 },
      { file: "src/App/Program.cs", typeName: "Point", memberName: "X", line: 3 },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/IReader.cs", name: "IReader.Score", line: 2 },
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Point.cs", name: "Point.X", line: 3 },
    ]);
  });

  it("drops a candidate with no same-namespace type", () => {
    const symbols = [moduleSym("src/App/Program.cs", "App")];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Missing", memberName: "M", line: 4 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });

  it("drops when two same-named types exist in the namespace", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/A.cs", "App"),
      moduleSym("src/App/B.cs", "App"),
      typeSym("src/App/A.cs", "Widget", "App"),
      typeSym("src/App/B.cs", "Widget", "App"),
    ];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });

  it("does not resolve across different namespaces", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/Other/Widget.cs", "Other"),
      typeSym("src/Other/Widget.cs", "Widget", "Other"),
    ];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });

  it("returns [] for an empty unresolved list", () => {
    assert.deepEqual(resolveCSharpNamespaceReferences([], []), []);
  });

  it("excludes a candidate symbol in the same file as the unresolved entry", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Widget.cs", "App"),
      typeSym("src/App/Program.cs", "Widget", "App"),
      typeSym("src/App/Widget.cs", "Widget", "App"),
    ];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Widget.cs", name: "Widget.Score", line: 4 },
    ]);
  });

  it("drops when the only candidate is in the same file as the unresolved entry", () => {
    const symbols = [moduleSym("src/App/Program.cs", "App"), typeSym("src/App/Program.cs", "Widget", "App")];
    const unresolved = [{ file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });
});

describe("resolveCSharpNamespaceReferences (imported types)", () => {
  it("resolves using-imported types via the namespaces search-set", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("resolves namespace-qualified types against a single qualified namespace", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Models/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("does not prefer own-namespace candidates outside the qualified search-set", () => {
    const symbols = [
      moduleSym("src/App/Models/Program.cs", "App.Models"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      moduleSym("src/App/Other/Widget.cs", "App.Other"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
      typeSym("src/App/Other/Widget.cs", "Widget", "App.Other"),
    ];
    const unresolved = [
      { file: "src/App/Models/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App.Other"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Models/Program.cs", to: "src/App/Other/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("prefers the own-namespace candidate when it is unique in the search-set", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Widget.cs", "App"),
      moduleSym("src/App/Models/Widget.cs", "App.Models"),
      typeSym("src/App/Widget.cs", "Widget", "App"),
      typeSym("src/App/Models/Widget.cs", "Widget", "App.Models"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Models"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("resolves nested namespaces via all module symbols of a file", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Inner/Widget.cs", "App"),
      moduleSym("src/App/Inner/Widget.cs", "App.Inner"),
      typeSym("src/App/Inner/Widget.cs", "Widget", "App.Inner"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.Inner"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Inner/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });

  it("drops when the full search-set has multiple distinct candidate files", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/A/Widget.cs", "App.A"),
      moduleSym("src/App/B/Widget.cs", "App.B"),
      typeSym("src/App/A/Widget.cs", "Widget", "App.A"),
      typeSym("src/App/B/Widget.cs", "Widget", "App.B"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: ["App", "App.A", "App.B"] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), []);
  });

  it("falls back to own namespace for an empty namespaces array", () => {
    const symbols = [
      moduleSym("src/App/Program.cs", "App"),
      moduleSym("src/App/Widget.cs", "App"),
      typeSym("src/App/Widget.cs", "Widget", "App"),
    ];
    const unresolved = [
      { file: "src/App/Program.cs", typeName: "Widget", memberName: "Score", line: 9, namespaces: [] },
    ];
    assert.deepEqual(resolveCSharpNamespaceReferences(unresolved, symbols), [
      { kind: "import", from: "src/App/Program.cs", to: "src/App/Widget.cs", name: "Widget.Score", line: 9 },
    ]);
  });
});
