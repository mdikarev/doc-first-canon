// src/code-index/extractors/typescript.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
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
    return { symbols: ctx.symbols, references: ctx.references };
  } finally {
    tree.delete();
  }
}
