# Canon Contract

## Purpose

Fixture contract.

## How agents must use this file

Follow the machine contract.

## Machine contract

```yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - { id: index, path: INDEX.md, role: index, required: true, template: INDEX }
  - { id: overview, path: OVERVIEW.md, role: overview, required: true, template: OVERVIEW }
  - { id: architecture, path: ARCHITECTURE.md, role: architecture, required: true, template: ARCHITECTURE }
  - { id: glossary, path: GLOSSARY.md, role: glossary, required: true, template: GLOSSARY }
  - { id: discrepancies, path: DISCREPANCIES.md, role: discrepancies, required: true, template: DISCREPANCIES }
  - { id: contract, path: CANON_CONTRACT.md, role: contract, required: true, template: CANON_CONTRACT }
templates:
  - { id: INDEX, path: templates/INDEX.md }
  - { id: OVERVIEW, path: templates/OVERVIEW.md }
  - { id: ARCHITECTURE, path: templates/ARCHITECTURE.md }
  - { id: GLOSSARY, path: templates/GLOSSARY.md }
  - { id: DISCREPANCIES, path: templates/DISCREPANCIES.md }
  - { id: CANON_CONTRACT, path: templates/CANON_CONTRACT.md }
policies:
  max_lines: 400
  ignore: []
```

## Change policy

Update intentionally.
