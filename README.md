# doc-canon

[English](#doc-canon) · [Русский](#doc-canon-ru)

Deterministic CLI for agent documentation canon: scaffold, validate, report, index, and search structured docs under `docs/canon` with managed skills and rules.

## Why

Ad-hoc agent docs drift from code, contradict each other, and diverge in shape when different LLMs edit them. Teams need a durable **canon**: what docs exist, how they are shaped, how they stay current, and how docs↔code conflicts are resolved with a human in the loop.

## Goals

1. Keep agent-facing project docs accurate, consistent, and non-contradictory.
2. Treat `docs/canon/` as the source of truth for agent context; when docs and code disagree, the user decides which is stale.
3. Let skills edit documentation automatically; never patch application code — emit tasks for coding agents instead.
4. Keep document structure stable across LLMs via in-repo templates and a per-project contract.
5. Ship Cursor first; keep the CLI IDE-agnostic so other agents can plug in later.

MVP does not include IDE UIs, automatic code patches, or CI/git hooks as the everyday sync trigger. Details: [`docs/canon/OVERVIEW.md`](docs/canon/OVERVIEW.md).

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

1. After meaningful code or canon edits, run `canon-write` to sync affected sections (skills reindex with `doc-canon index` after substantive canon writes)
2. `doc-canon check` — inventory + `.doc-canon/report.json`
3. On docs↔code drift, run `canon-audit` (`docs_stale` or `code_stale`)
4. Optionally `doc-canon report` to print the last report; agents/skills use `doc-canon search` for a bounded working set

## Usage

All commands accept `--root <path>` (default: current directory) to target a repo root. Behavior SoT: [`docs/canon/CLI.md`](docs/canon/CLI.md).

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

Refresh managed skills, rules, and the AGENTS block without touching canon content. Also migrates existing repos onto the required `future_plans/INDEX.md` skeleton when missing.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

### index

Build or refresh the local BM25 index over `docs/canon/**/*.md` (writes `.doc-canon/index-manifest.json` and `.doc-canon/bm25-index.json`). One-shot exits non-zero if a watch process is already running.

```bash
doc-canon index
doc-canon index --root /path/to/repo
doc-canon index --watch                 # poll and keep the index in sync (default 2000 ms)
doc-canon index --watch --interval 500  # custom poll interval (ms, min 200)
doc-canon index --stop                  # stop a running --watch process
```

### search

Search the existing BM25 index and print a bounded context pack (ranked paths, scores, live-file snippets). Does not auto-reindex. Missing/corrupt index → exit ≠0 with a hint to run `doc-canon index`. Stale index → exit 0 with an `index_stale` warning (stderr in human mode; Pack `warnings` / `freshness` with `--json`).

```bash
doc-canon search "CLI commands"
doc-canon search "working set" --json
doc-canon search "BM25" --max-hits 5 --snippet-lines 6
doc-canon search "topic" --root /path/to/repo
```

## Agent skills

Managed skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`) invoke `doc-canon` subprocesses. **`doc-canon` must be on PATH** (e.g. via `npm link`, global install, or CI `npm install -g .`).

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

Детерминированный CLI для канона агентской документации: создание каркаса, валидация, отчёты, индекс и поиск по структурированным документам в `docs/canon` с управляемыми skills и rules.

## Зачем

Ad-hoc документация для агентов устаревает относительно кода, противоречит сама себе и расходится по форме, когда её правят разные LLM. Командам нужен устойчивый **канон**: какие документы есть, какой у них shape, как они остаются актуальными и как конфликты docs↔code разрешаются с человеком в контуре.

## Цели

1. Держать проектную документацию для агентов точной, согласованной и без внутренних противоречий.
2. Считать `docs/canon/` источником истины для агентского контекста; при расхождении docs и кода пользователь решает, что устарело.
3. Дать skills автоматически править документацию; никогда не патчить код приложения — вместо этого писать задачи для coding-агентов.
4. Держать структуру документов стабильной между разными LLM через шаблоны в репозитории и per-project контракт.
5. Сначала Cursor; CLI оставить IDE-agnostic, чтобы позже подключать других агентов.

В MVP нет IDE UI, автоматических патчей кода и CI/git hooks как повседневного триггера синхронизации. Подробности: [`docs/canon/OVERVIEW.md`](docs/canon/OVERVIEW.md).

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

1. После заметных правок кода или канона запустите `canon-write`, чтобы синхронизировать затронутые секции (после substantive-правок канона skills делают `doc-canon index`)
2. `doc-canon check` — inventory + `.doc-canon/report.json`
3. При drift docs↔code запустите `canon-audit` (`docs_stale` или `code_stale`)
4. Опционально `doc-canon report`, чтобы напечатать последний отчёт; агенты/skills используют `doc-canon search` для ограниченного working set

## Использование

Все команды принимают `--root <path>` (по умолчанию: текущая директория) для указания корня репозитория. SoT по поведению: [`docs/canon/CLI.md`](docs/canon/CLI.md).

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

Обновление управляемых skills, rules и блока AGENTS без изменения содержимого канона. Также мигрирует существующие репозитории на обязательный каркас `future_plans/INDEX.md`, если его ещё нет.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

### index

Сборка или обновление локального BM25-индекса по `docs/canon/**/*.md` (пишет `.doc-canon/index-manifest.json` и `.doc-canon/bm25-index.json`). One-shot завершается с ненулевым кодом, если уже запущен watch.

```bash
doc-canon index
doc-canon index --root /path/to/repo
doc-canon index --watch                 # опрос и поддержание индекса (по умолчанию 2000 мс)
doc-canon index --watch --interval 500  # свой интервал опроса (мс, мин. 200)
doc-canon index --stop                  # остановить запущенный --watch
```

### search

Поиск по существующему BM25-индексу и печать ограниченного context pack (ранжированные пути, scores, сниппеты из живых файлов). Не делает auto-reindex. Нет/битый индекс → exit ≠0 с подсказкой `doc-canon index`. Устаревший индекс → exit 0 с сигналом `index_stale` (stderr в human-режиме; Pack `warnings` / `freshness` при `--json`).

```bash
doc-canon search "CLI commands"
doc-canon search "working set" --json
doc-canon search "BM25" --max-hits 5 --snippet-lines 6
doc-canon search "topic" --root /path/to/repo
```

## Agent skills

Управляемые skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`) вызывают subprocess `doc-canon`. **`doc-canon` должен быть в PATH** (например, через `npm link`, глобальную установку или `npm install -g .` в CI).

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
