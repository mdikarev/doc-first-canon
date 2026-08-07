import micromatch from "micromatch";

const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".doc-canon",
] as const;

export const DEFAULT_IGNORE_GLOBS = DEFAULT_EXCLUDES.flatMap((name) => [
  name,
  `${name}/**`,
  `**/${name}`,
  `**/${name}/**`,
]);

export function isIgnored(repoRelativePath: string, ignoreGlobs: string[]): boolean {
  const candidate = repoRelativePath.replaceAll("\\", "/").replace(/^\.?\//, "");
  const patterns = [...DEFAULT_IGNORE_GLOBS, ...ignoreGlobs];
  return micromatch.isMatch(candidate, patterns, { dot: true }) ||
    micromatch.isMatch(`${candidate}/`, patterns, { dot: true });
}
