# P13 — Search paths-only mode

- **Status:** draft
- **Focus:** A compact paths-only output for `doc-canon search` (and parity for
  `code-index search`), so Scout probes cost fewer tokens when snippets are not yet needed.
- **Depends on:** None (pure CLI-surface addition on the shipped search).
- **Unblocks:** Leaner working-set stubs in the Scout step of the managed skills.

## Intent

The Scout step runs `doc-canon search "<topic>"` mainly to learn *which* docs rank — snippet
windows become relevant only during Expand. Today every probe carries snippet text. A paths-only mode
prints the ranked paths (with scores) and nothing else, shrinking the first probe's token cost and
letting agents assemble working-set manifests without noise; snippets stay one flag away.

## In scope

- `doc-canon search --paths` (or `--no-snippets`): ranked paths (+ scores), no snippet windows.
- Parity consideration for `doc-canon code-index search` (same flag, code packs).
- Stable human and `--json` shapes for the paths-only form.

## Out of scope

- Changing default output or ranking; glossary expansion stays.
- Snippet-quality work (that is the existing search scoring).

## Absorbs into

`CLI.md` (`search` flags), `SKILLS.md` (Scout step 1), `GLOSSARY.md` (Context pack).

## Open questions

- Flag naming (`--paths` vs `--no-snippets`) and score inclusion by default.
- Whether code-index search mirrors the flag in the same release.
