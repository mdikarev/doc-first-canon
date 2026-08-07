# Canon Contract
## Machine contract
```yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - { id: overview, path: OVERVIEW.md, role: overview, required: true, template: OVERVIEW }
templates:
  - { id: OVERVIEW, path: templates/OVERVIEW.md }
policies: { max_lines: 400, ignore: [] }
```
