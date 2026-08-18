# Discrepancies

## How to use

Record grounded docs↔code (or docs↔docs) conflicts here. Skills own semantic findings and this file; `doc-canon check` never edits it.

Apply order for resolution:

1. Successful apply (canon edit + `validate`, or write coding task)
2. Set `decision` (`docs_stale` or `code_stale`)
3. Move Open → Resolved only when appropriate (`docs_stale` same session after validate; `code_stale` stays Open until a later `canon-audit` no longer reproduces the drift)

Never silently pick a side. Never edit application code from canon skills.

## Open

<!-- No open discrepancies. -->

## Resolved

### D-011: Canon promises import edges; shipped code index carries zero (`resolveImportPath` never substitutes `.js` → `.ts`)
- **status:** resolved
- **decision:** code_stale
- **canon_paths:** `docs/canon/GLOSSARY.md`, `docs/canon/ARCHITECTURE.md`
- **code_paths:** `src/code-index/extractors/typescript.ts`
- **evidence:** Canon promised `import` edges in the code AST index; on this repo the shipped index carried zero. The repo's 149 relative imports use the ESM `.js`-extension convention (`from "../index/reader.js"`), and `resolveImportPath` only appended extensions to the specifier — it never substituted `.js` → `.ts` — so every relative import failed to resolve and no import edge was emitted. Resolved by this slice as a bugfix: `resolveImportPath` gains an ESM substitution pass (`.js`→`.ts`, `.jsx`→`.tsx`, `.mjs`→`.mts`, `.cjs`→`.cts`, plus `index.*` fallback) and call-site edges emit `import`-kind edges for identifier usages of imported names; validated by the A+B slice tests and a dogfood rebuild (nonzero import edges on this repo).
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
