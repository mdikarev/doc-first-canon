# doc-canon

Deterministic CLI for agent documentation canon: scaffold, validate, and report on structured docs under `docs/canon` with managed skills and rules.

## Install

From this repository (or after publish):

```bash
npm install
npm link   # optional: put doc-canon on PATH for local development
```

After install, `doc-canon` is available via `npx doc-canon` or the linked binary.

## Usage

All commands accept `--root <path>` (default: current directory) to target a repo root.

### init

Scaffold `docs/canon/`, mandatory templates, default contract, and managed Cursor skills/rules/AGENTS block.

```bash
doc-canon init
doc-canon init --root /path/to/repo
doc-canon init --force-skills   # refresh managed assets on re-init
doc-canon init --yes             # non-interactive defaults
```

### validate

Schema and structure validation only (exit non-zero on errors).

```bash
doc-canon validate
doc-canon validate --root /path/to/repo
```

### check

Validate, build a language-agnostic inventory, and write `.doc-canon/report.json`.

```bash
doc-canon check
doc-canon check --root /path/to/repo
```

### report

Print the last `.doc-canon/report.json` to stdout.

```bash
doc-canon report
doc-canon report --root /path/to/repo
```

### upgrade-skills

Refresh managed skills, rules, and the AGENTS block without touching canon content.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

## Agent skills

Managed skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`) invoke `doc-canon` subprocesses. **`doc-canon` must be on PATH** (e.g. via `npm link`, global install, or CI `npm install -g .`).

Claude Code–specific packaging is planned for a later release; MVP targets Cursor skills and rules.

## Spec and acceptance

- Design spec: [`docs/superpowers/specs/2026-08-07-doc-first-canon-design.md`](docs/superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Skill acceptance scenarios: [`docs/acceptance/skill-scenarios.md`](docs/acceptance/skill-scenarios.md)

## Development

```bash
npm run build
npm test
node bin/doc-canon.js --help
```
