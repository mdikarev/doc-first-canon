# P14 — Always-on guidance: propagate scout-first to managed templates

- **Status:** draft
- **Focus:** Bring the always-on managed templates (`AGENTS.md` / `CLAUDE.md` / pointer rule)
  up to the scout-first protocol shipped by P10, so agents without canon skills probe with
  `doc-canon scout` instead of hand-building the working-set manifest from `doc-canon search`.
- **Depends on:** P10 (absorbed; scout-first protocol in `SKILLS.md` + `embedded/skills/**`),
  P7 (absorbed; introduced the search-first always-on wording this initiative updates).
- **Tracks:** `DISCREPANCIES.md` D-018 (open, `decision: code_stale`, finding `F-014`).
- **Unblocks:** Consistent scout-first guidance across the whole agent surface — skills, always-on
  blocks, and pointer rule — and closing D-018.

## Intent

P10 absorbed a scout-first Scout protocol into the canon skills (`SKILLS.md` Scout retrieval
protocol, `embedded/skills/canon-write|canon-audit|canon-bootstrap/SKILL.md`) and the canon docs
(`CLI.md`, `GLOSSARY.md`, `ARCHITECTURE.md`), but deliberately left the always-on managed
templates out of scope: `embedded/agents/AGENTS.block.md`, `embedded/rules/doc-canon.mdc`, and the
shipped `AGENTS.md` / `CLAUDE.md` copies still prescribe search-first ("Search first — it is
mandatory … run `doc-canon search "<topic>"` … Build a small working set"). That gap is tracked as
D-018 (`code_stale`). This initiative propagates the scout-first wording to the always-on surface
with the same soft-coupling discipline P3 established (managed-content changes bump
`SKILLS_STAMP` and are propagated by `upgrade-skills`).

## In scope

- Replace the search-first probe sentence in `embedded/agents/AGENTS.block.md` and
  `embedded/rules/doc-canon.mdc` with scout-first: run `doc-canon scout "<topic>"`, use the
  returned working-set manifest (ranked paths, contract roles, snippet stubs, verdict hint); scout
  seeds the code pack automatically when a code index exists, docs-only otherwise; fall back to
  `doc-canon search` / INDEX only when scout fails closed, noting `doc_miss` / `code_miss` for
  reads outside the pack.
- Refresh the shipped `AGENTS.md` / `CLAUDE.md` copies and bump `SKILLS_STAMP`
  (`upgrade-skills` propagates to all harnesses), per the P3 soft-coupling rule.
- Keep `SKILLS.md`'s always-on description paragraph consistent with the updated blocks.
- Confirm the changed index files build and search as before (no search-engine behavior change).

## Out of scope

- Changing `search` / `code-index search` / `scout` command behavior, ranking, or pack shapes
  (P10 owns the command; this initiative only updates guidance text).
- Editing the canon skills' Scout protocol (`SKILLS.md`, `embedded/skills/**`) — already scout-first.
- The `future_plans/**` zone or `DISCREPANCIES.md` lifecycle rules (D-018 stays open until a later
  `canon-audit` confirms the code no longer diverges; this initiative is the code-side change that
  lets that happen).
- Inventing new guidance: any wording not already established by P10's protocol.

## Absorbs into

`SKILLS.md` (always-on description paragraph), `GLOSSARY.md` (Working set / Scout cross-refs if
the updated wording touches them), `ARCHITECTURE.md` (managed-assets block), `CHANGELOG.md`
(managed-content bump), `DISCREPANCIES.md` D-018 (moves to Resolved only after a later audit).

## Open questions

- Exact scout-first sentence for the compact `AGENTS.md` block vs the fuller `CLAUDE.md` /
  pointer-rule body — whether one shared sentence fits both or the compact block needs a shorter
  form (P7 precedent: both carry the same mandatory-gate wording).
- Whether the `doc-canon.mdc` pointer rule should also get a code-index-first sentence for analysis
  (P2c territory) or stay doc-focused (P14 default: doc-focused only).
