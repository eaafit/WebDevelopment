# API backend (Nest): сборка и развёртывание в Docker — инструкция для Cursor

Документ описывает **создание образа** и **развёртывание** сервиса `api` (NestJS) в контейнере в контексте монорепозитория. Основан на [`apps/web/DOCKER.md`](../web/DOCKER.md) и фактической структуре каталога [`apps/`](../).

## Структура `apps/` (релевантная Docker)

| Путь | Назначение |
|------|------------|
| [`apps/api/`](../api/) | Nest API: [`Dockerfile`](Dockerfile), точка входа в прод-сборке — `main.js` в образе |
| [`apps/web/`](../web/) | Angular + nginx edge (`portal`): [`Dockerfile`](../web/Dockerfile), [`docker-compose.portal.yml`](../web/docker-compose.portal.yml), [`nginx/portal.conf`](../web/nginx/portal.conf), переменные — [`env.portal.example`](../web/env.portal.example) |
| Корень репозитория | **Контекст сборки** для обоих образов; учитывается корневой [`.dockerignore`](../../.dockerignore) |

В проде API слушает **порт 3000** внутри сети Docker. Снаружи для браузера трафик идёт через контейнер **`portal`** (nginx): `/api/*`, `/health`, `/metrics`, Connect-RPC (`/notary.*`) проксируются на сервис **`api:3000`** — один origin с фронтом. Подробнее — в [`apps/web/DOCKER.md`](../web/DOCKER.md).

---

## Требования

- Docker и Docker Compose v2
- Для полного портала за NPM: внешняя сеть **`proxy`**: `docker network create proxy` (один раз)
- Файл **`apps/web/.env.portal`** (шаблон — [`apps/web/env.portal.example`](../web/env.portal.example))

**Рабочие каталоги в командах:** сборка образа — из **корня** репозитория; `docker compose` для стека портала — из **`apps/web`**.

---

## 1. Сборка только образа API

Контекст — корень монорепозитория (не `apps/api`):

```bash
# из корня WebDevelopment (или вашего clone)
docker build -f apps/api/Dockerfile -t notary-portal-api .
```

Образ собирает прод-бандл через Nx: `pnpm exec nx run api:build:production`. Итоговый рантайм-образ копирует `dist/apps/api/` и запускает `node main.js` от пользователя `node`, порт **3000**.

---

## 2. Развёртывание API в составе стека портала (рекомендуемый способ)

Стек описан в [`apps/web/docker-compose.portal.yml`](../web/docker-compose.portal.yml): сервисы **`postgres`**, **`api`**, **`portal`**, опционально **`migrate`** (profile).

### 2.1. Подготовка окружения

```bash
cd apps/web
cp env.portal.example .env.portal
```

Отредактируйте `.env.portal`: минимум **`DATABASE_URL`**, **`JWT_ACCESS_SECRET`**, **`CORS_ORIGIN`**, **`FRONTEND_URL`** (публичный URL портала). Остальное — по корневому `.env.example` (платежи, S3, SMTP и т.д.).

`DATABASE_URL` для compose должен указывать хост **`postgres`** (имя сервиса), как в примере:

`postgresql://admin:<пароль>@postgres:5432/db?schema=public`

Пароль должен совпадать с `POSTGRES_PASSWORD` в compose (по умолчанию в файле заданы `admin`/`db` — на проде замените и синхронизируйте с `.env.portal`).

### 2.2. Запуск (VPS / сервер)

```bash
docker network create proxy   # если используете NPM и сети ещё нет

cd apps/web
docker compose -f docker-compose.npm.yml up -d   # опционально: Nginx Proxy Manager

docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --build

docker compose --env-file .env.portal -f docker-compose.portal.yml --profile migrate run --rm migrate
```

После первого деплоя дождитесь **healthy** у Postgres (первый старт тома может быть долгим). При таймаутах Docker см. раздел про `COMPOSE_HTTP_TIMEOUT` в [`apps/web/DOCKER.md`](../web/DOCKER.md).

Сервис **`api`** получает переменные из **`env_file: .env.portal`** и `PORT=3000`.

### 2.3. Только пересборка / перезапуск API

После изменения кода API или переменных:

```bash
cd apps/web
docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --build api
```

Если обновились только переменные в `.env.portal`:

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml up -d --force-recreate api
```

Логи:

```bash
docker compose --env-file .env.portal -f docker-compose.portal.yml logs api --tail 200
```

---

## 3. Миграции Prisma

В проде схему обновляют через **`migrate deploy`**. В compose это одноразовый сервис **`migrate`** (см. выше).

Важно для CLI с корня репозитория: использовать **`--config libs/api/shared/prisma/prisma.config.ts`** (в Prisma 7 URL задаётся в конфиге, не в `schema.prisma`). Подробности и примеры одноразовых `docker run` с томом репозитория — в [`apps/web/DOCKER.md`](../web/DOCKER.md) (раздел Prisma / seed).

---

## 4. Nginx и новые маршруты HTTP

Если добавляете новые публичные пути в [`apps/api/src/main.ts`](src/main.ts), проверьте [`apps/web/nginx/portal.conf`](../web/nginx/portal.conf): при необходимости добавьте `location` и **пересоберите образ `portal`**, не только `api`.

---

## 5. Подсказки для агента Cursor

- **Корень workspace** считать корнем монорепозитория (где лежат `package.json`, `nx.json`, `apps/`, `libs/`).
- Любая правка «как собрать API» должна ссылаться на **`docker build -f apps/api/Dockerfile`** с контекстом **`.`** из корня.
- Compose-файлы для прод-стека лежат в **`apps/web/`**; сервис API называется **`api`**, БД — **`postgres`**.
- Документ с полным сценарием портала, NPM и проверками: **`apps/web/DOCKER.md`**.

---

## 6. Краткая проверка

```bash
cd apps/web
docker compose --env-file .env.portal -f docker-compose.portal.yml ps
```

Убедиться, что контейнер **`api`** запущен и зависимость от **`postgres`** выполнена. С хоста при необходимости проверяйте HTTP через **`portal`** или внутреннюю сеть Docker (как в основном DOCKER.md для `curl` с заголовком `Host`).
