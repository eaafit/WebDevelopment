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
  curl -sS -o /dev/null -w "missing:$i %{http_code}\n" "http://localhost:3000/scanner-probe-$i"
done
```

Сгенерируйте пару 401-запросов к защищенному API без авторизации:

```bash
for i in 1 2; do
  curl -sS -o /dev/null -w "receipt:$i %{http_code}\n" "http://localhost:3000/api/payments/failed-access-smoke-$i/receipt"
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
/api/payments/failed-access-smoke-1/receipt  401
/api/payments/failed-access-smoke-2/receipt  401
/scanner-probe-1                            404
/scanner-probe-2                            404
/scanner-probe-3                            404
```

## Проверка в Prometheus

Эти же ответы пишутся в метрику:

```text
notary_failed_access_total
```

Проверка через API:

```bash
curl -sS http://localhost:3000/metrics | grep notary_failed_access_total
```

PromQL-запрос для Grafana:

```promql
sum by (reason, status_code, path_group) (
  increase(notary_failed_access_total[15m])
)
```

Для smoke-набора ожидаются группы:

```text
auth_denied / 401 / payment_receipt
scan_miss   / 404 / other
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
- `Prometheus failed access metrics`: те же события, сгруппированные по `reason`, `status_code` и `path_group`.

Панель `Failed login attempts` останется пустой, если smoke-тест не вызывает реальный endpoint `/notary.auth.v1alpha1.AuthService/Login` с неверным паролем.

## Unit tests

Логика метрик покрыта unit-тестами API:

```bash
pnpm nx test api --testPathPattern=failed-access
```

Проверяется:

- классификация `AuthService/Login` как `failed_login`;
- классификация закрытых receipt-запросов как `auth_denied`;
- классификация неизвестных 404 как `scan_miss`;
- отсутствие высококардинальных label'ов с payment id или сырым URL;
- экспорт `notary_failed_access_total` в Prometheus format;
- middleware, которое записывает метрику только после завершения 4xx-ответа.
