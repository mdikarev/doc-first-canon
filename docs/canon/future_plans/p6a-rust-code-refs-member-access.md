# P6a-Rust — Rust code-refs member-access slice

- **Status:** absorbed
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

Merged: `GLOSSARY.md` (`Member-access reference` term — Rust `Type::new()`/`Type::default()` associated-function-constructor pattern), `CLI.md` (`code-index search --refs Class.method` — Rust bindings), `ARCHITECTURE.md` (code AST index — Rust member-access edges), `CODE_INDEX.md` (Rust per-language row).

## Open questions

*Resolved by the design pass* (binding forms: `let`/`const` with a `call_expression` initializer whose `scoped_identifier` callee path is a simple `identifier` and name is `new`/`default`; `Type::new(...)` with args counts via the same form; same-file types and imported names via the import edge map — relative `use self::…` / `use super::…` item imports, crate-relative/bare/external-crate imports emit no edge; `Arc::new`/`Box::new`/`Rc::new` wrappers excluded (inner type needs type info); path-qualified `mod::Type::new()` has a non-`identifier` path → no edge; exact tree-sitter-rust CST shapes locked in extractor tests — `scoped_identifier[path, name]`, `field_expression[value, field]`).
