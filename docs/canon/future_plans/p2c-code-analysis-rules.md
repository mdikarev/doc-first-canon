# P2c — Code analysis rules for agents & skills

- **Status:** implementing
- **Design:** [`docs/superpowers/specs/2026-08-18-p2c-code-analysis-rules-design.md`](../../superpowers/specs/2026-08-18-p2c-code-analysis-rules-design.md) — SoT for the agent-facing code-analysis rules and the index-first skill discipline
- **Focus:** Managed `AGENTS.md` block / pointer rule and coding-agent guidance that require trying the P2b code search first during code analysis, preserving expand-when-thin behavior — plus a token-cost guard proving the index route reads fewer tokens than naive source reads.
- **Depends on:** P2a (code AST index), P2b (code search tools)
- **Unblocks:** Cheaper multi-file code analysis; consistent cross-language symbol lookup for coding agents

## Intent

The index and search tools are only worth their cost if agents actually use them. This initiative ships the rules: a managed `AGENTS.md` block / pointer rule and coding-agent guidance requiring code-index-first analysis, with expand-when-thin preserved — when the index returns nothing or a thin set, the agent may read source as evidence, mirroring the canon's Expand gate. A token-cost guard test locks in the payoff: a typical multi-file analysis via the index must read fewer tokens than naive source reads. The source files remain the evidence when a probe is thin or a claim needs grounding — quality over thrift.

## In scope

- Managed `AGENTS.md` block / pointer rule: try code search first during code analysis
- Coding-agent guidance with expand-when-thin behavior preserved
- Miss reporting: when a code-index search returns nothing or a thin set, the agent's fallback to source mirrors the canon's visible Expand gate
- Token-cost guard: test that a typical multi-file analysis via the index reads fewer tokens than naive source reads
- Tests: rule-scenario checks and the token-cost guard

## Out of scope

- Index construction (P2a) and CLI search tools (P2b)
- Replacing the canon Scout → Expand → Execute rules for documentation
- Git-diff analysis as the primary change signal
- Editing source through the index

## Absorbs into

Likely: `SKILLS.md` and the managed `AGENTS.md` block / pointer rule (code-index-first rule for analysis), `GLOSSARY.md` (miss-reporting terms), `OVERVIEW.md` (audience/scope note). Any doc↔code divergence introduced by the new rule would be tracked via the normal `DISCREPANCIES.md` flow.

## Open questions

- Rule strength: **miss reporting** — agent reads source but must note the miss (`code_miss: <query> -> source:<path>`), mirroring the canon's visible Expand gate (resolved in design)
- Token-cost guard: **bounded pack vs full files** on a fixture repo — structural comparison of snippet bytes vs full source bytes (resolved in design)
- Language scope: **global for the five covered languages**; uncovered languages go straight to source (resolved in design)
