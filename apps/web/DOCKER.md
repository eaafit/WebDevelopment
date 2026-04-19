# Портал Angular + API в Docker (один origin)

Статический фронт (`apps/web`) и Nest API (`apps/api`) отдаются через **один nginx-контейнер `portal`**: статика с диска, маршруты `/health`, `/metrics`, `/api/*` и Connect-RPC (`/notary.*`) проксируются на `api:3000`. Так браузер и RPC используют **один `origin`**, что соответствует `buildRpcBaseUrl()` в [`libs/web/shared/ui/src/lib/rpc/rpc-transport.ts`](../../libs/web/shared/ui/src/lib/rpc/rpc-transport.ts).

## Требования

- Docker / Docker Compose v2
- Сеть **`proxy`** для Nginx Proxy Manager: `docker network create proxy` (один раз)
- Файл **`.env.portal`** (см. [`env.portal.example`](env.portal.example))

## Nginx Proxy Manager (отдельно от портала)

Из каталога `apps/web` поднимите NPM (порты 80/81/443 на хосте; данные — в `./proxy-manager-data` и `./proxy-manager-letsencrypt`):

```bash
cd apps/web
docker network create proxy   # если ещё нет
docker compose -f docker-compose.npm.yml up -d
```

Админка NPM: `http://<IP-сервера>:81`. Дальше поднимайте стек портала (`docker-compose.portal.yml`) и в NPM добавьте **Proxy Host**: см. ниже.

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

docker compose -f docker-compose.npm.yml up -d

docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --build

docker compose --env-file .env.portal -f docker-compose.portal.yml --profile migrate run --rm migrate
```

Если Docker отвечает **`i/o timeout`**: на медленном VPS или нестабильной сети увеличьте таймаут клиента (пример для Linux): `export COMPOSE_HTTP_TIMEOUT=300`. Отдельно выполните `docker compose ... build`, затем `up -d` без `--build`, чтобы понять, таймаут на этапе сборки или запуска. При первом деплое дождитесь, пока Postgres пройдёт healthcheck (пустой том инициализируется дольше).

В NPM для домена портала: **Forward Hostname** `portal`, **Forward Port** `80`, SSL по необходимости.

Имя хоста — это **имя сервиса в compose** (`portal`), не имя образа и не `localhost`. Если указать другой контейнер или порт (не тот сервис `portal` на 80), в браузере откроется не портал Notary.

## Проверка

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml ps
docker network inspect proxy --format '{{range $k,$v := .Containers}}{{$v.Name}} {{end}}'
```

Должны быть **`portal`** и **`nginx-proxy-manager`** в сети `proxy`.

Убедиться, что в контейнере `portal` лежит собранный Angular (в корне `index.html` будет `<title>web</title>`):

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml exec portal head -n15 /usr/share/nginx/html/index.html
```

```bash
curl -sI -H "Host: your-domain" http://127.0.0.1/
curl -sI -H "Host: your-domain" http://127.0.0.1/health
```

(с хоста VPS, если NPM слушает 80 и выставлен тот же `Host`).

## Переменные API

Минимум в `.env.portal`: **`DATABASE_URL`**, **`JWT_ACCESS_SECRET`**, **`CORS_ORIGIN`**, **`FRONTEND_URL`** (публичный HTTPS URL портала). Остальное — по [`../../.env.example`](../../.env.example).

## nginx

Конфиг: [`nginx/portal.conf`](nginx/portal.conf). При добавлении новых HTTP-маршрутов в [`apps/api/src/main.ts`](../../apps/api/src/main.ts) при необходимости добавьте `location` в `portal.conf` и пересоберите образ `portal`.
