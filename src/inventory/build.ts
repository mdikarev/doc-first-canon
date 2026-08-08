import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { isIgnored } from "../agnostic/ignore.js";
import type { Inventory, InventoryEntry } from "./types.js";

const BINARY_EXTENSIONS = new Set([
  ".7z",
  ".avi",
  ".bmp",
  ".class",
  ".doc",
  ".docx",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jar",
  ".jpeg",
  ".jpg",
  ".mov",
  ".mp3",
  ".mp4",
  ".pdf",
  ".png",
  ".so",
  ".tar",
  ".tif",
  ".tiff",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".xls",
  ".xlsx",
  ".zip",
]);

function tokensFor(basename: string): string[] {
  return basename
    .split(/[^a-zA-Z0-9]+/)
    .map((token) => token.toLowerCase())
    .filter(Boolean);
}

function entryFor(repoRelativePath: string, kind: "file" | "dir"): InventoryEntry {
  const basename = path.posix.basename(repoRelativePath);
  return {
    path: repoRelativePath,
    kind,
    basename,
    tokens: tokensFor(basename),
  };
}

function searchableText(absolutePath: string): string | undefined {
  if (BINARY_EXTENSIONS.has(path.extname(absolutePath).toLowerCase())) return undefined;
  try {
    const contents = readFileSync(absolutePath);
    if (contents.includes(0)) return undefined;
    return contents.toString("utf8");
  } catch {
    return undefined;
  }
}

export function buildInventory(
  root: string,
  ignoreGlobs: string[],
  glossaryTerms?: string[],
): Inventory {
  const absoluteRoot = path.resolve(root);
  const entries: InventoryEntry[] = [];

  function visit(directory: string, relativeDirectory = ""): void {
    const children = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));

    for (const child of children) {
      const relativePath = relativeDirectory
        ? `${relativeDirectory}/${child.name}`
        : child.name;
      if (isIgnored(relativePath, ignoreGlobs)) continue;

      const absolutePath = path.join(directory, child.name);
      if (child.isDirectory()) {
        entries.push(entryFor(relativePath, "dir"));
        visit(absolutePath, relativePath);
      } else if (child.isFile()) {
        entries.push(entryFor(relativePath, "file"));
      }
    }
  }

  visit(absoluteRoot);

  const inventory: Inventory = {
    generated_at: new Date().toISOString(),
    root: absoluteRoot,
    entries,
  };

  if (glossaryTerms !== undefined) {
    const textFiles = entries.filter((entry) => entry.kind === "file");
    const searchableFiles = textFiles.flatMap((entry) => {
      const text = searchableText(
        path.join(absoluteRoot, ...entry.path.split("/")),
      );
      return text === undefined ? [] : [{ path: entry.path, text: text.toLowerCase() }];
    });
    inventory.text_hits = glossaryTerms.map((term) => {
      const needle = term.toLowerCase();
      const paths = searchableFiles
        .filter((entry) => entry.text.includes(needle))
        .map((entry) => entry.path);
      return { term, paths };
    });
  }

  return inventory;
}

export function writeInventory(root: string, inventory: Inventory): void {
  const outputDirectory = path.join(path.resolve(root), ".doc-canon");
  mkdirSync(outputDirectory, { recursive: true });
  writeFileSync(
    path.join(outputDirectory, "inventory.json"),
    `${JSON.stringify(inventory, null, 2)}\n`,
    "utf8",
  );
}
