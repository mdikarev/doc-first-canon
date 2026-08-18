// src/code-index/extractors/go.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import type { CodeReference, CodeSymbol, ExtractResult, SymbolKind, UnresolvedMember } from "../types.js";

export function grammarForFile(rel: string): "go" {
  return "go";
}

function firstLine(text: string): string {
  return text.split("\n")[0].trim();
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
}

function receiverTypeName(receiverNode: Node): string | null {
  const param = receiverNode.namedChildren.find(
    (c) => c.type === "parameter_declaration" || c.type === "variadic_parameter_declaration",
  );
  if (!param) return null;
  const typeNode = param.childForFieldName("type");
  if (!typeNode) return null;
  if (typeNode.type === "type_identifier") return typeNode.text;
  if (typeNode.type === "pointer_type") {
    const child = typeNode.namedChildren.find((c) => c.type === "type_identifier");
    if (child) return child.text;
  }
  if (typeNode.type === "generic_type") {
    const inner = typeNode.childForFieldName("type");
    if (inner?.type === "type_identifier") return inner.text;
  }
  return null;
}

function kindForTypeNode(typeNode: Node | null): SymbolKind {
  if (!typeNode) return "type";
  if (typeNode.type === "struct_type") return "struct";
  if (typeNode.type === "interface_type") return "interface";
  if (typeNode.type === "generic_type") {
    const inner = typeNode.childForFieldName("type");
    if (inner?.type === "struct_type") return "struct";
    if (inner?.type === "interface_type") return "interface";
  }
  return "type";
}

function structFieldNames(fieldNode: Node): string[] {
  const names: string[] = [];
  const visit = (n: Node): void => {
    if (n.type === "field_identifier") names.push(n.text);
    for (const c of n.namedChildren) visit(c);
  };
  visit(fieldNode);
  return names;
}

type DeclContext = {
  scope: string;
  symbols: CodeSymbol[];
  file: string;
};

function pushSymbol(
  ctx: DeclContext,
  name: string,
  kind: SymbolKind,
  node: Node,
  scope?: string,
): void {
  ctx.symbols.push({
    name,
    kind,
    signature: firstLine(node.text),
    file: ctx.file,
    line: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    scope: scope ?? ctx.scope,
  });
}

function collectTypeMembers(typeNode: Node, scope: string, ctx: DeclContext): void {
  const visit = (n: Node): void => {
    if (n.type === "field_declaration") {
      for (const fname of structFieldNames(n)) pushSymbol(ctx, fname, "property", n, scope);
      return;
    }
    if (n.type === "method_elem") {
      const name = nodeName(n);
      if (name) pushSymbol(ctx, name, "method", n, scope);
      return;
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(typeNode);
}

function walkSymbols(node: Node, ctx: DeclContext): void {
  switch (node.type) {
    case "package_clause": {
      const pkg = node.namedChildren.find((c) => c.type === "package_identifier");
      if (pkg) pushSymbol(ctx, pkg.text, "module", node);
      return;
    }
    case "function_declaration": {
      const name = nodeName(node);
      if (name) pushSymbol(ctx, name, "function", node);
      break;
    }
    case "method_declaration": {
      const name = nodeName(node);
      const receiver = node.childForFieldName("receiver");
      const scope = receiver ? receiverTypeName(receiver) ?? ctx.scope : ctx.scope;
      if (name) pushSymbol(ctx, name, "method", node, scope);
      break;
    }
    case "type_declaration": {
      for (const spec of node.namedChildren) {
        if (spec.type !== "type_spec" && spec.type !== "type_alias") continue;
        const name = nodeName(spec);
        if (!name) continue;
        const typeNode = spec.childForFieldName("type");
        pushSymbol(ctx, name, kindForTypeNode(typeNode), spec);
        if (typeNode) collectTypeMembers(typeNode, name, ctx);
      }
      return;
    }
    case "const_declaration":
    case "var_declaration": {
      const specType = node.type === "const_declaration" ? "const_spec" : "var_spec";
      for (const spec of node.namedChildren) {
        if (spec.type !== specType) continue;
        const name = nodeName(spec);
        if (name) pushSymbol(ctx, name, "const", spec);
      }
      return;
    }
  }
  for (const child of node.namedChildren) {
    walkSymbols(child, ctx);
  }
}

type WalkCtx = {
  file: string;
  knownFiles: Set<string>;
  symbols: CodeSymbol[];
  references: CodeReference[];
  declarationPositions: Set<string>;
};

function declKey(file: string, line: number, name: string): string {
  return `${file}:${line}:${name}`;
}

const NAME_NODE_TYPES = new Set([
  "function_declaration",
  "method_declaration",
  "type_spec",
  "type_alias",
  "const_spec",
  "var_spec",
  "parameter_declaration",
  "variadic_parameter_declaration",
  "field_declaration",
  "method_elem",
]);

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const visit = (n: Node): void => {
    if (n.type === "package_clause") {
      const pkg = n.namedChildren.find((c) => c.type === "package_identifier");
      if (pkg) positions.add(declKey(file, pkg.startPosition.row + 1, pkg.text));
    } else if (NAME_NODE_TYPES.has(n.type)) {
      const name = n.childForFieldName("name");
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    } else if (n.type === "short_var_declaration") {
      const left = n.childForFieldName("left");
      if (left) {
        for (const c of left.namedChildren) {
          if (c.type === "identifier") {
            positions.add(declKey(file, c.startPosition.row + 1, c.text));
          }
        }
      }
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function collectImportEdges(root: Node, ctx: WalkCtx): void {
  const visit = (node: Node): void => {
    if (node.type === "import_declaration") {
      for (const spec of node.namedChildren) {
        if (spec.type !== "import_spec") continue;
        const pathNode = spec.childForFieldName("path");
        if (!pathNode) continue;
        const source = pathNode.text.replace(/^`|^"|"$|`$/g, "");
        if (source.startsWith("./") || source.startsWith("../")) {
          const alias = spec.childForFieldName("name")?.text;
          const name = alias ?? source.slice(source.lastIndexOf("/") + 1);
          const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
          if (resolved) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: resolved,
              name,
              line: spec.startPosition.row + 1,
            });
          }
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

function resolveImportPath(
  fromFile: string,
  specifier: string,
  knownFiles: Set<string>,
): string | null {
  const dir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  const base = posixJoin(dir, specifier);
  const candidates = [base, `${base}.go`, `${base}/index.go`];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}

function posixJoin(a: string, b: string): string {
  const joined = `${a}/${b}`.split("/").filter((p) => p !== ".").join("/");
  const parts: string[] = [];
  for (const p of joined.split("/")) {
    if (p === "..") parts.pop();
    else if (p) parts.push(p);
  }
  return parts.join("/");
}

const REFERENCE_IDENTIFIERS = new Set([
  "identifier",
  "type_identifier",
  "field_identifier",
  "package_identifier",
]);

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "parameter_declaration" || node.type === "variadic_parameter_declaration") {
      const name = node.childForFieldName("name");
      if (name) names.add(name.text);
    }
    if (node.type === "short_var_declaration" || node.type === "range_clause") {
      const left = node.childForFieldName("left");
      if (left) {
        for (const c of left.namedChildren) {
          if (c.type === "identifier") names.add(c.text);
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return names;
}

type CompositeBinding = { typeName: string; packageName: string | null };

function compositeLiteralIn(expr: Node): Node | null {
  const inner = expr.type === "expression_list" ? expr.namedChildren[0] : expr;
  if (!inner) return null;
  if (inner.type === "composite_literal") return inner;
  if (inner.type === "unary_expression") {
    return inner.namedChildren.find((c) => c.type === "composite_literal") ?? null;
  }
  return null;
}

function literalTypeName(lit: Node): CompositeBinding | null {
  const typeNode = lit.childForFieldName("type");
  if (!typeNode) return null;
  if (typeNode.type === "type_identifier") {
    return { typeName: typeNode.text, packageName: null };
  }
  if (typeNode.type === "qualified_type") {
    const pkg = typeNode.namedChildren.find((c) => c.type === "package_identifier");
    const type = typeNode.namedChildren.find((c) => c.type === "type_identifier");
    if (pkg && type) return { typeName: type.text, packageName: pkg.text };
  }
  return null;
}

function collectCompositeLiteralBindings(root: Node): Map<string, CompositeBinding> {
  const bindings = new Map<string, CompositeBinding>();
  const visit = (node: Node): void => {
    if (node.type === "short_var_declaration") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      const name = left?.namedChildren.find((c) => c.type === "identifier");
      if (name && right) {
        const lit = compositeLiteralIn(right);
        const type = lit ? literalTypeName(lit) : null;
        if (name.text && type) bindings.set(name.text, type);
      }
    } else if (node.type === "var_spec") {
      const name = node.childForFieldName("name");
      const value = node.childForFieldName("value");
      if (name && value) {
        const lit = compositeLiteralIn(value);
        const type = lit ? literalTypeName(lit) : null;
        if (name.text && type) bindings.set(name.text, type);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}

function collectImportedPackages(root: Node, ctx: WalkCtx): Map<string, string> {
  const imported = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "import_declaration") {
      for (const spec of node.namedChildren) {
        if (spec.type !== "import_spec") continue;
        const pathNode = spec.childForFieldName("path");
        if (!pathNode) continue;
        const source = pathNode.text.replace(/^`|^"|"$|`$/g, "");
        if (source.startsWith("./") || source.startsWith("../")) {
          const alias = spec.childForFieldName("name")?.text;
          const name = alias ?? source.slice(source.lastIndexOf("/") + 1);
          const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
          if (resolved) imported.set(name, resolved);
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return imported;
}

function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  bindings: Map<string, CompositeBinding>,
  importedPackages: Map<string, string>,
  unresolved: UnresolvedMember[],
): void {
  const typeSymbolNames = new Set(
    ctx.symbols
      .filter((s) => s.kind === "struct" || s.kind === "interface" || s.kind === "type")
      .map((s) => s.name),
  );
  const visit = (node: Node): void => {
    if (node.type === "selector_expression") {
      const object = node.namedChildren.find((c) => c.type === "identifier");
      const field = node.childForFieldName("field");
      if (object && field?.type === "field_identifier") {
        const binding = bindings.get(object.text);
        if (binding) {
          const line = node.startPosition.row + 1;
          const member = field.text;
          if (binding.packageName !== null) {
            const to = importedPackages.get(binding.packageName);
            if (to !== undefined) {
              ctx.references.push({
                kind: "import",
                from: ctx.file,
                to,
                name: `${binding.typeName}.${member}`,
                line,
              });
            }
          } else if (typeSymbolNames.has(binding.typeName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${binding.typeName}.${member}`,
              line,
            });
          } else {
            unresolved.push({
              file: ctx.file,
              typeName: binding.typeName,
              memberName: member,
              line,
            });
          }
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

function collectAnchorAndBindingRefs(root: Node, ctx: WalkCtx): void {
  const symbolNames = new Set(ctx.symbols.map((s) => s.name));
  const bindingNames = collectBindingNames(root);
  const visit = (node: Node): void => {
    if (node.type === "import_declaration") return;
    if (REFERENCE_IDENTIFIERS.has(node.type)) {
      const name = node.text;
      const line = node.startPosition.row + 1;
      if (ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        // declaration name itself; skip
      } else if (bindingNames.has(name)) {
        ctx.references.push({ kind: "binding", from: ctx.file, to: ctx.file, name, line });
      } else if (symbolNames.has(name)) {
        ctx.references.push({ kind: "anchor", from: ctx.file, to: ctx.file, name, line });
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

export async function extractFile(
  rel: string,
  text: string,
  knownFiles: Set<string>,
): Promise<ExtractResult> {
  const language = await loadGrammar("go");
  const parser = createParser(language);
  const tree = parser.parse(text);
  if (tree === null) {
    return { symbols: [], references: [] };
  }
  try {
    const ctx: DeclContext = {
      scope: "",
      symbols: [],
      file: rel,
    };
    walkSymbols(tree.rootNode, ctx);
    ctx.symbols.sort(
      (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.name.localeCompare(b.name),
    );
    const ctxRefs: WalkCtx = {
      file: rel,
      knownFiles,
      symbols: ctx.symbols,
      references: [],
      declarationPositions: collectDeclarationPositions(tree.rootNode, rel),
    };
    collectImportEdges(tree.rootNode, ctxRefs);
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    const bindings = collectCompositeLiteralBindings(tree.rootNode);
    const importedPackages = collectImportedPackages(tree.rootNode, ctxRefs);
    const unresolvedMembers: UnresolvedMember[] = [];
    collectMemberAccessEdges(tree.rootNode, ctxRefs, bindings, importedPackages, unresolvedMembers);
    ctxRefs.references.sort(
      (a, b) =>
        a.from.localeCompare(b.from) ||
        a.line - b.line ||
        a.name.localeCompare(b.name) ||
        a.kind.localeCompare(b.kind) ||
        a.to.localeCompare(b.to),
    );
    return { symbols: ctx.symbols, references: ctxRefs.references, unresolvedMembers };
  } finally {
    tree.delete();
  }
}
