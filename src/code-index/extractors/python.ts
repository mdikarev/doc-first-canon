// src/code-index/extractors/python.ts
import { createParser, loadGrammar, type Node } from "../parser.js";
import type { CodeReference, CodeSymbol } from "../types.js";

export function grammarForFile(rel: string): "python" {
  return "python";
}

const UPPER_SNAKE = /^[A-Z][A-Z0-9_]*$/;

function isUpperSnake(name: string): boolean {
  return UPPER_SNAKE.test(name);
}

function firstLine(text: string): string {
  return text.split("\n")[0].trim();
}

function nodeName(node: Node): string | null {
  const name = node.childForFieldName("name");
  return name ? name.text : null;
}

function moduleName(file: string): string {
  const stem = file.slice(file.lastIndexOf("/") + 1);
  return stem.replace(/\.py$/, "");
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
  kind: CodeSymbol["kind"],
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

function walkSymbols(node: Node, ctx: DeclContext): void {
  switch (node.type) {
    case "module": {
      const name = moduleName(ctx.file);
      pushSymbol(ctx, name, "module", node);
      break;
    }
    case "class_definition": {
      const name = nodeName(node);
      if (name) {
        pushSymbol(ctx, name, "class", node);
        const body = node.childForFieldName("body");
        if (body) {
          for (const child of body.namedChildren) {
            walkSymbols(child, { ...ctx, scope: name, methodScope: name });
          }
        }
      }
      return;
    }
    case "function_definition": {
      const name = nodeName(node);
      if (name) {
        if (ctx.methodScope) pushSymbol(ctx, name, "method", node, ctx.methodScope);
        else pushSymbol(ctx, name, "function", node);
      }
      return;
    }
    case "expression_statement": {
      if (ctx.scope === "" && ctx.methodScope === null) {
        const assignment = node.namedChildren.find((c) => c.type === "assignment");
        if (assignment) {
          const left = assignment.childForFieldName("left");
          if (left?.type === "identifier" && isUpperSnake(left.text)) {
            pushSymbol(ctx, left.text, "const", assignment);
          }
        }
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

function collectDeclarationPositions(root: Node, file: string): Set<string> {
  const positions = new Set<string>();
  const visit = (n: Node): void => {
    if (n.type === "class_definition" || n.type === "function_definition") {
      const name = n.childForFieldName("name");
      if (name) positions.add(declKey(file, name.startPosition.row + 1, name.text));
    } else if (
      n.type === "assignment" ||
      n.type === "augmented_assignment" ||
      n.type === "named_expression"
    ) {
      const left = n.childForFieldName("left") ?? n.childForFieldName("name");
      if (left?.type === "identifier") {
        positions.add(declKey(file, left.startPosition.row + 1, left.text));
      }
    } else if (n.type === "parameters") {
      for (const c of n.namedChildren) {
        if (c.type === "identifier") {
          positions.add(declKey(file, c.startPosition.row + 1, c.text));
        }
      }
    }
    for (const c of n.namedChildren) visit(c);
  };
  visit(root);
  return positions;
}

function collectBindingNames(root: Node): Set<string> {
  const names = new Set<string>();
  const visit = (node: Node, inFunction: boolean): void => {
    if (inFunction) {
      if (node.type === "parameters") {
        for (const c of node.namedChildren) {
          if (c.type === "identifier") names.add(c.text);
        }
      }
      if (
        node.type === "assignment" ||
        node.type === "augmented_assignment" ||
        node.type === "named_expression"
      ) {
        const left = node.childForFieldName("left") ?? node.childForFieldName("name");
        if (left?.type === "identifier") names.add(left.text);
      }
    }
    const next = inFunction || node.type === "function_definition";
    for (const c of node.namedChildren) visit(c, next);
  };
  visit(root, false);
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
  const candidates = [base, `${base}.py`, `${base}/__init__.py`];
  for (const c of candidates) {
    if (knownFiles.has(c)) return c;
  }
  return null;
}

function identifiersIn(node: Node | null): string[] {
  if (!node) return [];
  const out: string[] = [];
  const visit = (n: Node): void => {
    if (n.type === "identifier") out.push(n.text);
    for (const c of n.namedChildren) visit(c);
  };
  visit(node);
  return out;
}

function collectImportEdges(root: Node, ctx: WalkCtx): void {
  const visit = (node: Node): void => {
    if (node.type === "import_from_statement") {
      const rel = node.namedChildren.find((c) => c.type === "relative_import");
      if (!rel) return;
      const prefix = rel.namedChildren.find((c) => c.type === "import_prefix");
      const dots = prefix?.text.length ?? 0;
      if (dots === 0) return;
      let moduleDotted: Node | null =
        rel.namedChildren.find((c) => c.type === "dotted_name") ?? null;
      let names: Node | null = node.childForFieldName("name");
      if (!moduleDotted) {
        moduleDotted = names;
        names = null;
      }
      const modules = moduleDotted
        ? moduleDotted.text.split(".").map((s) => s.trim()).filter(Boolean)
        : [];
      if (modules.length === 0) return;
      const resolved = resolveModulePath(ctx.file, modules, dots - 1, ctx.knownFiles);
      if (resolved) {
        const edgeNames = names ? identifiersIn(names) : [modules[modules.length - 1]];
        for (const edgeName of edgeNames) {
          ctx.references.push({
            kind: "import",
            from: ctx.file,
            to: resolved,
            name: edgeName,
            line: node.startPosition.row + 1,
          });
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
    if (node.type === "import_statement" || node.type === "import_from_statement") return;
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

const PASCAL_CASE = /^[A-Z][A-Za-z0-9_]*$/;

function collectCanonicalAliases(root: Node): Map<string, string> {
  const aliases = new Map<string, string>();
  const visit = (node: Node): void => {
    if (node.type === "import_from_statement") {
      const names = node.childForFieldName("name");
      if (names?.type === "aliased_import") {
        const canonicalNode = names.childForFieldName("name");
        const canonical = canonicalNode ? identifiersIn(canonicalNode).pop() : undefined;
        const alias = names.namedChildren.find((c) => c.type === "identifier");
        if (canonical && alias) aliases.set(alias.text, canonical);
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return aliases;
}

function collectImportedNames(references: CodeReference[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const r of references) {
    if (r.kind === "import" && !names.has(r.name)) names.set(r.name, r.to);
  }
  return names;
}

function collectConstructorBindings(
  root: Node,
  symbols: CodeSymbol[],
  importedNames: Map<string, string>,
  aliases: Map<string, string>,
  file: string,
): Map<string, { typeName: string; to: string }> {
  const classNames = new Set(symbols.filter((s) => s.kind === "class").map((s) => s.name));
  const bindings = new Map<string, { typeName: string; to: string }>();
  const visit = (node: Node): void => {
    if (node.type === "assignment") {
      const left = node.childForFieldName("left");
      const right = node.childForFieldName("right");
      if (left?.type === "identifier" && right?.type === "call") {
        const callee = right.childForFieldName("function");
        if (callee?.type === "identifier") {
          const name = callee.text;
          if (classNames.has(name)) {
            bindings.set(left.text, { typeName: name, to: file });
          } else if (PASCAL_CASE.test(name) && importedNames.has(name)) {
            const canonical = aliases.get(name) ?? name;
            bindings.set(left.text, { typeName: canonical, to: importedNames.get(name)! });
          }
        }
      }
    }
    for (const c of node.namedChildren) visit(c);
  };
  visit(root);
  return bindings;
}

function collectMemberAccessEdges(
  root: Node,
  ctx: WalkCtx,
  bindings: Map<string, { typeName: string; to: string }>,
): void {
  const visit = (node: Node): void => {
    if (node.type === "attribute") {
      const object = node.childForFieldName("object");
      const attribute = node.childForFieldName("attribute");
      if (object?.type === "identifier" && attribute?.type === "identifier") {
        const binding = bindings.get(object.text);
        if (binding) {
          ctx.references.push({
            kind: "import",
            from: ctx.file,
            to: binding.to,
            name: `${binding.typeName}.${attribute.text}`,
            line: node.startPosition.row + 1,
          });
        }
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
  const language = await loadGrammar("python");
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
    collectImportEdges(tree.rootNode, ctxRefs);
    collectAnchorAndBindingRefs(tree.rootNode, ctxRefs);
    const importedNames = collectImportedNames(ctxRefs.references);
    const aliases = collectCanonicalAliases(tree.rootNode);
    const bindings = collectConstructorBindings(
      tree.rootNode,
      ctxRefs.symbols,
      importedNames,
      aliases,
      ctxRefs.file,
    );
    collectMemberAccessEdges(tree.rootNode, ctxRefs, bindings);
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
