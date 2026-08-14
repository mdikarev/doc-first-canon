# Usage flows

[English](#usage-flows) · [Русский](#usage-flows-ru)

Journey-oriented walkthroughs for `doc-canon`. For a command reference, see the [README](../../README.md).

**Preconditions (all flows):** Node.js ≥20; `doc-canon` on `PATH` (skills invoke it as a subprocess); Cursor for managed skills after `init`.

## Empty project

**When to use:** New or empty repository with no `docs/canon/` yet.

**CLI vs skill:** `doc-canon init` only scaffolds templates, default contract, managed Cursor skills/rules, and the `AGENTS.md` managed block. Interview and filling mandatory docs is `canon-bootstrap`.

### Steps

1. Install and put `doc-canon` on `PATH` (for example `npm install` + `npm link` from this repo, or a global install).
2. From the target repo root:

```bash
doc-canon init --yes
# or: doc-canon init
```

**Expected:** `docs/canon/` with default contract and templates; Cursor skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`); `.cursor/rules/doc-canon.mdc`; `AGENTS.md` managed block between `<!-- doc-canon:start -->` and `<!-- doc-canon:end -->`.

3. In Cursor, run skill **`canon-bootstrap`**. Answer the short purpose/scope interview. The skill fills mandatory documents and refreshes `INDEX.md`.
4. Confirm with:

```bash
doc-canon validate
```

**Expected:** `Canon is valid.` (or equivalent success message); exit code 0.

### Common mistakes

- Skills fail if `doc-canon` is not on `PATH`.
- Re-running `init` without `--force-skills` does not refresh managed skills/rules/AGENTS block.

## Existing project

**When to use:** Repository already has code and/or legacy docs (`README`, `docs/**`, `AGENTS.md`, etc.), and you want a canon SoT under `docs/canon/`.

**CLI vs skill:** Same scaffold via `init`. Extract-then-freeze (inventory, import from legacy docs, propose extras) is `canon-bootstrap`. Application code and legacy files outside `docs/canon/` are **not** edited.

### Steps

1. From the repo root:

```bash
doc-canon init
```

**Expected:** Canon scaffold + managed assets. If `docs/canon/` document content already exists, `init` does not overwrite that content.

2. Run **`canon-bootstrap`**. The skill inventories the repo, treats existing documentation as **import sources only**, may propose extra sections, and interviews as needed before updating the contract.
3. Confirm any proposed contract / extra section changes when asked.
4. After generation:

```bash
doc-canon validate
```

**Expected:** Valid canon; content frozen into `docs/canon/`; legacy docs remain as historical sources, not SoT.

### Common mistakes

- Treating pre-canon `docs/**` as still authoritative after bootstrap — after freeze, only `docs/canon/` is SoT.
- Expecting bootstrap to patch application code — it must not.

## Feature / behavior change

**When to use:** Intentional new or changed application behavior / public contract in a bootstrapped repo.

**CLI vs skill:** Living canon updates go through **`canon-write`**. Coding agents must not edit `docs/canon/**` themselves. Optional design/plan artifacts live outside the canon at a **project-chosen** path (not mandated by doc-canon).

### Steps

1. Classify exceptions: pure bugfix with intended behavior unchanged; Open `code_stale` task; non-behavioral edits — those skip this order.
2. Run **`canon-write`** so living canon reflects the desired behavior; confirm `doc-canon validate` passes under the skill.
3. If the change is large (multi-module, non-obvious design, or handoff), write or sync a project-local design/plan from the updated canon; otherwise skip.
4. After a **substantial** canon change, wait for explicit user go-ahead before coding; after spot sync, proceed.
5. Implement application code and tests against the canon (and optional plan).
6. Close with **`canon-audit`** on the affected topic (sibling sections and docs↔code); do not silently pick a side — use `DISCREPANCIES.md` when needed.

### Common mistakes

- Coding the feature first and treating canon as optional cleanup.
- Editing `docs/canon/**` from a coding agent instead of invoking `canon-write`.
- Skipping the wait-gate after substantial SoT changes.
- Skipping the closing **`canon-audit`** after feature code (spot write is not a full-canon sync).

## Day-to-day

**When to use:** After meaningful changes to application code or canon docs in an already-bootstrapped repo.

**CLI vs skill:** `canon-write` updates affected canon sections. `doc-canon check` builds inventory and writes `.doc-canon/report.json` (preserves `source: skill` findings). `canon-audit` handles docs↔code drift and discrepancy lifecycle. `doc-canon report` prints the last report.

This journey is post-hoc sync after meaningful edits and does not replace **Feature / behavior change** for intentional work.

### Steps

1. After meaningful edits, run **`canon-write`** so affected sections stay aligned with templates/contract.
2. Run:

```bash
doc-canon check
```

**Expected:** `.doc-canon/inventory.json` and `.doc-canon/report.json` refreshed for CLI findings.

3. If docs and code disagree, run **`canon-audit`**. Choose `docs_stale` (edit canon, validate, then resolve) or `code_stale` (write an Open coding task; do not edit application code from the skill).
4. Optionally:

```bash
doc-canon report
```

### Important

`doc-canon check` **never** edits `DISCREPANCIES.md` and does **not** move discrepancies Open→Resolved. Only **`canon-audit`** applies that lifecycle when appropriate (for `code_stale`, Resolved happens on a later audit after code was fixed outside the skill).

### Common mistakes

- Assuming `check` “closes” open discrepancies.
- Skipping `validate` after canon edits during a `docs_stale` resolution.

## Upgrade an existing canon

**When to use:** The installed CLI is newer than the target repo’s overlays/`skills_stamp`, or required files listed in the contract are missing.

**CLI vs skill:** `doc-canon migrate` (or `upgrade-skills` alone if you only need managed assets).

### Steps

1. Install the CLI (`npm install -g doc-canon` or a newer `npx`).
2. From the target repo root:

```bash
doc-canon migrate --root .
```

**Expected:** `Canon is valid.` (or equivalent success message); exit code 0. A second run must not rewrite planted section prose.

### Common mistakes

- Using `migrate` instead of `init` on a repo with no canon.
- Expecting `migrate` to bump `schema_version`.
- Failing CI on open discrepancies.

## Adopter CI

**When to use:** The adopter wants a PR gate.

**CLI vs skill:** Use `doc-canon validate` (structure only). `check` is optional. Never fail the gate on Open `DISCREPANCIES.md` entries.

### Steps

1. Copy the YAML example from the README **Adopter CI** section into the *adopter* repository (not this one).
2. Confirm the workflow runs `doc-canon validate` (optionally `check`) and does not fail on open discrepancies.

**Expected:** PRs are gated on structural validity only; open discrepancies do not fail the build.

### Common mistakes

- Failing CI because `DISCREPANCIES.md` has Open entries.

## Also see

- Design: [`../superpowers/specs/2026-08-07-doc-first-canon-design.md`](../superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Skill acceptance scenarios: [`../acceptance/skill-scenarios.md`](../acceptance/skill-scenarios.md)
- README command reference (including `upgrade-skills` and `migrate`) and Agent skills (`canon-contract`)

For refreshing managed skills without touching canon content, use `doc-canon upgrade-skills` (see README Usage). To bring an existing canon up to this CLI (missing required files/INDEX rows, then overlays), use `doc-canon migrate`. For new template kinds, use skill `canon-contract`.

---

<a id="usage-flows-ru"></a>

# Usage flows (RU)

[English](#usage-flows) · [Русский](#usage-flows-ru)

Пошаговые сценарии для `doc-canon`. Справочник команд — в [README](../../README.md).

**Предусловия (все флоу):** Node.js ≥20; `doc-canon` в `PATH` (skills вызывают его как subprocess); Cursor для управляемых skills после `init`.

## Пустой проект

**Когда использовать:** Новый или пустой репозиторий без `docs/canon/`.

**CLI vs skill:** `doc-canon init` только создаёт каркас шаблонов, контракт по умолчанию, управляемые Cursor skills/rules и блок в `AGENTS.md`. Интервью и заполнение обязательных документов — `canon-bootstrap`.

### Шаги

1. Установите и добавьте `doc-canon` в `PATH` (например `npm install` + `npm link` из этого репозитория или глобальная установка).
2. Из корня целевого репозитория:

```bash
doc-canon init --yes
# или: doc-canon init
```

**Ожидается:** `docs/canon/` с контрактом и шаблонами по умолчанию; Cursor skills (`canon-bootstrap`, `canon-write`, `canon-audit`, `canon-contract`); `.cursor/rules/doc-canon.mdc`; управляемый блок `AGENTS.md` между `<!-- doc-canon:start -->` и `<!-- doc-canon:end -->`.

3. В Cursor запустите skill **`canon-bootstrap`**. Ответьте на короткое интервью о purpose/scope. Skill заполнит обязательные документы и обновит `INDEX.md`.
4. Проверьте:

```bash
doc-canon validate
```

**Ожидается:** сообщение об успехе; код выхода 0.

### Типичные ошибки

- Skills падают, если `doc-canon` нет в `PATH`.
- Повторный `init` без `--force-skills` не обновляет управляемые skills/rules/блок AGENTS.

## Существующий проект

**Когда использовать:** В репозитории уже есть код и/или старые docs (`README`, `docs/**`, `AGENTS.md` и т.д.), и нужен SoT в `docs/canon/`.

**CLI vs skill:** Каркас через `init`. Extract-then-freeze (инвентарь, импорт из legacy docs, предложение extras) — `canon-bootstrap`. Код приложения и legacy-файлы вне `docs/canon/` **не** редактируются.

### Шаги

1. Из корня репозитория:

```bash
doc-canon init
```

**Ожидается:** каркас канона + управляемые ассеты. Если содержимое документов в `docs/canon/` уже есть, `init` его не перезаписывает.

2. Запустите **`canon-bootstrap`**. Skill строит инвентарь, использует существующую документацию только как **import sources**, может предложить дополнительные секции и проводит интервью перед обновлением контракта.
3. Подтвердите предложенные изменения контракта / extra sections, если спросят.
4. После генерации:

```bash
doc-canon validate
```

**Ожидается:** валидный канон; содержимое зафиксировано в `docs/canon/`; legacy docs остаются историческими источниками, не SoT.

### Типичные ошибки

- Считать pre-canon `docs/**` источником истины после bootstrap — после freeze SoT только `docs/canon/`.
- Ожидать, что bootstrap правит код приложения — он не должен.

## Изменение функции / поведения

**Когда использовать:** Намеренное добавление или изменение поведения приложения / публичного контракта в репозитории с уже созданным каноном.

**CLI vs skill:** Обновления живого канона выполняются через **`canon-write`**. Coding agents не должны сами редактировать `docs/canon/**`. Необязательные артефакты дизайна/плана хранятся вне канона по пути, **выбранному проектом** (doc-canon его не предписывает).

### Шаги

1. Определите исключения: чистый bugfix без изменения предполагаемого поведения; открытая задача `code_stale`; небихевиоральные правки — для них этот порядок можно пропустить.
2. Запустите **`canon-write`**, чтобы живой канон отражал желаемое поведение; убедитесь, что skill успешно выполняет `doc-canon validate`.
3. Если изменение большое (затрагивает несколько модулей, имеет неочевидный дизайн или требует передачи работы), напишите или синхронизируйте локальный для проекта дизайн/план из обновлённого канона; иначе пропустите этот шаг.
4. После **существенного** изменения канона дождитесь явного разрешения пользователя перед написанием кода; после точечной синхронизации можно продолжать.
5. Реализуйте код приложения и тесты в соответствии с каноном (и необязательным планом).
6. Если появляется drift между docs↔code, используйте **`canon-audit`** / `DISCREPANCIES.md` — не выбирайте сторону молча.

### Типичные ошибки

- Сначала писать код функции, считая обновление канона необязательной уборкой.
- Редактировать `docs/canon/**` из coding agent вместо вызова `canon-write`.
- Пропускать ожидание разрешения после существенных изменений SoT.

## Повседневный цикл

**Когда использовать:** После заметных изменений кода или канона в уже проинициализированном репозитории.

**CLI vs skill:** `canon-write` обновляет затронутые секции. `doc-canon check` строит inventory и пишет `.doc-canon/report.json` (сохраняет findings с `source: skill`). `canon-audit` разбирает drift docs↔code и lifecycle discrepancies. `doc-canon report` печатает последний отчёт.

Этот сценарий предназначен для постфактум-синхронизации после заметных правок и не заменяет **Изменение функции / поведения** при намеренной работе.

### Шаги

1. После заметных правок запустите **`canon-write`**, чтобы затронутые секции остались согласованными с шаблонами/контрактом.
2. Выполните:

```bash
doc-canon check
```

**Ожидается:** обновлённые `.doc-canon/inventory.json` и `.doc-canon/report.json` для CLI findings.

3. Если docs и код расходятся, запустите **`canon-audit`**. Выберите `docs_stale` (правка канона, validate, затем resolve) или `code_stale` (записать Open coding task; не править код приложения из skill).
4. Опционально:

```bash
doc-canon report
```

### Важно

`doc-canon check` **никогда** не редактирует `DISCREPANCIES.md` и **не** переводит discrepancies Open→Resolved. Lifecycle делает только **`canon-audit`**, когда это уместно (для `code_stale` Resolved — на более позднем audit после фикса кода вне skill).

### Типичные ошибки

- Считать, что `check` «закрывает» open discrepancies.
- Пропускать `validate` после правок канона при `docs_stale`.

## Обновить существующий канон

**Когда использовать:** Установленный CLI новее оверлеев/`skills_stamp` целевого репозитория, или в контракте перечислены обязательные файлы, которых нет на диске.

**CLI vs skill:** `doc-canon migrate` (или только `upgrade-skills`, если нужны лишь управляемые ассеты).

### Шаги

1. Установите CLI (`npm install -g doc-canon` или более новый `npx`).
2. Из корня целевого репозитория:

```bash
doc-canon migrate --root .
```

**Ожидается:** `Canon is valid.` (или эквивалентное сообщение об успехе); код выхода 0. Повторный запуск не должен переписывать уже посаженную прозу секций.

### Типичные ошибки

- Использовать `migrate` вместо `init` в репозитории без канона.
- Ожидать, что `migrate` поднимет `schema_version`.
- Валить CI из-за открытых discrepancies.

## CI для adopter-репозитория

**Когда использовать:** Adopter хочет gate на PR.

**CLI vs skill:** Используйте `doc-canon validate` (только структура). `check` опционален. Никогда не валите gate из-за Open записей в `DISCREPANCIES.md`.

### Шаги

1. Скопируйте YAML-пример из секции README **CI для adopter-репозитория** в *adopter*-репозиторий (не в этот).
2. Убедитесь, что workflow запускает `doc-canon validate` (опционально `check`) и не падает на открытых discrepancies.

**Ожидается:** PR проверяются только на структурную валидность; открытые discrepancies сборку не валят.

### Типичные ошибки

- Валить CI из-за Open записей в `DISCREPANCIES.md`.

## Также смотрите

- Дизайн: [`../superpowers/specs/2026-08-07-doc-first-canon-design.md`](../superpowers/specs/2026-08-07-doc-first-canon-design.md)
- Acceptance-сценарии skills: [`../acceptance/skill-scenarios.md`](../acceptance/skill-scenarios.md)
- Справочник команд README (включая `upgrade-skills` и `migrate`) и Agent skills (`canon-contract`)

Чтобы обновить управляемые skills без изменения содержимого канона: `doc-canon upgrade-skills` (см. Usage в README). Чтобы подтянуть существующий канон до этого CLI (отсутствующие обязательные файлы/строки INDEX, затем оверлеи): `doc-canon migrate`. Для новых видов шаблонов: skill `canon-contract`.
