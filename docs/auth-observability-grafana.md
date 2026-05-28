# Auth Observability в Grafana

Этот dashboard показывает auth-события двумя способами:

- **Prometheus** считает числа: сколько было входов, регистраций, ошибок и восстановлений пароля.
- **Loki** показывает детали: какое событие произошло, какой `reason`, какой `route`, какой `requestId`.

## Что открыть

1. Сайт:

   ```text
   http://localhost:4200/auth
   ```

2. Prometheus:

   ```text
   http://localhost:9090
   ```

3. Grafana:

   ```text
   http://localhost:3001
   ```

   Логин и пароль по умолчанию:

   ```text
   admin / admin
   ```

4. Dashboard:

   ```text
   Auth Observability
   ```

## Что проверить в Prometheus

После действий на странице авторизации проверьте эти запросы:

```promql
notary_users_registered_total
```

Показывает общее количество успешных регистраций.

```promql
notary_auth_login_total
```

Показывает успешные и неуспешные попытки входа.

```promql
notary_auth_registration_total
```

Показывает попытки регистрации по `outcome`, `role` и `reason`.

```promql
notary_auth_password_reset_total
```

Показывает запросы восстановления пароля и установку нового пароля.

```promql
notary_auth_browser_validation_failed_total
```

Показывает ошибки клиентской валидации: например неверный email или слабый пароль до отправки запроса на backend.

## Как создать события для проверки

1. Сделайте неправильный вход.

   В Prometheus должна появиться или увеличиться метрика:

   ```promql
   notary_auth_login_total{outcome="failed"}
   ```

2. Сделайте успешный вход.

   Должна увеличиться:

   ```promql
   notary_auth_login_total{outcome="success"}
   ```

3. Зарегистрируйте нового пользователя.

   Должны увеличиться:

   ```promql
   notary_users_registered_total
   notary_auth_registration_total{outcome="success"}
   ```

4. На форме регистрации введите некорректный email или слабый пароль и нажмите submit.

   Должна увеличиться:

   ```promql
   notary_auth_browser_validation_failed_total
   ```

5. Запросите восстановление пароля.

   Должна увеличиться:

   ```promql
   notary_auth_password_reset_total{stage="request"}
   ```

## Что найти в Grafana

В dashboard `Auth Observability` верхние панели работают через Prometheus:

- `User registrations (7d)` — регистрации за 7 дней.
- `Failed auth attempts` — Gauge с порогами: зелёный, жёлтый от `2`, красный от `3`.
- `Login attempts (24h)` — входы по результату и причине.
- `Registration flow (7d)` — регистрации по роли, результату и причине.
- `Password reset flow (24h)` — восстановление пароля по этапу.
- `Browser validation failed (24h)` — ошибки валидации в браузере.

Нижние панели работают через Loki:

- `Recent browser auth logs` — browser-логи auth-флоу.
- `Recent backend auth RPC logs` — backend-запросы auth RPC.

Prometheus отвечает на вопрос **“сколько раз произошло”**, а Loki отвечает на вопрос **“что именно произошло и почему”**.

## Важный Docker-нюанс

Prometheus должен видеть API endpoint:

```text
/metrics
```

Если API запущен на компьютере через `pnpm nx serve api`, в Prometheus target обычно нужен:

```yaml
host.docker.internal:3000
```

Если API запущен внутри Docker-сети, target должен смотреть на Docker-сервис API, например:

```yaml
api:3000
```

Если target выбран неправильно, сайт может работать, но dashboard будет пустым: Prometheus просто не сможет собрать метрики.
