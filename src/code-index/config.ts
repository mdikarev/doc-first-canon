// src/code-index/config.ts
import fs from "node:fs";
import { codeIndexConfigPath } from "./paths.js";
import type { CodeIndexConfig } from "./types.js";

export function loadCodeIndexConfig(root: string): CodeIndexConfig {
  const configPath = codeIndexConfigPath(root);
  if (!fs.existsSync(configPath)) return {};
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(
      `invalid code-index config: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("invalid code-index config: expected an object");
  }
  const record = raw as Record<string, unknown>;
  const roots =
    Array.isArray(record.roots) && record.roots.every((v) => typeof v === "string")
      ? (record.roots as string[])
      : undefined;
  const ignore =
    Array.isArray(record.ignore) && record.ignore.every((v) => typeof v === "string")
      ? (record.ignore as string[])
      : undefined;
  let languages: Record<string, string> | undefined;
  if (
    typeof record.languages === "object" &&
    record.languages !== null &&
    !Array.isArray(record.languages)
  ) {
    languages = Object.fromEntries(
      Object.entries(record.languages as Record<string, unknown>).filter(
        ([, v]) => typeof v === "string",
      ),
    ) as Record<string, string>;
  }
  if (record.roots !== undefined && roots === undefined) {
    throw new Error("invalid code-index config: roots must be string[]");
  }
  if (record.ignore !== undefined && ignore === undefined) {
    throw new Error("invalid code-index config: ignore must be string[]");
  }
  return { roots, ignore, languages };
}
