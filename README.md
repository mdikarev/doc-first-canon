# doc-canon

[English](#doc-canon) · [Русский](#doc-canon-ru)

Deterministic CLI for agent documentation canon: scaffold, validate, report, index, and search structured docs under `docs/canon` with managed skills for **Cursor** and **Claude Code**.

## Why

Ad-hoc agent docs drift from code, contradict each other, and diverge in shape when different LLMs edit them. Teams need a durable **canon**: what docs exist, how they are shaped, how they stay current, and how docs↔code conflicts are resolved with a human in the loop.

## Goals

1. Keep agent-facing project docs accurate, consistent, and non-contradictory.
2. Treat `docs/canon/` as the source of truth for agent context; when docs and code disagree, the user decides which is stale.
3. Let skills edit documentation automatically; never patch application code — emit tasks for coding agents instead.
4. Keep document structure stable across LLMs via in-repo templates and a per-project contract.
5. Ship Cursor and Claude Code overlays by default; keep the CLI IDE-agnostic so additional agents can plug in later.

MVP does not include IDE UIs, automatic code patches, or CI/git hooks as the everyday sync trigger. Details: [`docs/canon/OVERVIEW.md`](docs/canon/OVERVIEW.md).

## Install

```bash
npm install -g doc-canon
# or one-shot:
npx doc-canon --help
```

From this repository (development):

```bash
npm install
npm link   # optional: put doc-canon on PATH for local development
```

## Quick start flows

Short recipes. Full walkthroughs: [`docs/guides/usage-flows.md`](docs/guides/usage-flows.md).

### Empty project

1. Install and ensure `doc-canon` is on `PATH`
2. `doc-canon init --yes` (or interactive `doc-canon init`)
3. In Cursor or Claude Code, run skill `canon-bootstrap` (purpose/scope interview, fill canon)
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

Scaffold `docs/canon/`, mandatory templates, default contract, and managed Cursor + Claude overlays (`.cursor/skills`, `.claude/skills`, `.cursor/rules/doc-canon.mdc`, short `AGENTS.md` block, full-body `CLAUDE.md`).

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

### discipline

Report probe discipline: reads `.doc-canon/probe-log.jsonl` (last doc/code probe age, probe count) plus the index manifests (files changed since each probe). Exits ≠0 when an index exists and relevant files changed after the last probe of that kind (un-probed state). Missing index or never-probed fresh clone → not-applicable, exit 0.

```bash
doc-canon discipline
doc-canon discipline --root /path/to/repo
doc-canon discipline --json
```

### upgrade-skills

Refresh managed skills, Cursor rule, `AGENTS.md`, and `CLAUDE.md` overlays without touching canon content. Also migrates existing repos onto the required `future_plans/INDEX.md` skeleton when missing.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

### migrate

Bring an **existing** canon up to this CLI: create missing required files/templates listed in **that repo’s** `CANON_CONTRACT.md`, add missing INDEX Sections rows, then run `upgrade-skills`. Does not rewrite section prose and does not add default sections the contract omitted. Empty repos should use `init`, not `migrate`.

```bash
# global install (doc-canon on PATH):
doc-canon migrate
doc-canon migrate --root /path/to/repo

# one-shot npx (no global install):
npx doc-canon migrate --root .
```

### When to use upgrade-skills vs migrate

- After **`npm install -g doc-canon@…`**: run **`doc-canon migrate`** on each target repo.
- After a **one-shot `npx doc-canon@…`**: run **`npx doc-canon migrate --root .`** (bare `doc-canon` is not on PATH).
- If the contract is already `schema_version: 1` and you only need managed overlays / `skills_stamp`: **`upgrade-skills`** is enough.
- `schema_version` other than `1` fails closed; this CLI does not rewrite contract YAML.

Soft coupling: changes to managed skills/rules bump **both** npm version and `skills_stamp`. A CLI-only bugfix may bump npm patch without a stamp bump. Validate still fails closed on a too-old stamp (`upgrade-skills` / `migrate` to refresh).

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

Search the existing BM25 index and print a bounded context pack (ranked paths, scores, live-file snippets). A stale index is self-healed at the CLI layer when no watch owns it (rebuild then serve, `auto_reindexed` warning); with a live watch, stale is served with exit 0 and an `index_stale` warning. Missing/corrupt index → exit ≠0 with a hint to run `doc-canon index`. Every successful search appends a line to `.doc-canon/probe-log.jsonl`.

```bash
doc-canon search "CLI commands"
doc-canon search "working set" --json
doc-canon search "BM25" --max-hits 5 --snippet-lines 6
doc-canon search "topic" --root /path/to/repo
```

### code-index build

Build or refresh the local AST index over the project's discovered source roots (writes `.doc-canon/code-index-manifest.json` and `.doc-canon/code-ast-index.json`). Covers TypeScript/JavaScript, Go, C#, Rust, and Python via pinned tree-sitter WASM grammars. One-shot exits non-zero if a watch process is already running. Same `--watch` / `--interval` / `--stop` discipline as `index`, with a separate watch pid.

```bash
doc-canon code-index build
doc-canon code-index build --root /path/to/repo
doc-canon code-index build --watch                 # poll and keep the index in sync (default 2000 ms)
doc-canon code-index build --watch --interval 500  # custom poll interval (ms, min 200)
doc-canon code-index build --stop                  # stop a running watch process
```

### code-index search

Search the code AST index and print a bounded code pack (symbol or syntactic-reference hits with live-file snippets). A stale index is self-healed at the CLI layer when no watch owns it (rebuild then serve, `auto_reindexed` warning); with a live watch, stale is served with exit 0 and a `code_index_stale` warning. Missing/corrupt index → exit ≠0 with a hint to run `doc-canon code-index build`. Every successful search appends a line to `.doc-canon/probe-log.jsonl`.

**Symbol mode** (positional query): every query token must be a case-insensitive substring of the symbol `name` (or, falling back, the `signature`). Ordering: exact name > name prefix > name tokens > signature tokens, tie-break file then line. Filters `--kind <type>` and `--file <glob>` narrow the scan; `--body` widens the snippet window to the symbol's `endLine` (symbol mode only).

**Refs mode** (`--refs <name>`): exact, case-sensitive match over syntactic references — `anchor` (same-file usage), `import` (cross-file edges, incl. call-site edges and `Class.method` member-access edges for `new Type()`-initialized bindings), and `binding` (in-scope locals).

```bash
doc-canon code-index search "searchCanon"               # symbol mode: find the declaration
doc-canon code-index search "search code index"          # multi-token: every token matches name/signature
doc-canon code-index search --refs "searchCanon"         # refs mode: import + call-site edges
doc-canon code-index search --refs "Reader.score"        # member-access edge (Class.method)
doc-canon code-index search "Reader" --kind class        # filter by symbol kind
doc-canon code-index search "search" --file "src/**"     # filter by file glob
doc-canon code-index search "searchCanon" --body         # widen symbol-mode window to endLine
doc-canon code-index search --refs "searchCanon" --json  # machine-readable pack
doc-canon code-index search "Reader" --max-hits 5 --snippet-lines 6
doc-canon code-index search "topic" --root /path/to/repo
```

## Agent skills

Managed skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`) invoke `doc-canon` subprocesses. **`doc-canon` must be on PATH** (e.g. via `npm link`, global install, or CI `npm install -g .`).

`init` / `upgrade-skills` install identical skill trees under `.cursor/skills/` and `.claude/skills/`. Cursor always-on guidance is `.cursor/rules/doc-canon.mdc` plus the short `AGENTS.md` block; Claude Code uses full pointer-rule body in `CLAUDE.md` and does **not** load `.cursor/rules/`.

## Adopter CI

Recommended gate is `doc-canon validate` (structure only). `check` is optional. Do **not** fail CI on open `DISCREPANCIES.md` entries.

```yaml
# example for an adopter repository — not used in the doc-canon repo itself
name: canon
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g doc-canon
      - run: doc-canon validate
```

## Spec and acceptance

- Design spec: [`docs/superpowers/specs/2026-08-07-doc-first-canon-design.md`](docs/superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Skill acceptance scenarios: [`docs/acceptance/skill-scenarios.md`](docs/acceptance/skill-scenarios.md)

## Development

```bash
npm run build
npm test
node bin/doc-canon.js --help
DRY_RUN=1 npm run release    # test, build, validate, pack-check; no publish
# a real `npm run release` also creates and pushes a `v<version>` git tag
```

---

<a id="doc-canon-ru"></a>

# doc-canon (RU)

[English](#doc-canon) · [Русский](#doc-canon-ru)

Детерминированный CLI для канона агентской документации: создание каркаса, валидация, отчёты, индекс и поиск по структурированным документам в `docs/canon` с управляемыми skills для **Cursor** и **Claude Code**.

## Зачем

Ad-hoc документация для агентов устаревает относительно кода, противоречит сама себе и расходится по форме, когда её правят разные LLM. Командам нужен устойчивый **канон**: какие документы есть, какой у них shape, как они остаются актуальными и как конфликты docs↔code разрешаются с человеком в контуре.

## Цели

1. Держать проектную документацию для агентов точной, согласованной и без внутренних противоречий.
2. Считать `docs/canon/` источником истины для агентского контекста; при расхождении docs и кода пользователь решает, что устарело.
3. Дать skills автоматически править документацию; никогда не патчить код приложения — вместо этого писать задачи для coding-агентов.
4. Держать структуру документов стабильной между разными LLM через шаблоны в репозитории и per-project контракт.
5. Поставлять оверлеи Cursor и Claude Code по умолчанию; CLI оставить IDE-agnostic, чтобы позже подключать других агентов.

В MVP нет IDE UI, автоматических патчей кода и CI/git hooks как повседневного триггера синхронизации. Подробности: [`docs/canon/OVERVIEW.md`](docs/canon/OVERVIEW.md).

## Установка

```bash
npm install -g doc-canon
# или одноразово:
npx doc-canon --help
```

Из этого репозитория (разработка):

```bash
npm install
npm link   # опционально: добавить doc-canon в PATH для локальной разработки
```

## Быстрый старт по флоу

Короткие рецепты. Подробные walkthrough: [`docs/guides/usage-flows.md`](docs/guides/usage-flows.md).

### Пустой проект

1. Установите и убедитесь, что `doc-canon` есть в `PATH`
2. `doc-canon init --yes` (или интерактивный `doc-canon init`)
3. В Cursor или Claude Code запустите skill `canon-bootstrap` (интервью purpose/scope, заполнение канона)
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

Создаёт каркас `docs/canon/`, обязательные шаблоны, контракт по умолчанию и управляемые оверлеи Cursor + Claude (`.cursor/skills`, `.claude/skills`, `.cursor/rules/doc-canon.mdc`, короткий блок `AGENTS.md`, полный body в `CLAUDE.md`).

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

### discipline

Отчёт о дисциплине поиска (probe discipline): читает `.doc-canon/probe-log.jsonl` (возраст последнего doc/code probe, число probe) плюс манифесты индексов (файлы, изменённые после каждого probe). Завершается с кодом ≠0, когда индекс существует и релевантные файлы изменились после последнего probe этого вида (un-probed состояние). Нет индекса или свежий клон без probe → not-applicable, exit 0.

```bash
doc-canon discipline
doc-canon discipline --root /path/to/repo
doc-canon discipline --json
```

### upgrade-skills

Обновление управляемых skills, Cursor rule, `AGENTS.md` и `CLAUDE.md` без изменения содержимого канона. Также мигрирует существующие репозитории на обязательный каркас `future_plans/INDEX.md`, если его ещё нет.

```bash
doc-canon upgrade-skills
doc-canon upgrade-skills --root /path/to/repo
```

### migrate

Подтянуть **существующий** канон до этого CLI: создать отсутствующие обязательные файлы/шаблоны, перечисленные в `CANON_CONTRACT.md` **целевого** репозитория, добавить отсутствующие строки Sections в INDEX, затем выполнить `upgrade-skills`. Не переписывает прозу секций и не добавляет секции по умолчанию, которых нет в контракте. Пустые репозитории должны использовать `init`, а не `migrate`.

```bash
# глобальная установка (doc-canon в PATH):
doc-canon migrate
doc-canon migrate --root /path/to/repo

# one-shot npx (без глобальной установки):
npx doc-canon migrate --root .
```

### Когда использовать upgrade-skills vs migrate

- После **`npm install -g doc-canon@…`**: запускайте **`doc-canon migrate`** в каждом целевом репозитории.
- После **one-shot `npx doc-canon@…`**: запускайте **`npx doc-canon migrate --root .`** (голый `doc-canon` не в PATH).
- Если контракт уже `schema_version: 1` и нужны только управляемые оверлеи / `skills_stamp`: достаточно **`upgrade-skills`**.
- `schema_version` отличный от `1` завершается fail-closed; этот CLI не переписывает YAML контракта.

Мягкая связка: изменения управляемых skills/rules поднимают **и** npm-версию, **и** `skills_stamp`. Багфикс только CLI может поднять npm patch без bump stamp. Validate по-прежнему fail-closed на слишком старом stamp (`upgrade-skills` / `migrate`, чтобы обновить).

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

Поиск по существующему BM25-индексу и печать ограниченного context pack (ранжированные пути, scores, сниппеты из живых файлов). Устаревший индекс самовосстанавливается на уровне CLI, когда его не держит watch (пересборка и выдача с предупреждением `auto_reindexed`); при живом watch устаревший индекс отдаётся с exit 0 и предупреждением `index_stale`. Нет/битый индекс → exit ≠0 с подсказкой `doc-canon index`. Каждый успешный поиск дописывает строку в `.doc-canon/probe-log.jsonl`.

```bash
doc-canon search "CLI commands"
doc-canon search "working set" --json
doc-canon search "BM25" --max-hits 5 --snippet-lines 6
doc-canon search "topic" --root /path/to/repo
```

### code-index build

Сборка или обновление локального AST-индекса по обнаруженным source-roots проекта (пишет `.doc-canon/code-index-manifest.json` и `.doc-canon/code-ast-index.json`). Покрывает TypeScript/JavaScript, Go, C#, Rust и Python через закреплённые tree-sitter WASM-грамматики. One-shot завершается с ненулевым кодом, если уже запущен watch. Та же дисциплина `--watch` / `--interval` / `--stop`, что и у `index`, но с отдельным watch-pid.

```bash
doc-canon code-index build
doc-canon code-index build --root /path/to/repo
doc-canon code-index build --watch                 # опрос и поддержание индекса (по умолчанию 2000 мс)
doc-canon code-index build --watch --interval 500  # свой интервал опроса (мс, мин. 200)
doc-canon code-index build --stop                  # остановить запущенный watch
```

### code-index search

Поиск по кодовому AST-индексу и печать ограниченного code pack (хиты по символам или синтаксическим ссылкам со сниппетами из живых файлов). Устаревший индекс самовосстанавливается на уровне CLI, когда его не держит watch (пересборка и выдача с предупреждением `auto_reindexed`); при живом watch устаревший индекс отдаётся с exit 0 и предупреждением `code_index_stale`. Нет/битый индекс → exit ≠0 с подсказкой `doc-canon code-index build`. Каждый успешный поиск дописывает строку в `.doc-canon/probe-log.jsonl`.

**Symbol-режим** (позиционный запрос): каждый токен запроса должен быть case-insensitive подстрокой имени символа `name` (или, как запасной вариант, `signature`). Ранжирование: точное имя > префикс имени > токены в имени > токены в сигнатуре, tie-break по файлу, затем строке. Фильтры `--kind <type>` и `--file <glob>` сужают сканирование; `--body` расширяет сниппет-окно до `endLine` символа (только symbol-режим).

**Refs-режим** (`--refs <name>`): точное, case-sensitive совпадение по синтаксическим ссылкам — `anchor` (использование в том же файле), `import` (межфайловые эджи, включая call-site эджи и member-access эджи `Class.method` для привязок из `new Type()`), и `binding` (локальные переменные в области видимости).

```bash
doc-canon code-index search "searchCanon"               # symbol-режим: найти объявление
doc-canon code-index search "search code index"          # мультитокенный: каждый токен матчится в name/signature
doc-canon code-index search --refs "searchCanon"         # refs-режим: import + call-site эджи
doc-canon code-index search --refs "Reader.score"        # member-access эдж (Class.method)
doc-canon code-index search "Reader" --kind class        # фильтр по виду символа
doc-canon code-index search "search" --file "src/**"     # фильтр по glob файла
doc-canon code-index search "searchCanon" --body         # расширить окно symbol-режима до endLine
doc-canon code-index search --refs "searchCanon" --json  # машиночитаемый pack
doc-canon code-index search "Reader" --max-hits 5 --snippet-lines 6
doc-canon code-index search "topic" --root /path/to/repo
```

## Agent skills

Управляемые skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`, `canon-future-plan`) вызывают subprocess `doc-canon`. **`doc-canon` должен быть в PATH** (например, через `npm link`, глобальную установку или `npm install -g .` в CI).

`init` / `upgrade-skills` ставят одинаковые деревья skills в `.cursor/skills/` и `.claude/skills/`. Always-on для Cursor — `.cursor/rules/doc-canon.mdc` и короткий блок `AGENTS.md`; Claude Code читает полный body pointer-rule из `CLAUDE.md` и **не** загружает `.cursor/rules/`.

## CI для adopter-репозитория

Рекомендуемый gate — `doc-canon validate` (только структура). `check` опционален. **Не** валите CI из-за открытых записей в `DISCREPANCIES.md`.

```yaml
# пример для adopter-репозитория — в самом репозитории doc-canon не используется
name: canon
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g doc-canon
      - run: doc-canon validate
```

## Спецификация и acceptance

- Спецификация дизайна: [`docs/superpowers/specs/2026-08-07-doc-first-canon-design.md`](docs/superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Acceptance-сценарии skills: [`docs/acceptance/skill-scenarios.md`](docs/acceptance/skill-scenarios.md)

## Разработка

```bash
npm run build
npm test
node bin/doc-canon.js --help
DRY_RUN=1 npm run release    # test, build, validate, pack-check; без publish
# реальный `npm run release` также создаёт и пушит git-тег `v<version>`
```
