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
