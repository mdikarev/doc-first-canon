// tests/code-index-same-package.test.ts
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CodeSymbol } from "../src/code-index/types.js";
import { resolveGoSamePackageReferences } from "../src/code-index/sync.js";

function moduleSym(file: string, pkg: string): CodeSymbol {
  return { name: pkg, kind: "module", signature: `package ${pkg}`, file, line: 1, endLine: 1, scope: "" };
}

function typeSym(file: string, name: string): CodeSymbol {
  return { name, kind: "struct", signature: `type ${name} struct {}`, file, line: 2, endLine: 2, scope: "" };
}

describe("resolveGoSamePackageReferences", () => {
  it("resolves a same-package type declared in a sibling file", () => {
    const symbols = [moduleSym("main.go", "app"), moduleSym("handle.go", "app"), typeSym("handle.go", "Handle")];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), [
      { kind: "import", from: "main.go", to: "handle.go", name: "Handle.Score", line: 4 },
    ]);
  });

  it("drops a candidate with no same-package type", () => {
    const symbols = [moduleSym("main.go", "app")];
    const unresolved = [{ file: "main.go", typeName: "Missing", memberName: "M", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("drops when two same-named types exist in the package", () => {
    const symbols = [
      moduleSym("main.go", "app"),
      moduleSym("a.go", "app"),
      moduleSym("b.go", "app"),
      typeSym("a.go", "Handle"),
      typeSym("b.go", "Handle"),
    ];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("does not resolve across different package clauses", () => {
    const symbols = [
      moduleSym("main.go", "app"),
      moduleSym("other_test.go", "app_test"),
      typeSym("other_test.go", "Handle"),
    ];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });

  it("returns [] for an empty unresolved list", () => {
    assert.deepEqual(resolveGoSamePackageReferences([], []), []);
  });

  it("excludes a candidate symbol in the same file as the unresolved entry", () => {
    const symbols = [
      moduleSym("main.go", "app"),
      moduleSym("handle.go", "app"),
      typeSym("main.go", "Handle"),
      typeSym("handle.go", "Handle"),
    ];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), [
      { kind: "import", from: "main.go", to: "handle.go", name: "Handle.Score", line: 4 },
    ]);
  });

  it("drops when the only candidate is in the same file as the unresolved entry", () => {
    const symbols = [moduleSym("main.go", "app"), typeSym("main.go", "Handle")];
    const unresolved = [{ file: "main.go", typeName: "Handle", memberName: "Score", line: 4 }];
    assert.deepEqual(resolveGoSamePackageReferences(unresolved, symbols), []);
  });
});
