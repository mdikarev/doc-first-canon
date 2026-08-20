# P6a-Python — Python code-refs member-access slice

- **Status:** absorbed
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

Merged: `GLOSSARY.md` (`Member-access reference` term — Python bare-call constructor pattern), `CLI.md` (`code-index search --refs Class.method` — Python bindings), `ARCHITECTURE.md` (code AST index — Python member-access edges), `CODE_INDEX.md` (Python per-language row).

## Open questions

*Resolved by the design pass* (grounding rule: same-file `class` symbols count regardless of capitalization —
kind-grounded, rejecting functions; imported names require PascalCase `/^[A-Z][A-Za-z0-9_]*$/` since import
edges carry no kind; `from .module import Type` aliases canonicalized — the edge carries the canonical name;
attribute callees (`util.Reader()`), absolute/external imports, and factory functions get no edge; exact
tree-sitter-python CST shapes locked in extractor tests — `assignment[left, right=call]`,
`call[function=identifier]`, `attribute[object, attribute]`, `aliased_import[name=dotted_name, identifier]`).
