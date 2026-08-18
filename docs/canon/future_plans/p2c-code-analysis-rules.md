# P2c — Code analysis rules for agents & skills

- **Status:** draft
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

- Rule strength: when a code-index search returns nothing or a thin set, is the agent free to read source directly, or must it also report the miss (mirroring the canon's visible Expand gate)?
- Token-cost guard: how to measure "analysis via index reads fewer tokens" reliably in tests without brittle token-count assertions
- Whether rules apply per language or globally once extractors cover all five
