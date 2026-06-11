# Windows: запуск demo Gauge-метрики доходности

Этот пакет содержит готовый локальный пример Grafana + PostgreSQL для проверки Gauge-панели доходности.

## Что нужно установить

1. Docker Desktop for Windows.
2. Node.js LTS, если нужно запускать тесты командой `node scripts/profitability-demo.test.mjs`.

## Как запустить

1. Распакуйте zip в любую папку, например:

   ```text
   C:\Users\<user>\Desktop\profitability-gauge-demo
   ```

2. Откройте PowerShell в этой папке.
3. Запустите контейнеры:

   ```powershell
   docker compose -f docker-compose.profitability-demo.yaml up -d
   ```

4. Откройте Grafana:

   ```text
   http://localhost:3001/d/profitability-gauge-demo/dohodnost--gauge-demo
   ```

5. Войдите:

   ```text
   admin / admin
   ```

6. Если Grafana попросит сменить пароль, нажмите `Skip`.

## Где находится результат

В Grafana откройте:

```text
Dashboards -> Доходность - Gauge Demo
```

На dashboard есть переменная `Сценарий`. Переключайте значения:

- `500 руб. - красная зона`;
- `1 500 руб. - желтая зона`;
- `2 500 руб. - зеленая зона`.

Gauge-панель `Текущая доходность` будет менять цвет автоматически.

## Как посмотреть тестовые данные

```powershell
docker exec profitability-demo-postgres psql -U grafana -d profitability_demo -c "SELECT scenario, label, profit_rub, expected_zone FROM profitability_samples ORDER BY id;"
```

## Как изменить тестовые данные

Пример: поменять красный сценарий на `800` руб.

```powershell
docker exec profitability-demo-postgres psql -U grafana -d profitability_demo -c "UPDATE profitability_samples SET label = '800 руб. - красная зона', profit_rub = 800.00, expected_zone = 'red' WHERE scenario = 'red_500';"
```

Пример: поменять желтый сценарий на `1800` руб.

```powershell
docker exec profitability-demo-postgres psql -U grafana -d profitability_demo -c "UPDATE profitability_samples SET label = '1 800 руб. - желтая зона', profit_rub = 1800.00, expected_zone = 'yellow' WHERE scenario = 'yellow_1500';"
```

Пример: поменять зеленый сценарий на `3200` руб.

```powershell
docker exec profitability-demo-postgres psql -U grafana -d profitability_demo -c "UPDATE profitability_samples SET label = '3 200 руб. - зеленая зона', profit_rub = 3200.00, expected_zone = 'green' WHERE scenario = 'green_2500';"
```

После изменения нажмите `Refresh` в Grafana.

## Как запустить проверки

```powershell
node scripts/profitability-demo.test.mjs
```

Тесты проверяют:

- Docker Compose конфигурацию;
- PostgreSQL datasource;
- SQL seed с тестовыми данными;
- dashboard JSON;
- Gauge thresholds `1000` и `2000`;
- документацию.

## Как остановить стенд

```powershell
docker compose -f docker-compose.profitability-demo.yaml down
```

Если нужно полностью удалить тестовую базу и начать заново:

```powershell
docker compose -f docker-compose.profitability-demo.yaml down -v
docker compose -f docker-compose.profitability-demo.yaml up -d
```
