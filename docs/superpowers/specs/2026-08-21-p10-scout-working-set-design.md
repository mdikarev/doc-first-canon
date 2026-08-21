# P10 — CLI scout: generated working-set manifest — Design Spec

SoT for the P10 initiative: a new `doc-canon scout "<topic>"` command that turns a topic query
into a ready-made working-set manifest (paths ranked by search, each annotated with its contract
role, snippet stubs, and a deterministic `sufficient` / `need_more` verdict hint), replacing the
hand-built Scout step in the managed skills. `scout` composes the shipped retrieval layer —
`searchCanon` (docs BM25 pack), `searchCodeIndex` (code AST pack), contract role lookup,
`refreshStaleIndex` self-heal, and the probe log — without changing any existing command's
contract.

## Problem

The Scout → Expand protocol in `canon-write`, `canon-audit`, and `canon-bootstrap` (documented in
`docs/canon/SKILLS.md` "Scout retrieval protocol" and `GLOSSARY.md` Scout / Working set) asks the
agent to run `doc-canon search "<topic>"`, then **assemble a working-set manifest by hand** —
pick paths from the pack, annotate each with a contract role and a why-in-set stub, and show a
verdict. That hand assembly is routine, repeated in every managed skill on every substantial task,
and costs agent context. The initiative file (`future_plans/p10-cli-scout-working-set.md`) states
the intent: the CLI should own the mechanical manifest, while agents keep the semantic Expand
decision.

## Goals

- `doc-canon scout "<topic>"` emits a working-set manifest in one call: ranked docs paths, each
  annotated with its contract role (`contract.sections[].role`), snippet stubs, and a deterministic
  verdict hint (`sufficient` / `need_more`).
- Manifest is available as stable JSON (`--json`) and a compact human mode (default); reuses the
  existing `--max-hits` / `--snippet-lines` flags.
- Verdict is a deterministic heuristic over the docs pack (hit count and top score), with hardcoded
  CLI defaults — no per-repo config surface in v1.
- `scout` owns its fail-closed path exactly like `search` does: self-heal a stale index
  (`refreshStaleIndex`), rebuild and retry; on missing/unbuildable index, fail with the standard
  error + install/build hint. Fail-closed fallback notes (`doc_miss` / `code_miss`) stay with the
  agent — they concern reading files outside the pack, not the CLI.
- Optional code-index probe: when a code index exists and covered source is present, `scout` seeds
  both packs (docs + code) automatically; `--no-code` opts out. A missing code index is skipped
  silently (docs-only), not an error.
- Every probe `scout` performs (docs and code) is recorded in `.doc-canon/probe-log.jsonl` via the
  existing `appendProbe`, so `discipline` sees real activity.
- `need_more` is a valid result (exit 0), not an error — the agent decides to Expand.

## Non-goals

- Semantic judgements: what counts as "enough" for a given task stays the agent's Expand gate; the
  verdict hint is advisory.
- Changing the search engine, ranking, glossary expansion, or pack shapes (`PackResult`,
  `CodePack`) — `scout` consumes them as-is.
- Writing or deleting canon files; editing application code.
- Per-repo verdict threshold configuration (v1 uses hardcoded defaults; revisit only if real use
  demands tuning).
- Emitting `doc_miss` / `code_miss` notes from the CLI (agent-owned).
- Auto-repair of structural issues (that is P11).

## Decisions

- **Command shape** — `doc-canon scout "<topic>"` with `--root <path>` (default cwd),
  `--json`, `--max-hits <n>` (default 10), `--snippet-lines <n>` (default 4), `--no-code`.
  Registered in `src/cli.ts` next to `search`; thin action wrapper delegating to
  `src/commands/scout.ts` → `src/scout/build.ts`.
- **Manifest JSON shape** (stable, snake_case to match `PackResult` conventions):

  ```json
  {
    "query": "<trimmed topic>",
    "verdict": "sufficient" | "need_more",
    "reason": "<one-line deterministic explanation, e.g. '2 hits; top score 82.4 >= 1.0'>",
    "docs": [{ "path": "docs/canon/CLI.md", "role": "section", "score": 2.09,
               "snippets": [{ "start_line": 4, "text": "..." }] }],
    "code": [{ "file": "src/cli.ts", "line": 12, "kind": "function", "name": "..." }],
    "warnings": []
  }
  ```

  `docs` entries reuse `PackHit` fields (`path` relative to repo root, `score`, `snippets`) plus
  `role`. `code` entries reuse the `code-index search` symbol-mode hit shape (file/line/kind/name).
  `code` omitted when the probe did not run (no index or `--no-code`). `warnings` carries
  `auto_reindexed` / `index_stale` / `code_index_stale` signals (same vocabulary as `search`).
- **Role annotation** — built from `CANON_CONTRACT.md` via the existing `parseContractMarkdown`:
  a map `contract.sections[].path -> role`. Hit paths are repo-relative; contract paths are
  `docs/canon/`-relative, so the map keys are prefixed (`docs/canon/<section.path>`). Files not in
  the contract get a stable fallback: `future_plans/*` → `future-plan`, everything else → `other`.
- **Verdict heuristic** (hardcoded defaults): `sufficient` when the docs pack has >= 2 hits and
  top score >= 1.0; otherwise `need_more`. Reason string states both numbers and the threshold
  (e.g. `"2 hits; top score 82.4 >= 1.0"` / `"1 hit; top score 0.3 < 1.0"`). Code hits do not
  change the verdict — the doc pack is the primary signal; code is additive context.
- **Code probe** — after the docs pack, `scout` attempts `searchCodeIndex(root, query, {maxHits,
  snippetLines})`. Success → append `code` entries (symbol mode; refs mode is out of scope — scout
  is a topic probe). `code_index_missing` / unbuildable → skip silently (docs-only, no warning).
  `code_index_stale` → self-heal via `refreshStaleIndex(root, "code", freshness)` like
  `code-index search` does, retry once, and surface `auto_reindexed` / `code_index_stale` in
  `warnings`. `--no-code` skips the probe entirely.
- **Fail-closed for docs** — reuse `refreshStaleIndex(root, "doc", freshness)` exactly as
  `src/commands/search.ts` does: run, self-heal if stale, re-run, append `auto_reindexed` warning.
  If `searchCanon` throws `SearchError("index_unavailable", ...)`, `scout` fails with the same
  message and exit 1 (the message already carries the `doc-canon index` hint).
- **Probe log** — one `appendProbe` call for the docs search (kind `doc`) and one for the code
  search (kind `code`, mode `symbols`) when the probe ran. Exit code 0 even when `need_more`; 1 for
  empty query, invalid numeric flags, or unbuildable doc index after self-heal.
- **Human mode** (default) — prints the verdict line (`verdict: sufficient (2 hits; top score
  82.4 >= 1.0)` or `verdict: need_more (...)`), then ranked docs hits as
  `path  score=<n>  role=<role>` followed by snippet windows (same rendering as `search`), then
  code hits as `file  L<line>  <kind>  <name>` when present, then warnings on stderr
  (`auto_reindexed` / `index_stale` / `code_index_stale`), matching `search`'s stderr vocabulary.

## Module layout

- `src/scout/types.ts` — `ScoutManifest`, `ScoutDocHit` (PackHit + `role`), `ScoutCodeHit`,
  `ScoutVerdict = "sufficient" | "need_more"`, `ScoutOptions`.
- `src/scout/build.ts` — `buildScoutManifest(root, query, options)`: composes the docs pack,
  role map, verdict, code probe, probe-log entries; returns the manifest. Owns thresholds
  (constants `MIN_DOC_HITS = 2`, `TOP_SCORE_FLOOR = 1.0`).
- `src/commands/scout.ts` — CLI wrapper: flag parsing/validation, human rendering, exit codes.
- `src/cli.ts` — register the `scout` command.
- `tests/scout.test.ts` (+ `tests/fixtures/` reuse where possible) — see Testing.

## Testing

- Verdict thresholds: sufficient (>=2 hits, top >= floor), need_more (1 hit; top < floor; 0 hits),
  boundary cases at exactly 2 hits / exactly 1.0 score, reason strings.
- Role annotation: contract section (e.g. `docs/canon/CLI.md` → `section`), `future_plans/*`
  → `future-plan`, non-contract path → `other`.
- Code probe: index present → code entries included; index absent → docs-only, no error;
  `--no-code` → no probe; stale code index → self-heal + `auto_reindexed` warning.
- Fail-closed: missing doc index → `SearchError` message + exit 1; stale doc index → self-heal +
  `auto_reindexed`; empty query / invalid `--max-hits` / `--snippet-lines` → exit 1.
- Probe log: docs and code probes recorded with correct kind/mode/query/hits.
- `--json` shape: stable field names, `code` omitted when probe skipped, deterministic ordering
  (ranked by score, tie-break path — matches `search`).
- Human mode: verdict line, hit rendering, stderr warnings; exit codes 0/1.
- CLI registration: `doc-canon scout --help` shows the command; `--root` honored.

## Absorbs into (post-implementation, via canon-write / canon-future-plan)

- `CLI.md` — new `scout` command (Purpose/Scope/Current state/Commands/Interfaces, usage example).
- `SKILLS.md` — Scout protocol step 1: `doc-canon scout "<topic>"` emits the manifest; the
  hand-built manifest step is replaced in all three skills (`canon-write`, `canon-audit`,
  `canon-bootstrap`); Expand decision stays with the agent.
- `ARCHITECTURE.md` — retrieval layer: `scout` composes `search` / `code-index search`.
- `GLOSSARY.md` — Working set / Scout terms: manifest now CLI-generated.
- `future_plans/INDEX.md` + `p10-*.md` — status `refining -> implementing -> absorbed`.

## Open questions

- None blocking. (Initiative open questions — threshold configurability, `doc_miss`/`code_miss`
  emission — resolved in the initiative file: hardcoded defaults, agent-owned miss notes.)
