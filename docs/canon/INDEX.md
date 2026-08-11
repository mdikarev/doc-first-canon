# Canon Index

## How to use this canon

Start here for agent context about this repository (`doc-canon` / doc-first-canon). Treat `docs/canon/` as the source of truth for design and development context. Prefer these files over README, guides, and product design drafts when they disagree — escalate conflicts via `DISCREPANCIES.md` rather than silently merging.

## Reading order

1. [OVERVIEW.md](OVERVIEW.md) — why the project exists and MVP scope
2. [ARCHITECTURE.md](ARCHITECTURE.md) — layers, building blocks, flows
3. [CLI.md](CLI.md) — deterministic CLI surface
4. [SKILLS.md](SKILLS.md) — agent skills and invariants
5. [GLOSSARY.md](GLOSSARY.md) — shared terms
6. [DISCREPANCIES.md](DISCREPANCIES.md) — open conflicts and coding tasks
7. [CANON_CONTRACT.md](CANON_CONTRACT.md) — structural machine contract (when changing shape)

Required, but not behavioral SoT and not a development task tracker: [future_plans/INDEX.md](future_plans/INDEX.md) — directional post-MVP initiatives; refine separately, then absorb into living canon.

## Sections
| id | path | role | required |
| --- | --- | --- | --- |
| index | INDEX.md | index | true |
| overview | OVERVIEW.md | overview | true |
| architecture | ARCHITECTURE.md | architecture | true |
| glossary | GLOSSARY.md | glossary | true |
| discrepancies | DISCREPANCIES.md | discrepancies | true |
| contract | CANON_CONTRACT.md | contract | true |
| cli | CLI.md | section | true |
| skills | SKILLS.md | section | true |
| future-plans-index | future_plans/INDEX.md | section | true |

## Discrepancies

Track grounded conflicts in [DISCREPANCIES.md](DISCREPANCIES.md). Use `canon-audit` for resolve dialogue. `doc-canon check` never edits that file. Apply order: successful apply → set `decision` → then Open→Resolved when appropriate.
