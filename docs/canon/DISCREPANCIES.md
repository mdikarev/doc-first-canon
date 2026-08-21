# Discrepancies

## How to use

Record grounded docs↔code (or docs↔docs) conflicts here. Skills own semantic findings and this file; `doc-canon check` never edits it.

Apply order for resolution:

1. Successful apply (canon edit + `validate`, or write coding task)
2. Set `decision` (`docs_stale` or `code_stale`)
3. Move Open → Resolved only when appropriate (`docs_stale` same session after validate; `code_stale` stays Open until a later `canon-audit` no longer reproduces the drift)

Never silently pick a side. Never edit application code from canon skills.

## Open

## Resolved

### D-017: SKILLS.md skills-table rows omit `--json` from the validate success gate
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/SKILLS.md`
- **code_paths:** `embedded/skills/canon-bootstrap/SKILL.md`, `embedded/skills/canon-contract/SKILL.md`,
  `embedded/skills/canon-future-plan/SKILL.md`
- **evidence:** The P9 closing canon-audit surfaced a doc↔doc conflict in the SKILLS.md skills table:
  the `canon-bootstrap` (`; validate`), `canon-future-plan` ("run `doc-canon validate` before claiming
  success"), and `canon-contract` (`; validate`) rows ended with a bare `doc-canon validate` gate, while
  the SKILLS.md:103 invariant requires "Always `doc-canon validate --json` before claiming success on
  canon edits" and all 13 embedded skill-body mentions carry `--json` (and the CLI implements `--json`
  per CLI.md `validate` row + `src/commands/validate.ts`). Docs stale side: the three table rows lost
  the `--json` flag. Aligned all three rows to `validate --json`; `doc-canon validate --json` succeeded
  in the same session (exit 0, zero `error`-severity issues).
- **finding_ids:** `F-013`

### D-016: Canon described freshness as purely hash-driven and the code-index artifact set as closed; fixes 1-3 made freshness stat-first with a stats sidecar
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/CLI.md`, `docs/canon/GLOSSARY.md`, `docs/canon/ARCHITECTURE.md`, `docs/canon/CODE_INDEX.md`
- **code_paths:** `src/index/sync.ts`, `src/index/io.ts`, `src/index/reader.ts`, `src/index/types.ts`, `src/code-index/sync.ts`, `src/code-index/reader.ts`, `src/code-index/stats.ts`
- **evidence:** The performance fixes (stat-first freshness) shipped behavior the living canon did not
  describe: (1) `index-manifest` per-doc meta now optionally carries a `size`/`mtime_ms` stat snapshot
  (`src/index/types.ts`), so freshness detection is stat-pre-checked with content-hash confirmation of
  stat-changed candidates instead of hashing every doc on every sync/search (`src/index/sync.ts`,
  `src/index/reader.ts`); (2) a new internal `.doc-canon/code-index-stats.json` sidecar
  (fingerprint-keyed; `src/code-index/stats.ts`) lets code freshness checks skip re-reading/re-hashing
  unchanged files, deliberately outside the byte-identical dual artifact (`src/code-index/sync.ts`,
  `src/code-index/reader.ts`); (3) on the fresh path the bm25 pair is trusted by mtime ordering
  (`loadBm25` only when bm25 is rewritten after the manifest commit marker), preserving the
  corrupt-bm25 repair test. Canon stale side: `CLI.md` artifacts list omitted `code-index-stats.json`;
  `GLOSSARY.md` `doc_hash`/`index-manifest` described only content-hash detection and a closed field
  set; `ARCHITECTURE.md`/`CODE_INDEX.md` called freshness "hash-driven" and did not mention the stat
  cache. Public CLI surface, search results, and dual-artifact byte-determinism are unchanged. Fixed
  the four canon paths (artifacts list, glossary entries incl. new `code-index-stats` term,
  ARCHITECTURE index-sync/code-index blocks, CODE_INDEX freshness invariant); `doc-canon validate`
  succeeded in the same session.
- **finding_ids:** `F-012`

### D-015: Canon under-documented the corrupt-index exit-gate in `discipline`
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/CLI.md`, `docs/canon/GLOSSARY.md`
- **code_paths:** `src/discipline/state.ts`, `src/commands/discipline.ts`
- **evidence:** The `discipline` command exits ≠0 not only on an un-probed index but also when an
  index exists but is unreadable — `corrupt: true` in `src/discipline/state.ts` (manifest present but
  unparseable, or `openCodeIndex`/`liveHashes` failures), reported as `corrupt index (unreadable)` in
  `src/commands/discipline.ts` and surfaced as a per-kind `corrupt` key in `--json`. This corrupt gate
  was prescribed by the P7 final review (the spec's error table left corrupt unspecified; the ruling
  was "report + exit ≠0"), but the living canon written before that refinement documented only the
  un-probed exit: `CLI.md` `discipline` row said "exit ≠0 … (un-probed state)" and `GLOSSARY.md`
  `Discipline finding` said "exit ≠0 on un-probed state". Fixed both passages to state the corrupt
  exit-gate and that a corrupt index is reported, not masked as not-applicable; `doc-canon validate`
  succeeded in the same session. The closing P7 canon-audit (2026-08-19) confirmed the drift no longer
  reproduces.

### D-014: GLOSSARY code-ast-index lagged C# imported-type and Rust/Python member-access slices
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/GLOSSARY.md`, `docs/canon/CODE_INDEX.md`
- **code_paths:** `src/code-index/extractors/csharp.ts`, `src/code-index/resolvers/csharp.ts`
- **evidence:** `GLOSSARY.md` `code-ast-index` still described "C# `object_creation_expression` with a
  same-namespace pass" and "Rust/Python relative-import edges only and no member-access in v1",
  contradicting the shipped C# imported-type pass (`collectUsingDirectives`, `bindingForTypeNode`,
  `collectConstructorBindings`, `collectMemberAccessEdges` in `src/code-index/extractors/csharp.ts`;
  `resolveCSharpNamespaceReferences` own-first/using-union in `src/code-index/resolvers/csharp.ts`),
  the absorbed Rust/Python slices, and sibling canon (GLOSSARY `Member-access reference`,
  `ARCHITECTURE.md`, `CODE_INDEX.md` per-language row). Also swept `CODE_INDEX.md` Open questions
  still marking the P6a-CSharp-2 initiative status `implementing`. Task log pre-authorized the
  docs_stale fix: rewrote the parenthetical to state C# imported-type/namespace pass over the
  syntactic project model and Rust/Python import-edge-map resolution with no cross-file pass; updated
  the initiative status to `absorbed`; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-015`

### D-013: Liveness downweight never fires on the real corpus (`future_plans/**` not matched by path prefix)
- **status:** resolved
- **decision:** code_stale
- **canon_paths:** `docs/canon/ARCHITECTURE.md`, `docs/canon/CLI.md`, `docs/canon/GLOSSARY.md`
- **code_paths:** `src/index/bm25.ts`, `src/index/list.ts`, `src/index/sync.ts`, `tests/index-bm25.test.ts`
- **evidence:** Canon and spec promise a 0.5× `FUTURE_PLANS_WEIGHT` for `future_plans/**` docs. The
  shipped `score()` in `src/index/bm25.ts` applied it only when `path.startsWith("future_plans/")`,
  but the manifest/index keys are root-relative (`docs/canon/future_plans/...`), so 0 of 36 indexed
  docs matched the prefix and the downweight never fired on the real corpus. Resolved by commit
  `e305262` as a bugfix: `score()` now matches a `future_plans` path segment at any depth
  (`path.split("/").includes("future_plans")`), and the existing liveness unit test now uses the
  root-relative path basis so it guards production behavior. The closing canon-audit (2026-08-18)
  confirmed the drift no longer reproduces: dogfood `doc-canon search "how documentation indexing
  works"` ranks living canon first (`GLOSSARY.md` 51.6, `SKILLS.md` 45.1, `ARCHITECTURE.md` 37.8)
  while `future_plans/p0-skill-context-efficiency.md` drops to rank 7 (score 21.9), and the full suite
  passes 323/323 — satisfying the apply-order rule that a `code_stale` entry stays Open until a later
  audit confirms; status moved to Resolved.
- **finding_ids:** `F-014`

### D-012: ARCHITECTURE understates `.worktrees` default-ignore scope as code discovery only
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/agnostic/ignore.ts`, `src/inventory/build.ts`, `src/code-index/discovery.ts`
- **evidence:** ARCHITECTURE claimed the `.worktrees` default-ignore addition was "code discovery
  only", but it was added to the shared `DEFAULT_EXCLUDES` in `src/agnostic/ignore.ts`, which also
  drives the language-agnostic repo inventory (`src/inventory/build.ts`), so at a root containing
  `.worktrees` (e.g. the main repo) the inventory omits worktree clones. The canon corpus claim held —
  `src/index/list.ts` builds the BM25 corpus over `<root>/docs/canon` without ignore filtering — so
  docs were the stale side. Clarified the wording to state the shared-ignore scope; `doc-canon
  validate` succeeded in the same session.
- **finding_ids:** `F-013`

### D-011: Canon promises import edges; shipped code index carries zero (`resolveImportPath` never substitutes `.js` → `.ts`)
- **status:** resolved
- **decision:** code_stale
- **canon_paths:** `docs/canon/GLOSSARY.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/code-index/extractors/typescript.ts`
- **evidence:** Canon promised `import` edges in the code AST index; on this repo the shipped index
  carried zero. The repo's 149 relative imports use the ESM `.js`-extension convention
  (`from "../index/reader.js"`), and `resolveImportPath` only appended extensions to the specifier —
  it never substituted `.js` → `.ts` — so every relative import failed to resolve and no import edge
  was emitted. Resolved by this slice as a bugfix: `resolveImportPath` gains an ESM substitution pass
  (`.js`→`.ts`, `.jsx`→`.tsx`, `.mjs`→`.mts`, `.cjs`→`.cts`, plus `index.*` fallback) and call-site
  edges emit `import`-kind edges for identifier usages of imported names; validated by the A+B slice
  tests and a dogfood rebuild (nonzero import edges on this repo). The closing canon-audit
  (2026-08-18) confirmed the drift no longer reproduces: the rebuilt index on this worktree carries
  1228 import-kind references (previously 0), `resolveImportPath` performs the ESM substitution pass,
  and the code index is fresh — satisfying the apply-order rule that a `code_stale` entry stays Open
  until a later audit confirms; status kept Resolved.
- **finding_ids:** `F-012`

### D-010: GLOSSARY Source root lists five-language manifest detection as current
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/GLOSSARY.md`
- **code_paths:** `src/code-index/discovery.ts`
- **evidence:** User chose docs_stale. `discoverManifestRoots` detects only `package.json` (shipped TypeScript/JavaScript slice 1); Go, C#, Rust, and Python manifests land with their future slices (ARCHITECTURE already qualifies them as separate slices). Clarified GLOSSARY Source root to state package.json for the shipped slice and the rest with future slices; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-011`

### D-009: ARCHITECTURE/GLOSSARY claim import/export edges; slice 1 emits only import edges
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/ARCHITECTURE.md`, `docs/canon/GLOSSARY.md`
- **code_paths:** `src/code-index/extractors/typescript.ts`, `src/code-index/types.ts`
- **evidence:** User chose docs_stale. `ReferenceKind` is `anchor | import | binding` and the extractor handles `import_statement` only (slice-1 scope); no export edges exist. Changed "import/export edges" → "import edges" in ARCHITECTURE building block and GLOSSARY code-ast-index; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-010`

### D-008: OVERVIEW fixed initiative range P0–P3 lags added P4/P5
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/OVERVIEW.md`, `docs/canon/future_plans/INDEX.md`
- **code_paths:** (docs↔docs; retrieval of canon paths only)
- **evidence:** User chose docs_stale. OVERVIEW claimed initiatives "P0–P3" while `future_plans/INDEX.md` lists P0–P5 (P2, P4, P5 draft). Reworded OVERVIEW to point at the INDEX without a fixed range; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-009`

### D-007: CLI.md stale-index warning omits `--json` pack signal
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/CLI.md`
- **code_paths:** `src/commands/search.ts`
- **evidence:** User chose docs_stale. Clarified that human mode prints `index_stale` on stderr while `--json` puts the signal in Pack `warnings` / `freshness` only; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-007`

### D-006: GLOSSARY Working set discovery lags search-first Scout
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/GLOSSARY.md`, `docs/canon/SKILLS.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** (docs↔docs; retrieval behavior also in `src/commands/search.ts`, `src/search/search.ts`)
- **evidence:** User chose docs_stale. Updated `GLOSSARY.md` Working set to try-search-first with INDEX fallback, matching `SKILLS.md` / `ARCHITECTURE.md`; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-006`

### D-005: ARCHITECTURE CLI commands bullet omits shipped `search`
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/cli.ts`, `src/commands/search.ts`
- **evidence:** User chose docs_stale. Added `search` to the Building blocks CLI commands bullet; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-005`

### D-004: P0b future_plans status lags absorbed BM25 index
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/future_plans/INDEX.md`, `docs/canon/future_plans/p0b-bm25-index.md`, `docs/canon/OVERVIEW.md`, `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/cli.ts`, `src/commands/index-cmd.ts`
- **evidence:** Living OVERVIEW/CLI/ARCHITECTURE already document shipped `doc-canon index` / BM25 while `future_plans/INDEX.md` still listed P0b as `refining`. Marked P0b `absorbed` in the initiative file and INDEX (via absorb handoff); `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-004`

### D-003: Working-tree contract stamp reverted below package SKILLS_STAMP
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/CANON_CONTRACT.md`
- **code_paths:** `src/version.ts`
- **evidence:** Uncommitted working tree had `skills_stamp: "0.6.0"` while `SKILLS_STAMP` (and committed HEAD contract) were `"0.7.0"`. Restored contract YAML to `"0.7.0"`; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-003`

### D-002: OVERVIEW CLI scope omits shipped `index`
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/OVERVIEW.md`, `docs/canon/CLI.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/cli.ts`, `src/commands/index-cmd.ts`
- **evidence:** After P0b, living `CLI.md`/`ARCHITECTURE.md` and code expose `doc-canon index`, but `OVERVIEW.md` In scope still listed only `init`/`validate`/`check`/`report`/`upgrade-skills`. Updated OVERVIEW In scope (and CLI Purpose) to include `index`/BM25; `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-002`

### D-001: OVERVIEW managed skills list lags current canon
- **status:** resolved
- **decision:** docs_stale
- **canon_paths:** `docs/canon/OVERVIEW.md`, `docs/canon/SKILLS.md`
- **code_paths:** `embedded/skills/canon-future-plan/SKILL.md`
- **evidence:** `OVERVIEW.md` listed only `canon-bootstrap`, `canon-write`, `canon-audit`, and `canon-contract`, while `SKILLS.md` states five managed skills and embedded assets include `canon-future-plan`. `OVERVIEW.md` was updated to include `canon-future-plan`, then `doc-canon validate` succeeded in the same session.
- **finding_ids:** `F-001`

<!-- Move resolved discrepancy entries here. -->

## Template for new entries
<!--
  ### D-001: <short title>
- **status:** open | resolved
- **decision:** pending | docs_stale | code_stale
- **canon_paths:** ...
- **code_paths:** ...
- **evidence:** ...
- **finding_ids:** ...
- **coding_agent_prompt:** |
  What to study; what diverges; questions to clarify with the user.
-->
