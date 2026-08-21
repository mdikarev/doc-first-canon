# P9 — CLI structured validate — Design Spec

SoT for the P9 initiative: validators return structured issues (\`{message, kind, paths, severity}\`)
instead of English message strings, \`doc-canon validate\` gains a machine-readable \`--json\` mode,
\`check\` maps issues to findings directly (no regex classification), and the managed skills gate
success on \`validate --json\`.

## Problem

\`src/validate/validate.ts\` carries a TODO: "Return structured validation issues (\`{ message, kind,
paths }\`) from each validator and remove English-message classification/parsing." Today
\`validateCanon\` returns \`{ok, errors: string[], warnings: string[]}\` where every validator pushes
English prose into \`errors\`/\`warnings\`. \`src/commands/check.ts\` then re-classifies those strings
with regexes — \`validationErrorKind\` matches /\blinks to missing\b/i to pick \`consistency\`
vs \`structure\`, and \`validationErrorPaths\` extracts \`.md\`-looking tokens with
/\b[^\s,;:()]+\.md\b/gi — so the finding's kind and paths are recovered by parsing prose that
was not written to be parsed. Agents and skills consume \`validate\` output the same way: read the
English text, guess the kind, extract paths. There is no machine-readable form of validation at all.

## Goals

- Validators produce structured issues with explicit \`kind\` and \`paths\` at the point of detection;
  the English-message regex classification in \`check\` is deleted.
- \`doc-canon validate --json\` emits a stable machine shape:
  \`{schema_version: 1, ok, issues: [{message, kind, paths, severity}]}\`, warnings included as
  \`severity: "warning"\` issues.
- Human-facing \`validate\` output stays byte-identical (regression-tested); exit codes 0/1 unchanged.
- Report finding ids stay stable: issue \`message\` text is byte-identical to today's strings and
  \`stableFindingId\` (sha256(kind \\0 paths \\0 summary)) is unchanged.
- Managed skills (canon-write, canon-audit, canon-bootstrap, canon-contract, canon-future-plan) gate
  success on \`doc-canon validate --json\` (exit 0 and no \`error\`-severity issues), with
  \`skills_stamp\` bumped and propagated via \`upgrade-skills\`.

## Non-goals

- Auto-repair of issues (that is P11).
- New validator rules or changed validation semantics — the set of what is checked is unchanged.
- Semantic audit judgements (owned by \`canon-audit\`, not the CLI).
- Changing the report finding lifecycle (\`status\`/\`stale\` marking stays \`canon-audit\`'s job).
- Changing finding id scheme, report schema, or \`discipline\` findings (they stay as-is in \`check\`).

## Decisions

- **Issue model** — new \`src/validate/types.ts\`:
  \`ValidationSeverity = "error" | "warning"\`;
  \`ValidationIssue = { message: string; kind: FindingKind; paths: string[]; severity:
  ValidationSeverity }\` (kind reuses \`FindingKind\` from \`src/report/types.ts\`; validators emit
  \`structure\` or \`consistency\`, never \`drift\`/\`conflict\`/\`discipline\` — those stay
  skill/check-owned); \`ValidationResult = { ok: boolean; issues: ValidationIssue[] }\`.
  \`ValidateResult\` \`{ok, errors, warnings}\` is replaced; human formatting moves to the command layer.
- **Validator refactor** — every push into \`errors[]\`/\`warnings[]\` in \`validate.ts\` (and the
  helpers \`resolveCanonFile\`, \`isFile\`, \`readTextFile\`, per-section checks, index agreement,
  future-plans zone, orphan and broken-link scans) becomes an issue. Message text is byte-identical.
  Kind/paths mapping:
  - contract missing/invalid/unreadable, skills_stamp format/too-old → \`structure\`,
    \`[CANON_CONTRACT.md]\`
  - section missing/not-a-file, unknown template, missing template, missing headings → \`structure\`,
    \`[section.path]\` or \`[template.path]\`
  - \`max_lines\` and \`max_line_length\` violations → \`warning\`, \`[section.path]\`
  - INDEX.md missing / index-agreement rows → \`structure\`, \`[INDEX.md]\`
  - future-plans zone violations → \`structure\`, affected path
  - orphan canon file → \`structure\`, \`[relative]\`
  - broken link → \`consistency\`, \`[sourcePath, href]\` (equals today's \`validationErrorPaths\`
    extraction, so finding \`paths\` stay identical)
- **CLI surface** — \`doc-canon validate --json\` prints the JSON to stdout; human mode unchanged
  (warnings/errors to stderr with prefixes, \`Canon is valid.\` to stdout); exit 0 when \`ok\`, else 1.
  \`--json\` writes no stderr noise beyond JSON (warnings are issues, not stderr lines).
- **check integration** — \`validationErrorKind\`/\`validationErrorPaths\` deleted; issues map directly
  to \`Finding {id: stableFindingId(kind, paths, message), kind, paths, summary: message,
  status: "open", source: "cli"}\`. Discipline findings from \`computeDisciplineState\` unchanged.
- **Skills + canon (canon-first, before code)** — embedded \`canon-*\` skills change their success
  gate from "run \`doc-canon validate\` and confirm it passes" to "run \`doc-canon validate --json\`;
  success only on exit 0 with zero \`error\`-severity issues"; \`SKILLS_STAMP\` 0.15.0 → 0.16.0 in
  \`src/version.ts\` and this repo's \`CANON_CONTRACT.md\`; living canon \`CLI.md\` (validate surface
  and \`--json\` contract), \`SKILLS.md\`, \`ARCHITECTURE.md\`, \`GLOSSARY.md\` (Validation issue
  term) updated via \`canon-write\` before application code.

## Testing

- Unit: per-check kind/paths/severity asserts (headings, links, orphan, contract, stamp, index
  agreement, future-plans, line-length warnings) over a fixtures repo.
- CLI: \`--json\` shape (\`schema_version\`, \`ok\`, \`issues\` array), exit codes, stdout/stderr split;
  human output byte-stable regression against captured output.
- check: findings carry the same kind/paths/summary as before (ids stable); discipline findings
  untouched.
- Managed assets: embedded-assets test (new skill text), skills-stamp guard, version-consistency,
  harness copy tests.

## Implementation order

1. \`canon-write\`: living canon (CLI.md, SKILLS.md, ARCHITECTURE.md, GLOSSARY.md) + embedded skills
   + \`skills_stamp\` 0.16.0 (stamp guard passes; \`upgrade-skills\` propagates).
2. User go-ahead after the substantial canon change.
3. Code: \`src/validate/types.ts\` → validator refactor → command layer (\`validate --json\`) →
   \`check.ts\` mapping → tests.
4. Closing \`canon-audit\` on the validate/CLI topic.
