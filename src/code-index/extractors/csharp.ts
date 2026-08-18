// src/code-index/extractors/csharp.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import type { CodeReference, CodeSymbol, ExtractResult, SymbolKind, UnresolvedMember } from "../types.js";

export function grammarForFile(rel: string): "c-sharp" {
  return "c-sharp";
}

function firstLine(text: string): string {
  return text.split("\n")[0].trim();
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
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

const MEMBER_DECLARATIONS = new Map<string, SymbolKind>([
  ["class_declaration", "class"],
  ["record_declaration", "class"],
  ["interface_declaration", "interface"],
  ["struct_declaration", "struct"],
]);

function walkSymbols(node: Node, ctx: DeclContext): void {
  switch (node.type) {
    case "namespace_declaration":
    case "file_scoped_namespace_declaration": {
      const name = nodeName(node);
      if (name) {
        const fullName = ctx.scope ? `${ctx.scope}.${name}` : name;
        pushSymbol(ctx, fullName, "module", node);
        const childCtx: DeclContext = {
          scope: fullName,
          symbols: ctx.symbols,
          file: ctx.file,
        };
        for (const child of node.namedChildren) walkSymbols(child, childCtx);
      }
      return;
    }
    case "enum_declaration": {
      const name = nodeName(node);
      if (name) pushSymbol(ctx, name, "enum", node);
      return;
    }
    case "method_declaration": {
      const name = nodeName(node);
      if (name) pushSymbol(ctx, name, "method", node);
      return;
    }
    case "property_declaration": {
      const name = nodeName(node);
      if (name) pushSymbol(ctx, name, "property", node);
      return;
    }
    case "field_declaration": {
      const isConst = node.namedChildren.some(
        (c) => c.type === "modifier" && c.text === "const",
      );
      const kind: SymbolKind = isConst ? "const" : "property";
      const visit = (n: Node): void => {
        if (n.type === "variable_declarator") {
          const name = n.childForFieldName("name");
          if (name) pushSymbol(ctx, name.text, kind, n);
        }
        for (const c of n.namedChildren) visit(c);
      };
      visit(node);
      return;
    }
  }

  const memberKind = MEMBER_DECLARATIONS.get(node.type);
  if (memberKind) {
    const name = nodeName(node);
    if (name) {
      pushSymbol(ctx, name, memberKind, node);
      for (const child of node.namedChildren) {
        walkSymbols(child, { ...ctx, scope: name });
      }
    }
    return;
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

const DECLARATION_NAME_NODES = new Set([
  "class_declaration",
  "record_declaration",
  "interface_declaration",
  "struct_declaration",
  "enum_declaration",
  "method_declaration",
  "property_declaration",
]);

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const visit = (n: Node): void => {
    if (n.type === "namespace_declaration" || n.type === "file_scoped_namespace_declaration") {
      const name = n.childForFieldName("name");
      if (name) {
        const visitIds = (x: Node): void => {
          if (x.type === "identifier") {
            positions.add(declKey(file, x.startPosition.row + 1, x.text));
          }
          for (const c of x.namedChildren) visitIds(c);
        };
        visitIds(name);
      }
    } else if (DECLARATION_NAME_NODES.has(n.type)) {
      const name = n.childForFieldName("name");
      if (name?.type === "identifier") {
        positions.add(declKey(file, name.startPosition.row + 1, name.text));
      }
    } else if (n.type === "variable_declarator" || n.type === "parameter") {
      const name = n.childForFieldName("name");
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "parameter") {
      const name = node.childForFieldName("name");
      if (name) names.add(name.text);
    }
    if (node.type === "local_declaration_statement") {
      const decl = node.namedChildren.find((c) => c.type === "variable_declaration");
      if (decl) {
        for (const c of decl.namedChildren) {
          if (c.type === "variable_declarator") {
            const name = c.childForFieldName("name");
            if (name) names.add(name.text);
          }
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return names;
}

function collectConstructorBindings(root: Node): Map<string, string> {
  const bindings = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "variable_declarator") {
      const name = node.childForFieldName("name");
      const ctor = node.namedChildren.find((c) => c.type === "object_creation_expression");
      if (name && ctor) {
        const type = ctor.childForFieldName("type");
        if (type?.type === "identifier") bindings.set(name.text, type.text);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}

const MEMBER_ACCESS_KIND_NAMES = new Set([
  "class",
  "interface",
  "struct",
]);

function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  constructorBindings: Map<string, string>,
  unresolved: UnresolvedMember[],
): void {
  const typeSymbolNames = new Set(
    ctx.symbols
      .filter((s) => MEMBER_ACCESS_KIND_NAMES.has(s.kind))
      .map((s) => s.name),
  );
  const visit = (node: Node): void => {
    if (node.type === "member_access_expression") {
      const object = node.childForFieldName("expression");
      const member = node.childForFieldName("name");
      if (object?.type === "identifier" && member?.type === "identifier") {
        const binding = object.text;
        const typeName = constructorBindings.get(binding);
        if (typeName !== undefined) {
          const line = node.startPosition.row + 1;
          if (typeSymbolNames.has(typeName)) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: ctx.file,
              name: `${typeName}.${member.text}`,
              line,
            });
          } else {
            unresolved.push({
              file: ctx.file,
              typeName,
              memberName: member.text,
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
    if (node.type === "identifier") {
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
  const language = await loadGrammar("c-sharp");
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
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    const constructorBindings = collectConstructorBindings(tree.rootNode);
    const unresolvedMembers: UnresolvedMember[] = [];
    collectMemberAccessEdges(tree.rootNode, ctxRefs, constructorBindings, unresolvedMembers);
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
