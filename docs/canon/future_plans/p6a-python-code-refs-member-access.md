# P6a-Python — Python code-refs member-access slice

- **Status:** draft
- **Focus:** Python slice of P6: member-access call-site edges for local bindings initialized from `Type(...)` constructor calls, syntactically — unblocks `--refs Type.method` for Python.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Python (Python extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Python constructor-backed members

## Intent

Python has no `new` keyword; construction is a bare call `x = Type(...)`. Distinguishing a constructor call from any other call is not syntactic without type info. This slice proposes the limited syntactic rule: a binding whose initializer is a call whose callee is a capitalized, same-file-imported class name emits `Type.method` edges for its member usages. If the heuristic proves too noisy, the slice may scope down to imported names only.

## In scope

- `x = Type(...)` bindings where `Type` resolves to a same-file class or an imported name — `Type.method`-named edges
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Capitalization heuristics that cannot be grounded syntactically (a `Type` that is actually a function)
- Factory functions, `functools`, decorators, dynamic dispatch; name resolution / type inference

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — Python pattern).

## Open questions

- Whether the capitalized-callee heuristic is reliable enough or should be imported-names-only
- `from x import Type` alias handling in the Python extractor
- Exact tree-sitter-python node types — locked in extractor tests
