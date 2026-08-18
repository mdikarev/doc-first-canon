// src/index/stem.ts
const EN_SUFFIXES: ReadonlyArray<readonly [string, string]> = [
  ["ies", "y"],
  ["ing", ""],
  ["ed", ""],
  ["ly", ""],
  ["er", ""],
  ["est", ""],
  ["es", ""],
  ["s", ""],
];

const RU_SUFFIXES: readonly string[] = [
  "ами",
  "ями",
  "ов",
  "ев",
  "ом",
  "ем",
  "ах",
  "ях",
  "ый",
  "ий",
  "ой",
  "ая",
  "яя",
  "ое",
  "ее",
  "ие",
  "ые",
  "и",
  "ы",
  "а",
  "я",
  "о",
  "е",
  "у",
  "ю",
];

const CYRILLIC_RE = /[\u0400-\u04FF]/;

export function stem(token: string): string {
  if (token.length <= 3) return token;
  if (CYRILLIC_RE.test(token)) {
    for (const suffix of RU_SUFFIXES) {
      if (token.endsWith(suffix) && token.length - suffix.length >= 3) {
        return token.slice(0, -suffix.length);
      }
    }
    return token;
  }
  for (const [suffix, replacement] of EN_SUFFIXES) {
    if (token.endsWith(suffix)) {
      const stemmed = token.slice(0, -suffix.length) + replacement;
      if (stemmed.length >= 4) return stemmed;
    }
  }
  return token;
}
