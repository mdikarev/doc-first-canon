# P6a-Rust — Rust code-refs member-access slice

- **Status:** draft
- **Focus:** Rust slice of P6: member-access call-site edges for local bindings initialized from `Type::new()` / `Type::default()` associated-function calls, syntactically — unblocks `--refs Type.method` for Rust.
- **Depends on:** P6 (TS/JS v1, absorbed) and P2a-Rust (Rust extractor, absorbed)
- **Unblocks:** `--refs Type.method` for Rust constructor-backed members

## Intent

Rust construction uses associated functions (`Type::new()`) rather than a `new` keyword. This slice extends the cheap syntactic tier: `let x = Type::new();` + `x.method()` emits a `Type.method`-named member-access edge when `Type` is same-file or an imported name. Requires the associated-function-call CST pattern (`scoped_identifier` callee in a `call_expression`).

## In scope

- `let`/`const` bindings initialized from `Type::new()` / `Type::new(...)` / `Type::default()` — `Type.method`-named edges
- Same-file types and imported names via the import edge map
- Determinism, hash-driven rebuild, schema and CodePack shape unchanged

## Out of scope

- Generic type params, trait-associated constructors, `Arc::new`/`Box::new` wrapping (object type differs from the wrapper)
- Name resolution / type inference; call graphs

## Absorbs into

Likely: `ARCHITECTURE.md`, `CLI.md`, `GLOSSARY.md` (member-access reference — Rust pattern).

## Open questions

- Whether `Arc::new(x)`, `Box::new(x)`, `Rc::new(x)` wrappers should resolve to the inner type — needs type info, likely out of v1
- Path-qualified calls (`mod::Type::new()`) and imported-path resolution
- Exact tree-sitter-rust node types — locked in extractor tests
