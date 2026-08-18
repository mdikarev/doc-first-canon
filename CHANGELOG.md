# Changelog

## 0.2.0

- Code AST index over discovered source roots: `code-index build` (tree-sitter WASM for TypeScript/JavaScript, Go, C#, Rust, Python; `--watch`/`--stop`) and `code-index search` (symbol mode with multi-token name/signature matching, `--kind`/`--file`/`--body`, and syntactic `--refs` mode incl. `Class.method` member-access edges for `new Type()`-initialized bindings)
- ESM `.js`-extension import resolution and call-site edges in the TS extractor
- Code-index-first analysis rules in managed assets (AGENTS block, pointer rule, canon skills) with `code_miss` miss reporting
- BM25 scoring quality: light EN/RU stemming, heading-token weights (1.5×), `future_plans/**` downweight, glossary-aware query expansion
- `SKILLS_STAMP` guard: managed-asset changes require a stamp bump
- Usage guides for `code-index build`/`search` in README (EN/RU) and canon CLI

## 0.1.1

- README and usage flows describe Cursor and Claude Code as default managed hosts (not Cursor-only)

## 0.1.0

First public release.

- CLI: `init`, `validate`, `check`, `report`, `upgrade-skills`, `index`, `search`, `migrate`
- Dual-write Cursor + Claude Code overlays
- Local BM25 `index` / `search`
- `doc-canon migrate` fills missing required canon files from the target contract, then runs `upgrade-skills`
