// src/code-index/extractors/rust.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import type { CodeReference, CodeSymbol, SymbolKind } from "../types.js";

export function grammarForFile(rel: string): "rust" {
  return "rust";
}

function firstLine(text: string): string {
  return text.split("\n")[0].trim();
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
}

function implTypeName(node: Node): string | null {
  const t = node.childForFieldName("type");
  if (!t) return null;
  if (t.type === "type_identifier") return t.text;
  if (t.type === "generic_type") {
    const inner = t.namedChildren.find((c) => c.type === "type_identifier");
    if (inner) return inner.text;
  }
  return null;
}

type DeclContext = {
  scope: string;
  methodScope: string | null;
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

const NAMED_TYPE_ITEMS = new Map<string, SymbolKind>([
  ["struct_item", "struct"],
  ["trait_item", "trait"],
  ["enum_item", "enum"],
  ["type_item", "type"],
]);

function walkSymbols(node: Node, ctx: DeclContext): void {
  switch (node.type) {
    case "mod_item": {
      const name = nodeName(node);
      if (name) {
        pushSymbol(ctx, name, "module", node);
        const body = node.namedChildren.find((c) => c.type === "declaration_list");
        if (body) {
          for (const child of body.namedChildren) {
            walkSymbols(child, { ...ctx, scope: name });
          }
        }
      }
      return;
    }
    case "function_item":
    case "function_signature_item": {
      const name = nodeName(node);
      if (name) {
        const isMethod = node.type === "function_signature_item" || ctx.methodScope !== null;
        pushSymbol(ctx, name, isMethod ? "method" : "function", node);
      }
      return;
    }
    case "impl_item": {
      const implType = implTypeName(node);
      const childCtx: DeclContext = {
        scope: implType ?? ctx.scope,
        methodScope: implType,
        symbols: ctx.symbols,
        file: ctx.file,
      };
      for (const child of node.namedChildren) walkSymbols(child, childCtx);
      return;
    }
    case "const_item":
    case "static_item": {
      const name = nodeName(node);
      if (name) pushSymbol(ctx, name, "const", node);
      return;
    }
    case "field_declaration": {
      const name = node.childForFieldName("name");
      if (name) pushSymbol(ctx, name.text, "property", node);
      return;
    }
  }

  const typeKind = NAMED_TYPE_ITEMS.get(node.type);
  if (typeKind) {
    const name = nodeName(node);
    if (name) {
      pushSymbol(ctx, name, typeKind, node);
      if (typeKind === "struct" || typeKind === "trait") {
        for (const child of node.namedChildren) {
          walkSymbols(child, { ...ctx, scope: name, methodScope: typeKind === "trait" ? name : ctx.methodScope });
        }
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
  "mod_item",
  "struct_item",
  "trait_item",
  "enum_item",
  "type_item",
  "function_item",
  "function_signature_item",
  "const_item",
  "static_item",
  "field_declaration",
]);

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const visit = (n: Node): void => {
    if (DECLARATION_NAME_NODES.has(n.type)) {
      const name = n.childForFieldName("name");
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    } else if (n.type === "let_declaration" || n.type === "parameter") {
      const pattern = n.childForFieldName("pattern");
      if (pattern?.type === "identifier") {
        positions.add(declKey(file, pattern.startPosition.row + 1, pattern.text));
      }
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node): void => {
    if (node.type === "parameter" || node.type === "let_declaration") {
      const pattern = node.childForFieldName("pattern");
      if (pattern?.type === "identifier") names.add(pattern.text);
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return names;
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

function resolveModulePath(
  fromFile: string,
  modules: string[],
  parentLevels: number,
  knownFiles: Set<string>,
): string | null {
  if (modules.length === 0) return null;
  const fileDir = fromFile.includes("/") ? fromFile.slice(0, fromFile.lastIndexOf("/")) : "";
  let dirSegs = fileDir.split("/").filter((p) => p !== "");
  for (let i = 0; i < parentLevels; i++) dirSegs.pop();
  const base = posixJoin(dirSegs.join("/"), modules.join("/"));
  const candidates = [base, `${base}.rs`, `${base}/mod.rs`];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}

function collectUseEdges(root: Node, ctx: WalkCtx): void {
  const visit = (node: Node): void => {
    if (node.type === "use_declaration") {
      const arg = node.childForFieldName("argument");
      const argText = arg?.text ?? "";
      let parentLevels = 0;
      if (argText.startsWith("self::")) {
        parentLevels = 0;
      } else if (argText.startsWith("super::")) {
        parentLevels = 1;
      } else {
        return;
      }
      const segments = argText
        .split("::")
        .map((s) => s.trim())
        .filter((s) => s !== "");
      const item = segments[segments.length - 1];
      const modules = segments.slice(1, -1);
      const resolved = resolveModulePath(ctx.file, modules, parentLevels, ctx.knownFiles);
      if (resolved) {
        const name = item === "*" ? modules[modules.length - 1] ?? item : item;
        ctx.references.push({
          kind: "import",
          from: ctx.file,
          to: resolved,
          name,
          line: node.startPosition.row + 1,
        });
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
}

const REFERENCE_IDENTIFIERS = new Set([
  "identifier",
  "type_identifier",
  "field_identifier",
]);

function collectAnchorAndBindingRefs(root: Node, ctx: WalkCtx): void {
  const symbolNames = new Set(ctx.symbols.map((s) => s.name));
  const bindingNames = collectBindingNames(root);
  const visit = (node: Node): void => {
    if (node.type === "use_declaration") return;
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
): Promise<{ symbols: CodeSymbol[]; references: CodeReference[] }> {
  const language = await loadGrammar("rust");
  const parser = createParser(language);
  const tree = parser.parse(text);
  if (tree === null) {
    return { symbols: [], references: [] };
  }
  try {
    const ctx: DeclContext = {
      scope: "",
      methodScope: null,
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
    collectUseEdges(tree.rootNode, ctxRefs);
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
