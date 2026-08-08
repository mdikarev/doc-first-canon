# doc-canon

[English](#doc-canon) · [Русский](#doc-canon-ru)

Deterministic CLI for agent documentation canon: scaffold, validate, and report on structured docs under `docs/canon` with managed skills and rules.

## Install

From this repository (or after publish):

```bash
npm install
npm link   # optional: put doc-canon on PATH for local development
```

After install, `doc-canon` is available via `npx doc-canon` or the linked binary.

## Quick start flows

Short recipes. Full walkthroughs: [`docs/guides/usage-flows.md`](docs/guides/usage-flows.md).

### Empty project

1. Install and ensure `doc-canon` is on `PATH`
2. `doc-canon init --yes` (or interactive `doc-canon init`)
3. In Cursor, run skill `canon-bootstrap` (purpose/scope interview, fill canon)
4. `doc-canon validate` (must pass)

### Existing project

1. `doc-canon init` at the repo root (does not overwrite existing canon document content)
2. Run `canon-bootstrap` — extract-then-freeze; legacy docs are import sources only; application code is not edited
3. Confirm any proposed extra sections / contract changes when prompted
4. `doc-canon validate`

### Day-to-day

1. After meaningful code or canon edits, run `canon-write` to sync affected sections
2. `doc-canon check` — inventory + `.doc-canon/report.json`
3. On docs↔code drift, run `canon-audit` (`docs_stale` or `code_stale`)
4. Optionally `doc-canon report` to print the last report

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

---

<a id="doc-canon-ru"></a>

# doc-canon (RU)

[English](#doc-canon) · [Русский](#doc-canon-ru)

Детерминированный CLI для канона агентской документации: создание каркаса, валидация и отчёты по структурированным документам в `docs/canon` с управляемыми skills и rules.

## Установка

Из этого репозитория (или после публикации):

```bash
npm install
npm link   # опционально: добавить doc-canon в PATH для локальной разработки
```

После установки `doc-canon` доступен через `npx doc-canon` или через linked binary.

## Быстрый старт по флоу

Короткие рецепты. Подробные walkthrough: [`docs/guides/usage-flows.md`](docs/guides/usage-flows.md).

### Пустой проект

1. Установите и убедитесь, что `doc-canon` есть в `PATH`
2. `doc-canon init --yes` (или интерактивный `doc-canon init`)
3. В Cursor запустите skill `canon-bootstrap` (интервью purpose/scope, заполнение канона)
4. `doc-canon validate` (должно пройти)

### Существующий проект

1. `doc-canon init` в корне репозитория (не перезаписывает уже существующее содержимое канона)
2. Запустите `canon-bootstrap` — extract-then-freeze; legacy docs только как import sources; код приложения не редактируется
3. Подтвердите предложенные extra sections / изменения контракта, если спросят
4. `doc-canon validate`

### Повседневный цикл

1. После заметных правок кода или канона запустите `canon-write`, чтобы синхронизировать затронутые секции
2. `doc-canon check` — inventory + `.doc-canon/report.json`
3. При drift docs↔code запустите `canon-audit` (`docs_stale` или `code_stale`)
4. Опционально `doc-canon report`, чтобы напечатать последний отчёт

## Использование

Все команды принимают `--root <path>` (по умолчанию: текущая директория) для указания корня репозитория.

### init

Создаёт каркас `docs/canon/`, обязательные шаблоны, контракт по умолчанию и управляемые Cursor skills/rules/блок AGENTS.

```bash
doc-canon init
doc-canon init --root /path/to/repo
doc-canon init --force-skills   # обновить управляемые ассеты при повторном init
doc-canon init --yes             # неинтерактивные значения по умолчанию
```

### validate

Только валидация схемы и структуры (ненулевой код выхода при ошибках).

```bash
doc-canon validate
doc-canon validate --root /path/to/repo
```

### check

Валидация, построение языконезависимого инвентаря и запись `.doc-canon/report.json`.

```bash
doc-canon check
doc-canon check --root /path/to/repo
```

### report

Печать последнего `.doc-canon/report.json` в stdout.

```bash
doc-canon report
doc-canon report --root /path/to/repo
```

### upgrade-skills

Обновление управляемых skills, rules и блока AGENTS без изменения содержимого канона.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

## Agent skills

Управляемые skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`) вызывают subprocess `doc-canon`. **`doc-canon` должен быть в PATH** (например, через `npm link`, глобальную установку или `npm install -g .` в CI).

Отдельная упаковка для Claude Code планируется в следующем релизе; MVP ориентирован на Cursor skills и rules.

## Спецификация и acceptance

- Спецификация дизайна: [`docs/superpowers/specs/2026-08-07-doc-first-canon-design.md`](docs/superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Acceptance-сценарии skills: [`docs/acceptance/skill-scenarios.md`](docs/acceptance/skill-scenarios.md)

## Разработка

```bash
npm run build
npm test
node bin/doc-canon.js --help
```
