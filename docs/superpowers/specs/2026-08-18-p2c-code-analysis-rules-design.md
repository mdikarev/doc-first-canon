# P2c — Code analysis rules for agents & skills — Design Spec

**Date:** 2026-08-18  
**Status:** Draft for review  
**Initiative:** [`p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md)  
**Approach:** Managed `AGENTS.md` block / pointer-rule update plus coding-agent guidance that require trying the P2b code search first during code analysis, preserving expand-when-thin behavior and miss reporting — with a token-cost guard test proving the index route reads fewer tokens than naive source reads.

This spec is the detailed SoT for **P2c**: the agent-facing rules that make the P2a/P2b code index actually pay for itself. It consumes the already-shipped `doc-canon code-index build` / `code-index search` surface; it does not change the search surface, the index artifact, or the CLI. Where this spec and the initiative disagree on P2c *details*, this spec wins.

## Problem

P2a built the code AST index and P2b shipped the search probe (`doc-canon code-index search`), but nothing yet *requires* agents to use them. Coding agents analyzing a project still default to reading source files directly; when a change touches many files they pull whole trees into context. The index route is only worth its cost if agents actually take it. This initiative ships the rules that make code-index-first analysis the default for covered languages, keeps the canon's "quality over thrift / expand when thin" discipline (the source files remain the evidence when a probe is thin or a claim needs grounding), and locks in the payoff with a token-cost guard test.

## Goals

1. A managed `AGENTS.md` block / pointer-rule statement and coding-agent guidance requiring **code-index-first analysis**: try `doc-canon code-index search` before reading whole source files.
2. **Expand-when-thin preserved:** when the code-index probe returns nothing or a thin set, the agent reads source as evidence — quality over thrift — and **reports the miss** (`code_miss`), mirroring the canon's visible Expand gate.
3. **Global rule** for the five covered languages (TypeScript/JavaScript, Go, C#, Rust, Python); uncovered languages skip the index and go straight to source.
4. **Index-first skill discipline** for `canon-bootstrap` and `canon-audit`: build the indexes first (canon BM25 via `doc-canon index`, code AST via `doc-canon code-index build` when covered source exists), then achieve the skill's goals via index search (`doc-canon search` / `doc-canon code-index search`) when the indexes exist.
5. A **token-cost guard** test: a typical multi-file analysis via the index reads fewer bytes (proxy for tokens) than naive full-file reads.
6. Rule-scenario tests that the managed content contains the rule, and that it lands in target repos through `copyManagedAssets`.

## Non-goals

- Index construction (P2a) and CLI search tools (P2b) — both shipped; P2c only consumes them
- Changing the `code-index search` surface, `CodePack` shape, or `searchCodeIndex` options
- Replacing the canon's Scout → Expand → Execute rules for documentation
- Git-diff analysis as the primary change signal
- Editing source through the index
- Per-language rule variations (rule is global for covered languages)
- Making the miss report machine-parseable or feeding it back into any artifact (it is agent-facing prose/discipline, not a CLI feature)

## Decisions

| Topic | Choice |
| --- | --- |
| Rule strength | **Miss reporting:** when a code-index probe returns nothing or a thin set, the agent may read source directly but must note the miss (`code_miss: <query> -> source:<path>`), mirroring the canon's visible Expand gate |
| Token-cost guard | **Bounded pack vs full files:** fixture repo with large files; compare total snippet bytes in the pack against total source bytes — bounded pack is constructed to be small (`maxSnippetLinesTotal`), so the assertion is structural, not brittle |
| Language scope | **Global + fallback:** code-index-first applies to the five covered languages; uncovered languages go straight to source |
| Placement | Short statement in `embedded/agents/AGENTS.block.md`; fuller "Code analysis order" section in `embedded/rules/doc-canon.mdc` (feeds `CLAUDE.md`); both land in target repos via existing `copyManagedAssets` |
| Skill discipline | `canon-bootstrap` and `canon-audit` build indexes first (`doc-canon index`, `doc-canon code-index build` when covered source exists), then drive their goals through index search when indexes exist; code evidence during audits uses `code-index search` first |
| Canon absorption | `SKILLS.md` (agent recipe + code-analysis note), `GLOSSARY.md` (miss-reporting terms), `OVERVIEW.md` (audience/scope note); `DISCREPANCIES.md` flow if doc↔code divergence appears |
| Status | P2c `draft → implementing` via `canon-future-plan`, with the initiative Design link pointed at this spec; `absorbed` after absorption |

## Architecture

The rule lives entirely in managed agent-facing content plus tests — there is no new runtime code path in `doc-canon`.

```text
coding agent starts code analysis
        │
        ▼
  covered language?  ── no ──►  read source directly
        │ yes
        ▼
  doc-canon code-index search <symbol> --root <vcs root>
        │
        ├── missing index ──►  build hint (code_index_missing) → then source
        ├── stale index ──►   warning (code_index_stale) → still use pack
        ├── hits (fresh) ──►  read snippet windows (bounded)
        ├── thin hits ──►     read source as evidence + note code_miss
        └── no hits ──►       read source as evidence + note code_miss
        │
        ▼
  proceed with analysis; source remains the grounding evidence
```

**Invariants**

- The rule is guidance, not a hard CLI gate: nothing in `doc-canon` blocks or requires agent behavior
- Quality over thrift: expand-when-thin is preserved; a thin probe never licenses under-reading
- The miss is visible (reported), mirroring the canon's Expand gate discipline
- Global across the five covered languages; no per-language special cases
- `canon-bootstrap` and `canon-audit` build indexes first and prefer index search for their goals when indexes exist
- The token-cost guard is a real test over a fixture repo, not a comment or doc claim

## Components

| Module | Role |
| --- | --- |
| `embedded/agents/AGENTS.block.md` | Add one short sentence: during code analysis, try `doc-canon code-index search` first; on empty/thin results read source and note the miss. Short pointer stays short |
| `embedded/rules/doc-canon.mdc` | New `## Code analysis order` section: code-index-first, global for covered languages, expand-when-thin, miss reporting (`code_miss: <query> -> source:<path>`), stale/missing index handling mirrors the CLI warnings |
| `docs/canon/SKILLS.md` | Agent recipe: add code-analysis discipline (index-first, miss reporting) to the dual-audience recipe paragraph |
| `docs/canon/GLOSSARY.md` | Terms: `code_miss` (miss-reporting), covered-language list note if not already present |
| `docs/canon/OVERVIEW.md` | Audience/scope note: code-index-first analysis for covered languages, source fallback for uncovered |
| `embedded/skills/canon-bootstrap/SKILL.md` (+ dual-written `.cursor`/`.claude` copies) | Index-first step: after init/canon writes, build `doc-canon index` and `doc-canon code-index build` (when covered source exists); subsequent steps use index search when available |
| `embedded/skills/canon-audit/SKILL.md` (+ dual-written copies) | Index-first: ensure indexes are built, then drive Scout/evidence via `doc-canon search` / `code-index search` first; code divergence evidence uses the code index probe |
| `tests/code-analysis-token-guard.test.ts` | Fixture repo (`.git`, `package.json`, several large TS files); build index; search a symbol; assert pack snippet bytes < full source bytes |
| `tests/embedded-assets.test.ts` (or new rule-scenario file) | Assert `AGENTS.block.md` and `doc-canon.mdc` contain the code-index-first rule + `code_miss`; assert a copied target repo receives it via `copyManagedAssets` |

### Rule text (embedded content)

`embedded/agents/AGENTS.block.md` gains one sentence appended to the existing block:

> For code analysis, try `doc-canon code-index search` first (covered languages); on empty/thin results, read source and note the miss (`code_miss`).

`embedded/rules/doc-canon.mdc` gains a section:

```markdown
## Code analysis order

For code analysis in a covered language (TypeScript/JavaScript, Go, C#, Rust, Python), try `doc-canon code-index search <symbol> --root <repo>` before reading whole source files. Use the bounded snippet windows as the first probe. When the probe returns nothing or a thin set — or the code index is missing/stale (see CLI warnings) — read the source files as evidence and note the miss (`code_miss: <query> -> source:<path>`). Quality over thrift: never let a thin probe license under-reading. Languages outside the covered set go straight to source.
```

## Data flow

1. Agent begins code analysis; decides whether the file/query is in a covered language (by extension: `.ts`, `.tsx`, `.js`, `.jsx`, `.go`, `.cs`, `.rs`, `.py`).
2. Covered: runs `doc-canon code-index search` (symbol or `--refs` mode). Reads the returned path/line/kind/snippet windows.
3. Pack empty / thin / index missing: reads source directly as grounding evidence and notes `code_miss`.
4. Analysis proceeds; the bounded pack keeps context small for the common case, source reads are the fallback evidence.

The miss note is agent-facing prose (a chat line or scratch note), not a CLI output field — nothing in `doc-canon` changes.

**Skill data flow (`canon-bootstrap`, `canon-audit`):**

1. `canon-bootstrap`: after `init` and canon writes, build the doc index (`doc-canon index`); when covered source exists, build the code index (`doc-canon code-index build`). Subsequent goal steps (refreshing `INDEX.md`, confirming structure) prefer `doc-canon search` when the index exists; when it does not, fall back to INDEX-first Scout per the existing recipe.
2. `canon-audit`: ensure the doc index exists (hint `doc-canon index` if missing — already in the Scout protocol), and when covered source is present and code divergence is in scope, ensure the code index exists (`doc-canon code-index build`). Drive Scout and evidence gathering through `doc-canon search` / `code-index search` first; the search-first step already heads the audit flow and gains the explicit build-first prerequisite.
3. Both skills treat a missing index as a build-first signal, not a hard stop — build when cheap and required, otherwise fall back to the existing INDEX-first Scout and note the miss.

## Error handling

| Situation | Agent behavior |
| --- | --- |
| Code index missing (`code_index_missing`) | Note the CLI's build hint, run `doc-canon code-index build`, retry the probe; if still nothing, read source and note `code_miss` |
| Code index stale (`code_index_stale`) | Note the warning, use the pack anyway, expand when thin |
| Probe returns nothing | Read source as evidence, note `code_miss: <query> -> source:<path>` |
| Probe returns a thin set | Expand: read source around the hits as evidence, note `code_miss` when the set is insufficient |
| Uncovered language | Go straight to source; no probe, no miss note required |

## Testing

**Token-cost guard** (`tests/code-analysis-token-guard.test.ts`): temp repo with `.git`, `package.json`, and 3–5 TS files of ~150–300 lines each with a searchable symbol. Build the index (`syncCodeIndex`), run `searchCodeIndex`, sum bytes of all `hits[].snippets[].text`, sum bytes of all source files in the repo, assert `packBytes < fullBytes`. The assertion is structural: the pack is capped by `maxHits`/`snippetLines`/`maxSnippetLinesTotal`, while files are large, so the inequality is robust and not brittle.

**Rule-scenario checks** (in `tests/embedded-assets.test.ts` or a new `tests/code-analysis-rules.test.ts`): assert `embedded/agents/AGENTS.block.md` matches `/code-index search/` and `/code_miss/`; assert `embedded/rules/doc-canon.mdc` contains `## Code analysis order`, `code-index search`, `code_miss`; assert a target repo created via `copyManagedAssets` receives both statements in `AGENTS.md` and `CLAUDE.md`; assert the `canon-bootstrap` and `canon-audit` skill sources (embedded + copied) reference build-first / index-search-first steps.

**Out of scope:** changes to `code-index` CLI behavior, index artifact shape, `searchCodeIndex` options, or the canon's doc Scout → Expand rules.

## Implementation order (after plan)

1. Canon-first: update `SKILLS.md`, `GLOSSARY.md`, `OVERVIEW.md` via `canon-write`; mark P2c **implementing** and point the initiative Design link at this spec via `canon-future-plan`.
2. Wait for explicit go-ahead after the substantial canon updates.
3. Implement managed content: `embedded/agents/AGENTS.block.md`, `embedded/rules/doc-canon.mdc`, `embedded/skills/canon-bootstrap/SKILL.md`, `embedded/skills/canon-audit/SKILL.md`; regenerate this repo's own `AGENTS.md` / `CLAUDE.md` / skill copies via `copyManagedAssets` (or run `upgrade-skills`).
4. Write the token-cost guard and rule-scenario tests.
5. Close with `canon-audit` on the affected topic; mark P2c **absorbed** via `canon-future-plan`.

## Relationship to prior artifacts

| Artifact | Role after this spec |
| --- | --- |
| `p2c-code-analysis-rules.md` initiative | Follow-up via `canon-future-plan`: Design link → this spec; open questions resolved (miss reporting / bounded-pack guard / global+fallback) |
| `2026-08-18-p2b-code-search-tools-design.md` | Shipped `code-index search` surface P2c consumes unchanged |
| `2026-08-18-p2a-code-ast-index-design.md` | Index + freshness machinery behind the surface P2c consumes |
| `docs/canon/SKILLS.md`, `GLOSSARY.md`, `OVERVIEW.md` | Living absorption targets (updated at implementation) |
| `embedded/agents/AGENTS.block.md`, `embedded/rules/doc-canon.mdc`, `embedded/skills/canon-bootstrap/SKILL.md`, `embedded/skills/canon-audit/SKILL.md` | Managed content edited by this spec; `copyManagedAssets` propagates to target repos |

## Open questions

None blocking design. Deferred to the implementation plan only:

- Whether the miss note should name the file that provided the grounding evidence in a specific format, or just the query — default: `code_miss: <query> -> source:<path>`

## Related

- [`docs/canon/future_plans/p2c-code-analysis-rules.md`](../../canon/future_plans/p2c-code-analysis-rules.md)
- [`docs/canon/future_plans/p2b-code-search-tools.md`](../../canon/future_plans/p2b-code-search-tools.md)
- [`docs/canon/future_plans/p2a-code-ast-index.md`](../../canon/future_plans/p2a-code-ast-index.md)
- [`2026-08-18-p2b-code-search-tools-design.md`](2026-08-18-p2b-code-search-tools-design.md)
- Living absorption targets: `SKILLS.md`, `GLOSSARY.md`, `OVERVIEW.md`
