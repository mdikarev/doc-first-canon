import micromatch from "micromatch";

const DEFAULT_EXCLUDES = [
  ".git",
  "node_modules",
  "dist",
  "build",
  ".doc-canon",
  ".worktrees",
] as const;

export const DEFAULT_IGNORE_GLOBS = DEFAULT_EXCLUDES.flatMap((name) => [
  name,
  `${name}/**`,
  `**/${name}`,
  `**/${name}/**`,
]);

export type IgnoreMatcher = (repoRelativePath: string) => boolean;

/**
 * micromatch.isMatch recompiles its pattern set on every call; for per-entry
 * walks (source-root discovery, repo inventory) that overhead dominates
 * runtime. A precompiled matcher is ~2 orders of magnitude cheaper per entry,
 * so walkers compile one matcher per walk via `createIgnoreMatcher` and reuse
 * it. Verdicts are identical to the previous per-entry isMatch checks
 * (including the trailing-slash directory form).
 */
type CompiledMatcher = (candidate: string) => boolean;

// @types/micromatch (4.0.10) predates array support in matcher(); the runtime
// accepts a pattern array and compiles it into a single matcher function.
const compilePatterns = micromatch.matcher as unknown as (
  patterns: readonly string[],
  options?: { dot?: boolean },
) => CompiledMatcher;

const matcherCache = new Map<string, CompiledMatcher>();

function compiledMatcher(patterns: readonly string[]): CompiledMatcher {
  const key = patterns.join("\u0000");
  let matcher = matcherCache.get(key);
  if (matcher === undefined) {
    matcher = compilePatterns(patterns, { dot: true });
    matcherCache.set(key, matcher);
  }
  return matcher;
}

export function createIgnoreMatcher(
  ignoreGlobs: readonly string[],
): IgnoreMatcher {
  const patterns = [...DEFAULT_IGNORE_GLOBS, ...ignoreGlobs];
  const matcher = compiledMatcher(patterns);
  return (repoRelativePath) => {
    const candidate = repoRelativePath
      .replaceAll("\\", "/")
      .replace(/^\.?\//, "");
    return matcher(candidate) || matcher(`${candidate}/`);
  };
}

export function isIgnored(
  repoRelativePath: string,
  ignoreGlobs: readonly string[],
): boolean {
  return createIgnoreMatcher(ignoreGlobs)(repoRelativePath);
}