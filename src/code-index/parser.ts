// src/code-index/parser.ts
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const wasmPackageDir = path.dirname(
  require.resolve("@vscode/tree-sitter-wasm/package.json"),
);

type TreeSitterModule = {
  Parser: {
    new (): {
      setLanguage(language: unknown): void;
      parse(text: string): Tree | null;
    };
    init(options?: { locateFile?: (file: string, folder: string) => string }): Promise<void>;
  };
  Language: {
    load(pathOrBytes: string | Uint8Array): Promise<unknown>;
  };
};

export type Tree = {
  rootNode: Node;
  delete(): void;
};

export type Node = {
  type: string;
  text: string;
  childForFieldName(name: string): Node | null;
  namedChildren: Node[];
  children: Node[];
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  parent: Node | null;
};

export type Language = unknown;

const ts = require("@vscode/tree-sitter-wasm") as TreeSitterModule;

let parserInited = false;
const grammarCache = new Map<string, Language>();

export async function loadGrammar(name: string): Promise<Language> {
  const cached = grammarCache.get(name);
  if (cached) return cached;
  if (!parserInited) {
    await ts.Parser.init({
      locateFile: (file) => path.join(wasmPackageDir, "wasm", file),
    });
    parserInited = true;
  }
  const wasmPath = path.join(wasmPackageDir, "wasm", `tree-sitter-${name}.wasm`);
  const language = await ts.Language.load(wasmPath);
  grammarCache.set(name, language);
  return language;
}

export function createParser(language: Language) {
  const parser = new ts.Parser();
  parser.setLanguage(language);
  return parser;
}
