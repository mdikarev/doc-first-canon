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
