# Canon Contract

## Machine contract

```yaml
schema_version: 1
cli_compat: ">=0.1.0"
skills_stamp: "0.1.0"
sections:
  - id: index
    path: INDEX.md
    role: index
    required: true
    template: INDEX
templates:
  - id: INDEX
    path: templates/INDEX.md
policies:
  max_lines: [unclosed
