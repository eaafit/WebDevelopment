# Gauge-метрика доходности в Grafana

Документ описывает полный локальный пример Grafana + PostgreSQL для панели Gauge, которая показывает доходность в рублях и меняет цвет по порогам:

- до `1 000` руб. - красный;
- от `1 000` до `2 000` руб. - желтый;
- от `2 000` руб. и выше - зеленый.

## Быстрый запуск локального стенда

Из корня проекта:

```bash
docker compose -f docker-compose.profitability-demo.yaml up -d
```

Grafana будет доступна по адресу:

```text
http://localhost:3001
```

Логин и пароль:

```text
admin / admin
```

Готовый dashboard:

```text
http://localhost:3001/d/profitability-gauge-demo/profitability-gauge-demo
```

Проверка файлов demo-стенда тестами:

```bash
node scripts/profitability-demo.test.mjs
```

## Тестовые данные

Тестовая база создается контейнером PostgreSQL из файла:

```text
monitoring/profitability-demo/postgres/init/001_profitability_demo.sql
```

Таблица:

```sql
CREATE TABLE IF NOT EXISTS profitability_samples (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scenario text NOT NULL UNIQUE,
  label text NOT NULL,
  profit_rub numeric(12, 2) NOT NULL,
  expected_zone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

INSERT-запросы:

```sql
INSERT INTO profitability_samples (scenario, label, profit_rub, expected_zone)
VALUES
  ('red_500', '500 руб. - красная зона', 500.00, 'red'),
  ('yellow_1500', '1 500 руб. - желтая зона', 1500.00, 'yellow'),
  ('green_2500', '2 500 руб. - зеленая зона', 2500.00, 'green')
ON CONFLICT (scenario) DO UPDATE
SET
  label = EXCLUDED.label,
  profit_rub = EXCLUDED.profit_rub,
  expected_zone = EXCLUDED.expected_zone;
```

Проверка данных:

```bash
docker exec profitability-demo-postgres psql -U grafana -d profitability_demo -c "SELECT scenario, profit_rub, expected_zone FROM profitability_samples ORDER BY id;"
```

Ожидаемый результат:

```text
red_500      |  500.00 | red
yellow_1500  | 1500.00 | yellow
green_2500   | 2500.00 | green
```

## SQL-запрос для метрики

Основная Gauge-панель использует переменную dashboard `scenario`.

```sql
SELECT profit_rub::double precision AS "Доходность, руб."
FROM profitability_samples
WHERE scenario = '$scenario'
LIMIT 1;
```

Запрос для списка сценариев в переменной:

```sql
SELECT label AS __text, scenario AS __value
FROM profitability_samples
ORDER BY id;
```

Контрольные запросы для отдельных значений:

```sql
SELECT profit_rub::double precision AS "500 руб."
FROM profitability_samples
WHERE scenario = 'red_500'
LIMIT 1;
```

```sql
SELECT profit_rub::double precision AS "1 500 руб."
FROM profitability_samples
WHERE scenario = 'yellow_1500'
LIMIT 1;
```

```sql
SELECT profit_rub::double precision AS "2 500 руб."
FROM profitability_samples
WHERE scenario = 'green_2500'
LIMIT 1;
```

## Пошаговое создание Dashboard в Grafana

1. Откройте `http://localhost:3001`.
2. Войдите под пользователем `admin` с паролем `admin`.
3. В левом меню откройте `Dashboards`.
4. Нажмите `New` -> `New dashboard`.
5. Нажмите `Add visualization`.
6. Выберите источник данных `PostgreSQL Profitability Demo`.
7. Укажите название dashboard: `Доходность - Gauge Demo`.
8. Сохраните dashboard через кнопку `Save dashboard`.

В готовом demo-стенде эти шаги уже выполнены автоматически через provisioning, поэтому dashboard доступен сразу после запуска контейнеров.

## Пошаговая настройка панели Gauge

1. На dashboard нажмите `Add` -> `Visualization` или откройте существующую панель через меню панели -> `Edit`.
2. В правой части редактора выберите тип визуализации `Gauge`.
3. В поле источника данных выберите `PostgreSQL Profitability Demo`.
4. Переключите SQL-редактор в режим кода.
5. Вставьте запрос:

   ```sql
   SELECT profit_rub::double precision AS "Доходность, руб."
   FROM profitability_samples
   WHERE scenario = '$scenario'
   LIMIT 1;
   ```

6. В настройках поля задайте единицу измерения `currencyRUB`.
7. Установите `Min = 0`, `Max = 3000`.
8. Включите отображение threshold labels и threshold markers, если нужно видеть подписи порогов на Gauge.
9. Сохраните панель кнопкой `Apply`, затем сохраните dashboard.

## Настройка Thresholds

В редакторе панели откройте правую боковую панель:

```text
Field -> Standard options -> Thresholds
```

Установите режим:

```text
Mode: Absolute
```

Значения порогов:

| Value | Color | Значение |
| --- | --- | --- |
| `null` | red | до `1 000` руб. |
| `1000` | yellow | от `1 000` до `2 000` руб. |
| `2000` | green | от `2 000` руб. и выше |

В JSON dashboard эта настройка выглядит так:

```json
{
  "mode": "absolute",
  "steps": [
    { "color": "red", "value": null },
    { "color": "yellow", "value": 1000 },
    { "color": "green", "value": 2000 }
  ]
}
```

## Где посмотреть результат

Результат отображается в Grafana:

```text
Dashboards -> Доходность - Gauge Demo
```

Прямая ссылка:

```text
http://localhost:3001/d/profitability-gauge-demo/profitability-gauge-demo
```

На dashboard есть:

- основная панель `Текущая доходность` с выпадающим списком `Сценарий`;
- контрольная панель `500 руб. - красная зона`;
- контрольная панель `1 500 руб. - желтая зона`;
- контрольная панель `2 500 руб. - зеленая зона`.

## Примеры отображения

| Сценарий | Значение | Ожидаемый цвет |
| --- | ---: | --- |
| `red_500` | `500` руб. | красный |
| `yellow_1500` | `1 500` руб. | желтый |
| `green_2500` | `2 500` руб. | зеленый |

Чтобы проверить смену цвета основной панели, откройте dashboard и переключайте переменную `Сценарий` в верхней части страницы.
