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

### Сборка фронта: `NG_APP_SHOW_TEST_ACCOUNTS`

По умолчанию подсказки **выключены** (`false`). В `.env.portal` задайте **`NG_APP_SHOW_TEST_ACCOUNTS=true`**, чтобы включить их в образе **`portal`** при `docker compose ... up --build` (build-arg). См. [`env.portal.example`](env.portal.example). Меняется только при **пересборке** образа `portal`, не при перезапуске API.

Локально без Docker: `pnpm nx run web:build` — production (**выключено**); `pnpm nx serve` — development (**включено** через `define` в `project.json`).

## nginx

Конфиг: [`nginx/portal.conf`](nginx/portal.conf). При добавлении новых HTTP-маршрутов в [`apps/api/src/main.ts`](../../apps/api/src/main.ts) при необходимости добавьте `location` в `portal.conf` и пересоберите образ `portal`.


## Перезапуск API (Nest) — переменные из `.env.portal`

В `docker-compose.portal.yml` у сервиса `api` указан `env_file: .env.portal`. После правок пересоздайте контейнер API:

```bash
cd apps/web
docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --force-recreate api
```

Или перезапустите весь стек: `docker compose --env-file .env.portal -f docker-compose.portal.yml up -d`. Если `up -d` не подхватил новые переменные, используйте `--force-recreate`.

## Перезапуск фронта (`portal`)

Статика собирается при **сборке** образа. После смены `NG_APP_SHOW_TEST_ACCOUNTS` или других вещей, влияющих на билд Angular:

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --build portal
```

IP адреса контейнеров
```bash
docker ps -q | xargs -n 1 docker inspect --format '{{ .Name }}: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
```

Имя сети

```bash
docker inspect "$(docker ps -qf name=postgres)" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' | head -1
```

Соединение с postgres

```bash
psql -h 172.20.0.2 -p 5432 -U admin -d db
```

### Показать все контейнеры проекта, включая остановленные:

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml ps -a
```

### Логи API:

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml logs api --tail 200
docker compose --env-file .env.portal -f docker-compose.portal.yml up -d api
```

### Prisma / seed из одноразового контейнера (VPS)

В Prisma 7 строка подключения задаётся в [`libs/api/shared/prisma/prisma.config.ts`](../../libs/api/shared/prisma/prisma.config.ts), а в `schema.prisma` у `datasource` **нет** `url`. Если из **корня** репозитория вызывать только `prisma db push --schema=libs/api/shared/prisma/schema.prisma` **без** `--config`, CLI не подхватывает конфиг и падает с ошибкой: *The datasource.url property is required in your Prisma config file*.

- Указывайте **`--config libs/api/shared/prisma/prisma.config.ts`** (и при необходимости `--schema` — обычно не нужен, путь к схеме уже в конфиге).
- В образе `node:*-slim` поставьте **`openssl`**, иначе Prisma предупреждает про `libssl` и может вести себя непредсказуемо.
- **`NETWORK`** — сеть, в которой висит контейнер Postgres (см. блок «Имя сети» выше), например `notary-portal_default`.
- **`DATABASE_URL`** на хосте `postgres` — как в `.env.portal` для сервиса `api` (логин/пароль подставьте свои).

В проде схему БД обновляют через **`migrate deploy`** (как сервис `migrate` в compose). **`db push`** удобен для временных стендов; он не пишет историю миграций как `migrate dev`.

**Только миграции** (аналог `docker compose ... run migrate`, но из корня репо с уже установленным `pnpm install` на томе):

```bash
REPO=/home/WebDevelopment
NETWORK=notary-portal_default

docker run --rm \
  --network "$NETWORK" \
  -v "$REPO:/repo:rw" \
  -w /repo \
  -e DATABASE_URL='postgresql://admin:ВАШ_ПАРОЛЬ@postgres:5432/db?schema=public' \
  node:22-bookworm-slim \
  sh -lc 'apt-get update -y && apt-get install -y openssl && corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm exec prisma migrate deploy --config libs/api/shared/prisma/prisma.config.ts'
```

**Только seed** (после успешных миграций):

```bash
docker run --rm \
  --network "$NETWORK" \
  -v "$REPO:/repo:rw" \
  -w /repo \
  -e DATABASE_URL='postgresql://admin:ВАШ_ПАРОЛЬ@postgres:5432/db?schema=public' \
  node:22-bookworm-slim \
  sh -lc 'apt-get update -y && apt-get install -y openssl && corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm nx run prisma:seed'
```

**Миграции + seed** в одном запуске:

```bash
docker run --rm \
  --network "$NETWORK" \
  -v "$REPO:/repo:rw" \
  -w /repo \
  -e DATABASE_URL='postgresql://admin:ВАШ_ПАРОЛЬ@postgres:5432/db?schema=public' \
  node:22-bookworm-slim \
  sh -lc 'apt-get update -y && apt-get install -y openssl && corepack enable && corepack prepare pnpm@10.33.0 --activate && pnpm exec prisma migrate deploy --config libs/api/shared/prisma/prisma.config.ts && pnpm nx run prisma:seed'
```

**Если нужен именно `db push`** (не рекомендуется вместо миграций на проде):

```bash
pnpm exec prisma db push --config libs/api/shared/prisma/prisma.config.ts
```

(в том же `sh -lc` после `openssl` и `pnpm`, из `-w /repo`).

Вместо `-e DATABASE_URL=...` можно передать файл окружения хоста, например: `--env-file "$REPO/apps/web/.env.portal"` (путь поправьте под вашу раскладку каталогов).
