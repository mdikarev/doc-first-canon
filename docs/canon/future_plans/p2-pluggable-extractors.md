# P2 — Pluggable extractors

- **Status:** draft
- **Focus:** Richer code-facing signals for audit/sync **without** putting multi-language AST in the CLI core.
- **Depends on:** Stable inventory + efficiency patterns (P0/P1); clear plugin/contract boundary
- **Unblocks:** Better docs↔code checks for typed ecosystems

## Intent

Allow optional extractors (signatures, imports, schemas) as **plugins or contract-declared adapters**. Default `doc-canon` remains language-agnostic; unknown repos keep working on path inventory alone.

## In scope

- Plugin or adapter interface for extractors
- Candidates: signature / AST-stripping maps, dependency/import graphs, schema extractors
- Findings merge into report/inventory extensions without breaking `schema_version` fail-closed rules
- Documentation of how skills consume extractor output

## Out of scope

- Shipping deep multi-language AST as the **primary** audit engine in core
- Automatic application-code patches
- Requiring extractors for `validate` to pass

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `CANON_CONTRACT.md` / policies, `GLOSSARY.md`, audit skill docs.

## Open questions

- Discovery: npm plugins vs in-repo scripts vs contract `extractors:` list
- Which languages are first-class examples (e.g. TypeScript only)
- How extractor staleness interacts with smart cache (P0)
