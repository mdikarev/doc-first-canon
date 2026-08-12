# MVP Acceptance Gate

Date: 2026-08-08
CLI: built with `npm run build`, then invoked as `node bin/doc-canon.js`
Result: PASS

## Throwaway repositories

- Primary: `/tmp/doc-canon-mvp-a.9wlPf6`
- Isolation: `/tmp/doc-canon-mvp-b.as3Rij`

## Checklist results

1. **Build and bootstrap — PASS**
   - `npm run build` completed successfully.
   - `init --yes` produced a valid `docs/canon/` tree.
   - Five managed skills (including `canon-future-plan`) were present under both `.cursor/skills/` and `.claude/skills/`, plus `.cursor/rules/doc-canon.mdc`, short `AGENTS.md` block, and full-body managed `CLAUDE.md`.
   - An immediate `validate` returned `Canon is valid.`
   - *(Historical note: earlier MVP runs recorded four Cursor-only skills; checklist wording updated for dual-write overlay.)*
2. **Required and extra headings — PASS**
   - Renaming `## Purpose` in `OVERVIEW.md` made `validate` exit 1 with
     `OVERVIEW.md is missing required headings: Purpose`.
   - Restoring it and adding `## Optional notes` made `validate` succeed.
3. **Check artifacts and report merge — PASS**
   - `check` wrote `.doc-canon/inventory.json` and `.doc-canon/report.json`.
   - A seeded `source: skill` finding (`F-900`) remained unchanged after a second `check`.
4. **Discrepancy lifecycle instructions — PASS**
   - `embedded/skills/canon-audit/SKILL.md` requires the strict sequence
     `successful apply → set the decision → then move Open → Resolved`.
5. **Per-repository contract isolation — PASS**
   - A second initialized repository had its own contract.
   - Changing only its `policies.max_lines` from `400` to `123` left the primary
     repository at `400`, and the second repository still validated.

## Gaps

No product or specification gaps were found. The only interrupted run was caused
by the acceptance shell harness not capturing an expected nonzero status; the
same required-heading scenario was immediately rerun and passed.
