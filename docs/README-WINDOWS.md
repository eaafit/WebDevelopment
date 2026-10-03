# Windows: запуск Gauge-метрики доходности

Документ описывает запуск панели Gauge с метрикой доходности в Grafana.

## Что нужно

1. Docker Desktop for Windows.
2. Запущенные контейнеры из основного docker-compose проекта.

## Как проверить

1. Убедитесь что контейнеры запущены:

   ```powershell
   docker ps
   ```

   Должны быть запущены:
   - notary-grafana (порт 3001)
   - notary-postgres (порт 5432)

2. Откройте Grafana:

   ```text
   http://localhost:3001
   ```

3. Войдите:

   ```text
   admin / admin
   ```

4. Откройте dashboard:

   ```text
   http://localhost:3001/d/profitability-gauge-demo/dohodnost
   ```

## Что показывает dashboard

**7 панелей Gauge:**

| Панель | Период | Пороги |
| --- | --- | --- |
| 1 | За 7 дней | 50k / 100k руб. |
| 2 | За 30 дней | 50k / 100k руб. |
| 3 | За 90 дней | 100k / 200k руб. |
| 4 | Все время | 100k / 200k руб. |
| 5 | Тест: 50 000 руб. | 100k / 200k руб. |
| 6 | Тест: 150 000 руб. | 100k / 200k руб. |
| 7 | Тест: 250 000 руб. | 100k / 200k руб. |

## Тестовые данные в БД

Посмотреть платежи:

```powershell
docker exec notary-postgres psql -U admin -d db -c "SELECT status, SUM(amount) as total FROM payments GROUP BY status;"
```

Текущая доходность (успешные платежи):

```powershell
docker exec notary-postgres psql -U admin -d db -c "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'completed';"
```

## Тесты

Запустить тесты:

```powershell
node scripts/profitability-demo.test.mjs
node scripts/profitability-integration.test.mjs
```

Тесты проверяют:
- PostgreSQL datasource конфигурацию;
- Dashboard JSON (7 панелей Gauge);
- Правильные thresholds (50k/100k и 100k/200k);
- SQL-запросы к таблице payments;
- Docker контейнеры запущены.

## Остановка

Контейнеры останавливаются через основной docker-compose:

```powershell
docker compose down
```
