// src/code-index/extractors/typescript.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import { VCS_INDEXABLE_EXTENSIONS } from "../grammar-versions.js";
import type {
  CodeReference,
  CodeSymbol,
  ReferenceKind,
  SymbolKind,
} from "../types.js";

export function grammarForFile(rel: string): "typescript" | "tsx" | "javascript" {
  if (rel.endsWith(".tsx")) return "tsx";
  if (rel.endsWith(".ts")) return "typescript";
  return "javascript";
}

const SYMBOL_NODE_KINDS: Record<string, SymbolKind> = {
  class_declaration: "class",
  interface_declaration: "interface",
  enum_declaration: "enum",
  function_declaration: "function",
  method_definition: "method",
  method_signature: "method",
  property_signature: "property",
  public_field_definition: "property",
  type_alias_declaration: "type",
  internal_module: "module",
};

const DECLARATION_TYPES = new Set(Object.keys(SYMBOL_NODE_KINDS));

function firstLine(text: string): string {
  const line = text.split("\n")[0].trim();
  return line;
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
}

type DeclContext = {
  scope: string;
  symbols: CodeSymbol[];
  references: CodeReference[];
  declarationNames: Set<string>;
  file: string;
};

function walkSymbols(
  node: Node,
  ctx: DeclContext,
  knownFiles: Set<string>,
): void {
  const kind = SYMBOL_NODE_KINDS[node.type];

  if (DECLARATION_TYPES.has(node.type)) {
    const name = nodeName(node);
    if (name) {
      const symbol: CodeSymbol = {
        name,
        kind: kind!,
        signature: firstLine(node.text),
        file: ctx.file,
        line: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        scope: ctx.scope,
      };
      ctx.symbols.push(symbol);
      ctx.declarationNames.add(name);
      const childScope = kind === "class" || kind === "interface" ? name : ctx.scope;
      for (const child of node.namedChildren) {
        walkSymbols(child, { ...ctx, scope: childScope }, knownFiles);
      }
      return;
    }
  }

  if (node.type === "lexical_declaration") {
    const kind = node.text.trim().startsWith("const") ? "const" : null;
    if (kind) {
      for (const child of node.namedChildren) {
        if (child.type === "variable_declarator") {
          const name = nodeName(child);
          if (name) {
            ctx.symbols.push({
              name,
              kind,
              signature: firstLine(child.text),
              file: ctx.file,
              line: child.startPosition.row + 1,
              endLine: child.endPosition.row + 1,
              scope: ctx.scope,
            });
            ctx.declarationNames.add(name);
          }
        }
      }
    }
    for (const child of node.namedChildren) {
      walkSymbols(child, ctx, knownFiles);
    }
    return;
  }

  for (const child of node.namedChildren) {
    walkSymbols(child, ctx, knownFiles);
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

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const nameNodeTypes = new Set([
    "class_declaration",
    "interface_declaration",
    "enum_declaration",
    "function_declaration",
    "method_definition",
    "method_signature",
    "property_signature",
    "public_field_definition",
    "type_alias_declaration",
    "internal_module",
    "variable_declarator",
    "required_parameter",
    "optional_parameter",
  ]);
  const visit = (n: Node): void => {
    if (nameNodeTypes.has(n.type)) {
      let name: Node | null = n.childForFieldName("name");
      if (!name && (n.type === "required_parameter" || n.type === "optional_parameter")) {
        name = n.namedChildren.find((c) => c.type === "identifier") ?? null;
      }
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function isImportContext(node: Node): boolean {
  let cur: Node | null = node;
  while (cur) {
    if (cur.type === "import_statement" || cur.type === "import_clause") {
      return true;
    }
    cur = cur.parent;
  }
  return false;
}
function collectImportNames(importNode: Node): string[] {
  const names: string[] = [];
  const visit = (n: Node): void => {
    if (n.type === "import_specifier") {
      const name = n.childForFieldName("name")?.text;
      if (name) names.push(name);
      return;
    }
    if (n.type === "namespace_import") {
      const id = n.namedChildren.find((c) => c.type === "identifier");
      if (id) names.push(id.text);
      return;
    }
    if (n.type === "identifier") {
      names.push(n.text);
      return;
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(importNode);
  return names;
}

function collectImportEdges(root: Node, ctx: WalkCtx): void {
  const visit = (node: Node): void => {
    if (node.type === "import_statement") {
      const sourceNode = node.namedChildren.find((c) => c.type === "string");
      const source = sourceNode?.text.replace(/['"]/g, "") ?? "";
      if (source.startsWith("./") || source.startsWith("../")) {
        const names = collectImportNames(node);
        const resolved = resolveImportPath(ctx.file, source, ctx.knownFiles);
        if (resolved) {
          for (const name of names) {
            ctx.references.push({
              kind: "import",
              from: ctx.file,
              to: resolved,
              name,
              line: node.startPosition.row + 1,
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
  const base = pathPosixJoin(dir, specifier);
  const candidates = [
    base,
    ...VCS_INDEXABLE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...VCS_INDEXABLE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}

function pathPosixJoin(a: string, b: string): string {
  const joined = `${a}/${b}`.split("/").filter((p) => p !== ".").join("/");
  const parts: string[] = [];
  for (const p of joined.split("/")) {
    if (p === "..") parts.pop();
    else if (p) parts.push(p);
  }
  return parts.join("/");
}

function collectAnchorAndBindingRefs(root: Node, ctx: WalkCtx): void {
  const symbolNames = new Set(ctx.symbols.map((s) => s.name));
  const bindingNames = collectBindingNames(root);
  const visit = (node: Node): void => {
    if (
      (node.type === "identifier" ||
        node.type === "type_identifier" ||
        node.type === "property_identifier" ||
        node.type === "shorthand_property_identifier") &&
      !isImportContext(node)
    ) {
      const name = node.text;
      const line = node.startPosition.row + 1;
      if (ctx.declarationPositions.has(declKey(ctx.file, line, name))) {
        // declaration name itself; skip
      } else if (bindingNames.has(name)) {
        ctx.references.push({
          kind: "binding",
          from: ctx.file,
          to: ctx.file,
          name,
          line,
        });
      } else if (symbolNames.has(name)) {
        ctx.references.push({
          kind: "anchor",
          from: ctx.file,
          to: ctx.file,
          name,
          line,
        });
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "lexical_declaration") {
      for (const child of node.namedChildren) {
        if (child.type === "variable_declarator") {
          const name = child.childForFieldName("name")?.text;
          if (name) names.add(name);
        }
      }
    }
    if (node.type === "formal_parameters") {
      for (const child of node.namedChildren) {
        const name = paramName(child);
        if (name) names.add(name);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return names;
}

function paramName(node: Node): string | null {
  const field = node.childForFieldName("name");
  if (field) return field.text;
  const id = node.namedChildren.find((c) => c.type === "identifier");
  return id ? id.text : null;
}

export async function extractFile(
  rel: string,
  text: string,
  knownFiles: Set<string>,
): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }> {
  const grammar = grammarForFile(rel);
  const language = await loadGrammar(grammar);
  const parser = createParser(language);
  const tree = parser.parse(text);
  if (tree === null) {
    return { symbols: [], references: [] };
  }
  try {
    const ctx: DeclContext = {
      scope: "",
      symbols: [],
      references: [],
      declarationNames: new Set(),
      file: rel,
    };
    walkSymbols(tree.rootNode, ctx, knownFiles);
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
    ctxRefs.references.sort(
      (a, b) =>
        a.from.localeCompare(b.from) ||
        a.line - b.line ||
        a.name.localeCompare(b.name) ||
        a.kind.localeCompare(b.kind) ||
        a.to.localeCompare(b.to),
    );
    return { symbols: ctx.symbols, references: ctxRefs.references };
  } finally {
    tree.delete();
  }
}
