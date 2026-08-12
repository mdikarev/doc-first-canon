# Claude Code overlay (dual-write managed assets) — Design Spec

**Date:** 2026-08-12  
**Status:** Approved for implementation planning  
**Approach:** Dual-write in `copyManagedAssets` — always install Cursor + Claude overlays; no agent flags  
**Related initiative:** `docs/canon/future_plans/p3-production-hardening.md` (Claude distribution pack slice)

## Problem

`doc-canon` CLI is IDE-agnostic, but managed agent assets today target Cursor only (`.cursor/skills/`, `.cursor/rules/doc-canon.mdc`, `AGENTS.md`). Claude Code loads project skills from `.claude/skills/` and always-on guidance from `CLAUDE.md`; it does **not** read `.cursor/rules/*.mdc`. Canon and README still mark Claude packaging as deferred (P3).

## Goals

1. One `doc-canon init` / `upgrade-skills` prepares a repo for **both** Cursor and Claude Code — no `--agent` / `--claude` flag.
2. Identical skill trees under `.cursor/skills/` and `.claude/skills/` from `embedded/skills/**`.
3. Always-on parity for Claude via **`CLAUDE.md`**: full pointer-rule **body** (from `embedded/rules/doc-canon.mdc`, without Cursor YAML frontmatter), wrapped in managed markers.
4. Keep short managed block in **`AGENTS.md`** (unchanged role/content source: `embedded/agents/AGENTS.block.md`).
5. Keep Cursor rule install as today (`.mdc` with frontmatter).
6. Document the overlay model in living canon, README (EN/RU), and acceptance scenarios.
7. Existing Cursor-only repos migrate with a single `upgrade-skills` (and stamp bump).

## Non-goals

- Separate init flags or interactive “which IDE?” prompts
- Claude Code marketplace / plugin packaging
- IDE/plugin UI
- Different skill bodies per IDE (no Claude-specific SKILL.md forks)
- Symlinks between skill trees
- Making `validate` require presence of `.cursor/**`, `.claude/**`, `AGENTS.md`, or `CLAUDE.md` (same as today: stamp only, not overlay file presence)
- Agent packs / multi-IDE manifest framework (defer until a third host needs it)
- Changing CLI commands, search/index, or canon document schema

## Decisions

| Topic | Choice |
| --- | --- |
| Target hosts | Always both Cursor and Claude in one repo |
| Skills layout | Identical copy to `.cursor/skills/` and `.claude/skills/` |
| Claude always-on | Full pointer-rule body in `CLAUDE.md` (not the short AGENTS block) |
| Cursor always-on | Unchanged: `.cursor/rules/doc-canon.mdc` + short `AGENTS.md` block |
| Why not rely on `.mdc` for Claude | Claude Code does not load `.cursor/rules/` |
| Markers | Same `<!-- doc-canon:start -->` / `<!-- doc-canon:end -->` in `AGENTS.md` and `CLAUDE.md` |
| Malformed markers | Fail closed per file; error names the file |
| Missing `CLAUDE.md` | Create with managed block (same pattern as empty `AGENTS.md`) |
| Existing `CLAUDE.md` without markers | Append managed block at end |
| Validate overlay files | No — do not add IDE path checks to `validate` |
| Implementation shape | Extend `copyManagedAssets` / upsert helpers (Approach 1 dual-write) |
| Stamp | Bump `skills_stamp` / package stamp when overlay content or copy paths change |
| Canon updates | Via `canon-write` before application code (canon-first); absorb P3 Claude-pack wording |

## Architecture

```
embedded/
  skills/**          →  .cursor/skills/**  and  .claude/skills/**
  rules/doc-canon.mdc
      ├─ full file   →  .cursor/rules/doc-canon.mdc
      └─ body only   →  CLAUDE.md  (inside doc-canon markers)
  agents/AGENTS.block.md  →  AGENTS.md  (inside doc-canon markers)

CLI (unchanged surface): init | upgrade-skills | validate | …
```

Deterministic core stays host-agnostic. Host-specific behavior is only where each product loads skills and always-on memory.

## Behavior

### `init` / `upgrade-skills` / `--force-skills`

1. Copy `embedded/skills/**` → `.cursor/skills/` (existing).
2. Copy the same tree → `.claude/skills/` (new).
3. Copy `embedded/rules/doc-canon.mdc` → `.cursor/rules/doc-canon.mdc` (existing).
4. Upsert short block into `AGENTS.md` (existing).
5. Upsert **full rule body** into `CLAUDE.md` (new): strip YAML frontmatter from the embedded `.mdc`, wrap with start/end markers, then create / replace-between-markers / append.
6. On `upgrade-skills`, bump `skills_stamp` as today after managed refresh (+ any future_plans migration already owned by that command).

### Frontmatter strip

- Remove a leading YAML frontmatter fenced by `---` … `---` from the `.mdc` source before writing into `CLAUDE.md`.
- Preserve the markdown body (heading + policy text) unchanged.
- Do not invent Claude-specific frontmatter in `CLAUDE.md`.

### Marker integrity

- Reuse the well-formedness rule: exactly one start and one end, start before end.
- Apply independently to `AGENTS.md` and `CLAUDE.md`.
- Error messages must identify which file failed.

### `validate`

- No new checks for `.claude/**` or `CLAUDE.md` presence.
- Continue to enforce `skills_stamp` freshness only for managed-asset currency.

## Documentation deliverables

| Artifact | Update |
| --- | --- |
| `CLI.md` | Managed assets include Claude paths; Claude overlay no longer “deferred” for this slice |
| `SKILLS.md` | Covers Cursor + Claude packaging; Dependencies / Open questions |
| `ARCHITECTURE.md` | Agent layer = Cursor + Claude overlays; system-context table |
| `OVERVIEW.md` | Audience / out-of-scope: Claude pack delivered for dual-write; marketplace still out |
| `GLOSSARY.md` | Managed assets mention `.claude/skills` + `CLAUDE.md` |
| `future_plans/p3-…` | Narrow or note Claude dual-write absorbed / remaining P3 items |
| README EN/RU | Init installs both; Claude uses `.claude/skills` + `CLAUDE.md`; `.cursor/rules` is Cursor-only |
| Acceptance | `mvp-gate` / skill-scenarios assert Claude paths + `CLAUDE.md` full-body markers after init; upgrade migrates Cursor-only repos |

Coding agents must not edit `docs/canon/**` during implementation; use **`canon-write`** (and `canon-future-plan` if P3 initiative status changes).

## Testing

- Unit: dual skill copy (both trees match embedded).
- Unit: `CLAUDE.md` create / append / replace-between-markers / malformed markers.
- Unit: frontmatter strip leaves expected body; Cursor `.mdc` still written with frontmatter.
- Regression: `AGENTS.md` upsert unchanged.
- Acceptance checklist updates as above (manual gate scenarios).

## Error / edge cases

| Case | Behavior |
| --- | --- |
| `CLAUDE.md` malformed markers | Hard-fail managed copy; name `CLAUDE.md` |
| `AGENTS.md` malformed | Unchanged hard-fail for `AGENTS.md` |
| User edits outside markers in `CLAUDE.md` | Preserved on upgrade (replace only managed span) |
| User deletes `.claude/skills` | Not a validate error; fixed by `upgrade-skills` / `--force-skills` |
| Third IDE later | Out of scope; consider packs then |

## Success criteria

- Fresh `init --yes` yields both skill trees, Cursor rule, short `AGENTS.md` block, and full-body managed `CLAUDE.md`.
- `upgrade-skills` on a Cursor-only repo adds Claude overlay without wiping canon prose.
- No new CLI flags required for Claude.
- Living canon + README + acceptance describe the model, including that `.cursor/rules` does not apply to Claude.
- `doc-canon validate` still green without requiring overlay files on disk beyond existing stamp rules.

## Open questions (resolved in brainstorm)

| Question | Resolution |
| --- | --- |
| Flag vs universal? | Universal dual-write |
| `CLAUDE.md` short vs full? | Full pointer-rule body |
| Validate require overlay? | No |
| Skills copy vs symlink vs packs? | Identical dual copy |
