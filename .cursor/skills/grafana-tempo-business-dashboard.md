## Skill: Обновить Grafana Tempo дашборд бизнес-трассировок

### Когда использовать

- Нужно добавить, изменить или проверить дашборд бизнес-трассировок в Grafana.
- В задаче упоминаются Tempo dashboard, Grafana dashboard, TraceQL, business traces, `tempo-business-traces.json`, `tempo-business-traces.dashboard.cjs`, панели, секции, быстрые переходы или фильтры дашборда.
- После добавления новых `BusinessOperations` нужно сделать так, чтобы они корректно отображались и фильтровались на дашборде.

### Цель

Дашборд должен быть операторским экраном для просмотра бизнес-трассировок API: быстро показать последние операции, ошибки, медленные этапы, роли пользователей и отдельные бизнес-группы.

Он не заменяет Grafana Explore. Он помогает быстро найти нужную трассировку и перейти в подробный trace.

### Главные файлы

- `monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs` — основной источник правды.
- `monitoring/grafana/provisioning/dashboards/tempo-business-traces.json` — сгенерированный Grafana JSON.
- `libs/api/shared/tracing/src/lib/business-operations.ts` — список бизнес-операций для переменной `Бизнес-операция`.
- `monitoring/grafana/provisioning/dashboards/dashboards.yml` — provisioning дашбордов Grafana.
- `monitoring/grafana/provisioning/datasources/datasources.yml` — datasource Tempo.

### Основное правило

Не редактируй `tempo-business-traces.json` вручную.

Правь `tempo-business-traces.dashboard.cjs`, затем пересобирай JSON из корня репозитория:

```bash
node monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs
```

JSON должен быть результатом генератора. Повторный запуск генератора не должен менять файл, если входные данные не менялись.

### Структура дашборда

Сохраняй текущую логику:

- сверху остаются нативные Grafana variables: `operation`, `entity`, `actor_role`, `result`;
- в начале дашборда идёт описание с правилами чтения `notary.*` атрибутов;
- дальше идёт блок быстрых переходов;
- затем секция глобального обзора;
- затем пользовательские бизнес-процессы;
- затем операционные процессы и интеграции.

Не возвращай кастомные dropdown-фильтры внутри text panel. В Grafana они нестабильно скроллятся и обрезаются. Используй штатные переменные Grafana.

### Как добавлять новую бизнес-группу

1. Найди новые операции в `BusinessOperations`.
2. Определи группу: авторизация, заявка, платежи, документы, уведомления, рассылки, аудит, Bitrix, заказы, отчёты, профиль или новая отдельная группа.
3. Добавь или обнови TraceQL-запрос панели через генератор.
4. Добавь панель в `layout`.
5. Добавь `panelLayouts` mapping.
6. Если нужен быстрый переход, добавь элемент в `quickItems`.
7. Добавь понятное `No data` описание в `noDataDescriptions`.
8. Пересобери JSON.

Панель должна отвечать на вопрос оператора: что произошло, где ошибка, куда провалиться дальше.

Если панели ещё нет в JSON, не вставляй её руками в `tempo-business-traces.json`. Добавь создание или upsert этой панели в `tempo-business-traces.dashboard.cjs`, чтобы генератор сам формировал итоговый JSON.

### TraceQL

Запросы должны строиться по стабильным атрибутам:

```traceql
{ span."notary.operation" =~ "$operation" && span."notary.entity" =~ "$entity" && span."notary.result" =~ "$result" }
```

Для групп используй regex по префиксам:

```traceql
{ span."notary.operation" =~ "payment[.].*" && span."notary.result" =~ "$result" }
```

Для ошибок:

```traceql
{ span."notary.operation" =~ "$operation" && span."notary.result" = "error" }
```

Для медленных этапов:

```traceql
{ span."notary.operation" =~ "$operation" && duration > 1s }
```

Не используй в TraceQL email, телефон, ФИО, адрес, token, password, reset URL, S3 key, file name, raw body, полный UUID или полный бизнес-ID.

### Переменные

Переменная `operation` должна совпадать с `BusinessOperations`.

Если в `BusinessOperations` появилась новая операция, обнови список значений переменной `operation` через `tempo-business-traces.dashboard.cjs` и пересобери JSON. Не оставляй операцию только в backend-коде, если её нужно искать на дашборде.

Если генератор пока только читает существующий список из JSON, расширь генератор: найди переменную `operation` в `dashboard.templating.list` и обнови её `query`/`options` из безопасного allowlist-списка операций.

Переменные должны оставаться видимыми:

- `operation`;
- `entity`;
- `actor_role`;
- `result`.

Не скрывай их и не заменяй самодельными HTML-dropdown.

### Быстрые переходы

`quickItems` — это быстрые кнопки оператора.

Для перехода к панели используй:

```js
panelUrl(panelId)
```

Для перехода в Explore используй:

```js
exploreUrl('{ span."notary.operation" =~ ".*" }')
```

Если добавляешь кнопку:

- веди её на существующий `panel.id`;
- проверь, что `viewPanel` указывает на реальную панель;
- не добавляй кнопку без понятной операторской пользы.

### Иконки

Иконки быстрых переходов встроены через Lucide SVG как `data:image/svg+xml` в `<img>`.

Не вставляй inline `<svg>` прямо в text panel: Grafana может вывести SVG как текст.

Если нужна новая иконка:

1. Возьми подходящую Lucide outline-иконку.
2. Добавь только нужные SVG paths в `lucideIcons`.
3. Используй `lucideIcon(name)`.
4. Проверь, что в сгенерированном JSON нет сырого `<svg>`.

### `No data`

Не пытайся переименовать центральное состояние `No data` в таблицах Tempo.

Для каждой trace-панели добавляй понятное `description`, где объясняется:

- что показывает панель;
- что означает `No data` для этой панели;
- зависит ли пустое состояние от периода, фильтров или отсутствия событий.

Не ставь `fieldConfig.defaults.noValue` ради замены `No data`: это относится к пустым значениям полей, а не к полной пустой выдаче trace-query.

### Layout

Панели Grafana используют сетку шириной `24`.

При изменении layout:

- не допускай пересечения `gridPos`;
- держи секции визуально отделёнными;
- не делай text panel слишком низкой, если в ней есть описание;
- не вкладывай тяжёлые интерактивные элементы в text panel.

Для разделителей используй `divider(title)`.

### Проверка

Минимальная проверка после изменений:

```bash
node --check monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs
jq . monitoring/grafana/provisioning/dashboards/tempo-business-traces.json >/dev/null
node monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs
git diff --check
```

Проверь idempotency генератора:

```bash
node monitoring/grafana/provisioning/dashboards/tempo-business-traces.dashboard.cjs
git diff -- monitoring/grafana/provisioning/dashboards/tempo-business-traces.json
```

Если Grafana и Tempo подняты, проверь provisioning и TraceQL:

```bash
curl -fsS -X POST http://admin:admin@localhost:3001/api/admin/provisioning/dashboards/reload
curl -fsS http://admin:admin@localhost:3001/api/dashboards/uid/notarius-tempo-business-traces
```

Для каждого уникального TraceQL-запроса можно сделать parse-check через Tempo `/api/search`.

### Финальный аудит

Перед отчётом проверь:

- `tracePanels` используют datasource `tempo`;
- быстрые ссылки ведут в существующие панели;
- `operation` содержит все значения из `BusinessOperations`;
- в JSON нет сырого `<svg>`;
- в TraceQL нет PII/high-cardinality атрибутов;
- `panel39` или другие удалённые экспериментальные панели не вернулись;
- native Grafana variables видимы;
- `No data` объяснён в descriptions trace-панелей.

### Отчёт

В конце работы сообщи:

- какие панели, секции или переменные изменены;
- пересобран ли `tempo-business-traces.json`;
- какие проверки прошли;
- поднимались ли Grafana/Tempo локально;
- есть ли ограничения, например пустые панели при отсутствии трассировок;
- что commit/push/PR не делались, если пользователь этого не просил.
