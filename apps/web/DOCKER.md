# Портал Angular + API в Docker (один origin)

Статический фронт (`apps/web`) и Nest API (`apps/api`) отдаются через **один nginx-контейнер `portal`**: статика с диска, маршруты `/health`, `/metrics`, `/api/*` и Connect-RPC (`/notary.*`) проксируются на `api:3000`. Так браузер и RPC используют **один `origin`**, что соответствует `buildRpcBaseUrl()` в [`libs/web/shared/ui/src/lib/rpc/rpc-transport.ts`](../../libs/web/shared/ui/src/lib/rpc/rpc-transport.ts).

Это **отдельный** стек от [`apps/nexus-web`](../nexus-web/DOCKER.md) (NexusJS). Для основного портала Notary используйте **portal**; `nexus-web` — только если нужен этот сервис.

## Требования

- Docker / Docker Compose v2
- Сеть **`proxy`** для Nginx Proxy Manager: `docker network create proxy` (один раз)
- Файл **`.env.portal`** (см. [`env.portal.example`](env.portal.example))

## Сборка образов (из корня монорепозитория)

Контекст сборки — корень репозитория; учитывается корневой [`.dockerignore`](../../.dockerignore).

```bash
docker build -f apps/web/Dockerfile -t notary-portal-web .
docker build -f apps/api/Dockerfile -t notary-portal-api .
```

## Запуск на VPS

```bash
cd apps/web
cp env.portal.example .env.portal
# отредактируйте .env.portal: JWT_ACCESS_SECRET, CORS_ORIGIN, FRONTEND_URL, при необходимости DATABASE_URL и секреты из корневого .env.example

docker network create proxy   # если ещё нет

docker compose --env-file .env.portal -f docker-compose.portal.yml --profile migrate run --rm migrate

docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --build
```

Nginx Proxy Manager: **Forward Hostname** `portal`, **Forward Port** `80`, домен и SSL по необходимости.

## Проверка

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml ps
docker network inspect proxy --format '{{range $k,$v := .Containers}}{{$v.Name}} {{end}}'
```

Должны быть **`portal`** и **`nginx-proxy-manager`** в сети `proxy`.

```bash
curl -sI -H "Host: your-domain" http://127.0.0.1/
curl -sI -H "Host: your-domain" http://127.0.0.1/health
```

(с хоста VPS, если NPM слушает 80 и выставлен тот же `Host`).

## Переменные API

Минимум в `.env.portal`: **`DATABASE_URL`**, **`JWT_ACCESS_SECRET`**, **`CORS_ORIGIN`**, **`FRONTEND_URL`** (публичный HTTPS URL портала). Остальное — по [`../../.env.example`](../../.env.example).

## nginx

Конфиг: [`nginx/portal.conf`](nginx/portal.conf). При добавлении новых HTTP-маршрутов в [`apps/api/src/main.ts`](../../apps/api/src/main.ts) при необходимости добавьте `location` в `portal.conf` и пересоберите образ `portal`.
