# Smoke-check: Failed access attempts (Loki)

Эта проверка подтверждает цепочку:

```text
API -> Docker stdout -> Promtail -> Loki -> Grafana
```

## Предусловия

1. Инфраструктура запущена через `docker-compose up`.
2. API запущен в Docker, чтобы Promtail читал его stdout.
3. Grafana доступна на `http://localhost:3001`.
4. В Grafana есть datasource `Loki` и dashboard `Failed access attempts (Loki)`.

## Генерация тестовых событий

Сгенерируйте несколько 404-запросов, похожих на сканирование несуществующих путей:

```bash
for i in 1 2 3; do
  curl -sS -o /dev/null -w "missing:$i %{http_code}\n" "http://localhost:3000/codex-bot-scan-$i"
done
```

Сгенерируйте пару 401-запросов к защищенному API без авторизации:

```bash
for i in 1 2; do
  curl -sS -o /dev/null -w "receipt:$i %{http_code}\n" "http://localhost:3000/api/payments/codex-smoke-$i/receipt"
done
```

## Проверка в Loki

Запрос для Loki API или Grafana Explore:

```logql
sum by (path,statusCode) (
  count_over_time({job="docker", service="api"} | json | statusCode=~"4.." [15m])
)
```

После smoke-запросов ожидаются строки с кодами `401` и `404`, например:

```text
/api/payments/codex-smoke-1/receipt  401
/api/payments/codex-smoke-2/receipt  401
/codex-bot-scan-1                   404
/codex-bot-scan-2                   404
/codex-bot-scan-3                   404
```

## Проверка в Grafana

Откройте dashboard:

```text
http://localhost:3001/d/notarius-failed-access-loki/failed-access-attempts-loki
```

Для описанного smoke-набора dashboard должен показать:

- `Failed API requests`: не меньше `5`;
- `401 / 403 denials`: не меньше `2`;
- `404 scan misses`: не меньше `3`;
- `Recent failed requests with status code`: свежие строки с `statusCode=401` и `statusCode=404`.

Панель `Failed login attempts` останется пустой, если smoke-тест не вызывает реальный endpoint `/notary.auth.v1alpha1.AuthService/Login` с неверным паролем.
