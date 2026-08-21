// src/scout/build.ts
import fs from "node:fs";
import { parseContractMarkdown } from "../contract/parse.js";
import type { Contract } from "../contract/types.js";
import { appendProbe } from "../probe-log.js";
import { contractPath } from "../paths.js";
import { SearchError, searchCanon } from "../search/search.js";
import { refreshStaleIndex } from "../commands/auto-reindex.js";
import type { ScoutDocHit, ScoutManifest, ScoutOptions } from "./types.js";

export const MIN_DOC_HITS = 2;
export const TOP_SCORE_FLOOR = 1.0;
const TOP_SCORE_FLOOR_TEXT = "1.0";

function formatScore(score: number): string {
  return Number(score.toFixed(4)).toString();
}

function loadContract(root: string): Contract | null {
  try {
    return parseContractMarkdown(fs.readFileSync(contractPath(root), "utf8"));
  } catch {
    return null; // role annotation degrades gracefully; retrieval must not fail on contract issues
  }
}

function roleForPath(contract: Contract | null, relPath: string): string {
  const norm = relPath.replaceAll("\\", "/");
  if (contract) {
    for (const section of contract.sections) {
      const key = `docs/canon/${section.path.replaceAll("\\", "/")}`;
      if (norm === key) return section.role;
    }
  }
  return norm.startsWith("docs/canon/future_plans/") ? "future-plan" : "other";
}

export async function buildScoutManifest(
  root: string,
  query: string,
  options?: ScoutOptions,
): Promise<ScoutManifest> {
  const trimmed = query.trim();
  if (!trimmed) throw new SearchError("empty_query", "query must be non-empty");

  const maxHits = options?.maxHits ?? 10;
  const snippetLines = options?.snippetLines ?? 4;
  const contract = loadContract(root);
  const warnings: string[] = [];

  const runDoc = () => searchCanon(root, trimmed, { maxHits, snippetLines });
  let docPack = runDoc();
  const docReindexed = await refreshStaleIndex(root, "doc", docPack.freshness);
  if (docReindexed) {
    docPack = runDoc();
    if (!docPack.warnings.includes("auto_reindexed")) {
      docPack.warnings = [...docPack.warnings, "auto_reindexed"];
    }
  }
  appendProbe(root, {
    ts: new Date().toISOString(),
    kind: "doc",
    query: trimmed,
    hits: docPack.hits.length,
    freshness: docPack.freshness,
    reindexed: docReindexed,
  });
  warnings.push(...docPack.warnings);

  const docs: ScoutDocHit[] = docPack.hits.map((hit) => ({
    path: hit.path,
    role: roleForPath(contract, hit.path),
    score: hit.score,
    snippets: hit.snippets,
  }));

  const topScore = docs.length > 0 ? docs[0]!.score : null;
  const verdict =
    docs.length >= MIN_DOC_HITS && topScore !== null && topScore >= TOP_SCORE_FLOOR
      ? "sufficient"
      : "need_more";
  const reason =
    topScore === null
      ? "0 hits; no top score"
      : `${docs.length} ${docs.length === 1 ? "hit" : "hits"}; top score ${formatScore(topScore)} ${verdict === "sufficient" ? ">=" : "<"} ${TOP_SCORE_FLOOR_TEXT}`;

  return { query: trimmed, verdict, reason, docs, warnings };
}
