# P2b — Code search tools

- **Status:** implementing
- **Focus:** A CLI search interface over the P2a code AST index: query by symbol name, type, file, and cross-symbol references; emit bounded results (path/line/kind/short snippet) rather than whole files; freshness policy at search time.
- **Depends on:** P2a (code AST index construction)
- **Unblocks:** P2c (code analysis rules) — rules can only require index-first analysis once search exists
- **Design:** [`docs/superpowers/specs/2026-08-18-p2b-code-search-tools-design.md`](../../superpowers/specs/2026-08-18-p2b-code-search-tools-design.md) — SoT for the `code-index search` surface

## Intent

The P2a code AST index is inert without a way to probe it. This initiative adds the CLI search interface agents use during code analysis: query the index by symbol, type, file, or references, and get bounded results with path/line/kind/snippet windows instead of whole files. At search time the code index's freshness is enforced: a stale code index warns, a missing code index fails closed with a hint to build it (P2a). This is the code-side analogue of `doc-canon search`, but over the code AST index, not the canon documentation index — `doc-canon search` stays documentation-only.

## In scope

- CLI search over the code index: query by symbol name, type, file, and cross-symbol references where the index carries them
- Bounded results: path/line/kind/short snippet windows, not whole files
- Freshness policy at search time: stale code index warns; missing code index fails closed with a hint to build it (the builder is P2a)
- Tests: search round-trips over a built index

## Out of scope

- Index construction, extractors, and freshness machinery (P2a)
- Agent / skill rules for code-index-first analysis (P2c)
- Editing source through the CLI; the index is read-only analysis substrate
- `doc-canon search` / canon BM25 index: documentation search is a separate artifact over `docs/canon/**`
- Embeddings / vector retrieval
- Git-diff analysis as the primary change signal

## Absorbs into

Likely: `CLI.md` (new code-search command, distinct from `search`), `ARCHITECTURE.md` (code-index retrieval path), `GLOSSARY.md` (result-window terms). Any doc↔code divergence introduced by the new command would be tracked via the normal `DISCREPANCIES.md` flow.

## Open questions

- Command shape and naming (e.g., `doc-canon code-search` vs. a subcommand), and whether it mirrors `doc-canon search`'s human-first / `--json` output split
- Whether the canon's reader-facade / pack-size policies (max hits, snippet lines, caps) transfer as-is to code search results
- How the search surface grows as P2c defines the agent-facing query vocabulary
