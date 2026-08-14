# Changelog

## 0.1.1

- README and usage flows describe Cursor and Claude Code as default managed hosts (not Cursor-only)

## 0.1.0

First public release.

- CLI: `init`, `validate`, `check`, `report`, `upgrade-skills`, `index`, `search`, `migrate`
- Dual-write Cursor + Claude Code overlays
- Local BM25 `index` / `search`
- `doc-canon migrate` fills missing required canon files from the target contract, then runs `upgrade-skills`
