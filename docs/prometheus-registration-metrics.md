# Метрика регистраций в Prometheus

Этот документ объясняет, как Prometheus должен получать метрики API, чтобы панель `User registrations` в Grafana показывала реальные регистрации.

## Как Prometheus забирает метрики

API отдаёт метрики Prometheus на endpoint:

```text
/metrics
```

Prometheus регулярно опрашивает этот endpoint по настройке из `monitoring/prometheus/prometheus.yml`.

Текущий основной target:

```yaml
targets: ['host.docker.internal:3000']
```

Это значит: Prometheus запущен в Docker, а API запущен на компьютере разработчика командой вроде:

```bash
pnpm nx serve api
```

В этом режиме контейнер Prometheus обращается к API через специальное имя Docker Desktop `host.docker.internal`.

## Если API запускается внутри Docker

Если API работает как Docker-сервис с именем `api` и находится в одной Docker-сети с Prometheus, target должен быть таким:

```yaml
targets: ['api:3000']
```

Менять этот target нужно только для такого Docker-запуска, где Prometheus действительно видит сервис `api` по Docker DNS.

## Что важно не перепутать

- `host.docker.internal:3000` — API запущен на хосте, Prometheus в Docker.
- `api:3000` — API и Prometheus запущены в Docker и находятся в одной сети.
- Если target выбран неправильно, регистрация в приложении будет работать, но Grafana останется пустой, потому что Prometheus не сможет собрать `/metrics`.

## Как проверить регистрацию на защите

Цепочка должна выглядеть так:

```text
пользователь зарегистрировался -> backend увеличил Counter -> Prometheus собрал /metrics -> Grafana показала значение
```

1. Запустите инфраструктуру мониторинга:

   ```bash
   docker-compose up
   ```

2. Запустите API так, чтобы Prometheus видел его на `host.docker.internal:3000`:

   ```bash
   pnpm nx serve api
   ```

3. Откройте Prometheus:

   ```text
   http://localhost:9090
   ```

4. Выполните запрос и запомните текущее значение:

   ```promql
   notary_users_registered_total
   ```

5. Зарегистрируйте нового пользователя на сайте.

6. Снова выполните запрос в Prometheus:

   ```promql
   notary_users_registered_total
   ```

   Значение должно увеличиться на `1`.

7. Проверьте запрос за последние 7 дней:

   ```promql
   increase(notary_users_registered_total[7d])
   ```

8. Откройте Grafana:

   ```text
   http://localhost:3001
   ```

9. Перейдите в dashboard `Business metrics` и найдите панель `User registrations`.

Панель показывает результат `increase(notary_users_registered_total[7d])`. Если регистраций мало, значение будет зелёным; при достижении порогов `2` и `3` цвет меняется на жёлтый и красный.
