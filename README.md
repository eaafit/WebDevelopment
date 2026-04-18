# WebDevelopment

## Документация

- [Инструкция для разработчика](docs/developer-setup.md)

> [!IMPORTANT]
> **Необходимо выполнить при первом запуске проекта:**
>
> - `npm install -g pnpm` - установить pnpm
> - `pnpm install` - установить все зависимости (Выполнять в корне проекта)
> - `copy .env.example .env` - для Windows | `cp .env.example .env` - для Unix

## Команды

### Создание библиотек/компонентов

- `pnpm nx g @nx/angular:lib libs/web/<guest|applicant|notary|admin|shared/<ui|utils>> --standalone [--routing: необходим для всех библиотек, кроме общих]` - создать Front-end библиотеку (Необходимо в редких случаях)
- `pnpm nx generate @nx/angular:component libs/web/<guest|applicant|notary|admin|shared>/src/lib/features/<component_name>/<component_name> --standalone` - создать Front-end компонент

---

### Запуск проекта

- `docker-compose up` - запустить PostgreSQL
- `pnpm nx prune` - очистка nx
- `pnpm store prune` - полная очистка.
- `nx reset` - очистка текущего проекта.
- `pnpm nx run prisma:generate` - сгенерировать Prisma Client
- `pnpm nx run prisma:deploy` - применить миграции к базе данных
- `pnpm nx run prisma:seed` - заполнить базу данных тестовыми значениями
- `pnpm nx serve api` - запустить Back-end
- `pnpm nx serve web` - запустить Front-end

---

### Docker: контейнеры `nexus-web`

Приложение **NexusJS** (`apps/nexus-web`) собирается в образ и поднимается вместе с **PostgreSQL** и **Redis** через Docker Compose. Подробности, переменные окружения и сборка без Compose описаны в [apps/nexus-web/DOCKER.md](apps/nexus-web/DOCKER.md).

1. Скопируйте [apps/nexus-web/env.example](apps/nexus-web/env.example) в `apps/nexus-web/.env` и задайте `**NEXUS_SECRET`\*\* (обязательно для запуска compose).
2. **Локально** (сайт на хосте на порту 3000, например `http://localhost:3000`):

```bash
 cd apps/nexus-web
 docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Без оверлея `docker-compose.local.yml` порт 3000 на хост не открывается (только внутри сети Docker) — так задумано для продакшена за reverse-proxy. 3. **На VPS за Nginx Proxy Manager** (домен → NPM на 80/443 → контейнер на 3000): пошаговые команды — в разделе **«VPS: последовательность команд на сервере»** ниже; сгруппированные команды, проверка контейнеров и типичные ошибки — в **«Справочник команд nexus-web»**; настройка хоста и SSL в NPM — в [DOCKER.md](apps/nexus-web/DOCKER.md) (раздел про VPS и NPM).

#### VPS: последовательность команд на сервере

На виртуальном сервере должны быть установлены **Docker** и **Docker Compose (v2)**, в фаерволе открыты **80** и **443**, у домена в DNS настроена **A-запись** на IP сервера.

1. Получить код репозитория (если его ещё нет на сервере):

```bash
 git clone <URL-репозитория> WebDevelopment
 cd WebDevelopment
```

2. Создать `apps/nexus-web/.env` из примера и задать секрет:

```bash
 cp apps/nexus-web/env.example apps/nexus-web/.env
```

Отредактируйте `apps/nexus-web/.env` и укажите надёжное значение `**NEXUS_SECRET**`. 3. Создать общую Docker-сеть `**proxy**` (один раз). Если сеть уже существует, команда завершится ошибкой — это ожидаемо:

```bash
 docker network create proxy
```

4. Запустить **Nginx Proxy Manager**, затем собрать и поднять **nexus-web** с **PostgreSQL** и **Redis**:

```bash
 cd apps/nexus-web
 docker compose -f docker-compose.npm.yml up -d
 docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
```

5. В веб-интерфейсе NPM (`http://<IP-сервера>:81`) добавьте **Proxy Host**: **Forward Hostname** `nexus-web`, **Forward Port** `3000`, при необходимости SSL (Let's Encrypt).

**Опционально** — зафиксировать build id перед запуском приложения (реже возникает `BUILD_MISMATCH` после деплоя), из каталога `apps/nexus-web`:

```bash
docker compose -f docker-compose.yml -f docker-compose.vps.yml build --build-arg NEXUS_BUILD_ID="$(git rev-parse --short HEAD)"
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d
```

#### Справочник команд `nexus-web` (сводка)

Compose-файлы лежат в `**apps/nexus-web**`. Команды `docker compose` ниже предполагают каталог `**apps/nexus-web**`, если не сказано иное. В `docker-compose.yml` контекст сборки — **корень монорепозитория** (`context: ../..`); не меняйте его на `./nexus-web` — иначе Docker будет искать несуществующий путь `.../apps/nexus-web/nexus-web`.

##### Подготовка `.env`

```bash
cp apps/nexus-web/env.example apps/nexus-web/.env   # из корня клона
# или из apps/nexus-web: cp env.example .env
```

Задайте в `.env` значение `**NEXUS_SECRET**`.

##### Локально (сайт на `http://localhost:3000` и порту из `PORT` в `.env`)

```bash
cd apps/nexus-web
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Остановка: `Ctrl+C` или в другом терминале из того же каталога: `docker compose -f docker-compose.yml -f docker-compose.local.yml down`.

##### VPS: сеть, NPM и приложение

Из **корня** репозитория (после `git clone` и `cd WebDevelopment`):

```bash
docker network create proxy
```

Ошибка «network already exists» при повторном вызове — нормально.

```bash
cd apps/nexus-web
docker compose -f docker-compose.npm.yml up -d
docker compose -f docker-compose.yml -f docker-compose.vps.yml up -d --build
```

##### Проверка, что контейнеры запущены

```bash
cd apps/nexus-web
docker compose -f docker-compose.yml -f docker-compose.vps.yml ps
docker compose -f docker-compose.yml -f docker-compose.vps.yml logs nexus-web --tail 80
docker ps --filter "name=nexus-web"
docker network inspect proxy
```

В выводе `inspect` в секции **Containers** должен фигурировать контейнер сервиса `nexus-web` (имя может быть с префиксом проекта), иначе NPM не достучится до хоста `nexus-web`.

##### Nginx Proxy Manager (кратко)

- Админка: `http://<IP-сервера>:81` — вход, смена пароля, затем **Hosts → Proxy Hosts → Add**.
- **Forward Hostname / IP:** `nexus-web` · **Forward Port:** `3000` · **Domain Names:** ваш домен; SSL — по необходимости (Let's Encrypt). Подробнее: [apps/nexus-web/DOCKER.md](apps/nexus-web/DOCKER.md).

##### Сборка образа без Compose (из корня монорепозитория)

```bash
# текущий каталог — корень клона (где лежат apps/, package.json и т.д.)
docker build -f apps/nexus-web/Dockerfile -t nexus-web .
docker run --rm -p 3000:3000 -e NEXUS_SECRET=<секрет> nexus-web
```

##### Если сборка или запуск падают

| Симптом                                                                   | Что сделать                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `**ENOSPC` / `no space left on device**` при `pnpm install` внутри Docker | На хосте закончилось место: `df -h`, затем `docker system df`, `docker builder prune -af`, при необходимости `docker system prune -af` (осторожно с неиспользуемыми образами). На VPS — увеличить диск; в Docker Desktop — лимит диска в Settings → Resources.                   |
| `**unable to prepare context: .../nexus-web/nexus-web` not found\*\*      | Убедитесь, что используете актуальный `docker-compose.yml` из репозитория и запускаете compose из `**apps/nexus-web`** (или `-f` указывает на эти файлы). В репозитории `build.context` — `**../..\*\*`, а не вложенная папка `nexus-web`.                                       |
| Логи **`EAI_AGAIN` / `fetch failed` / `registry.npmjs.org`** при старте   | Corepack раньше обращался к npm при запуске `pnpm` в контейнере. Пересоберите образ из текущего `Dockerfile` (старт через `node`, без запросов к registry в рантайме). Если проблема останется — почините DNS для Docker (`/etc/docker/daemon.json`, поле `dns`, или DNS у VPS). |
| Контейнер **Exited**                                                      | `docker compose -f docker-compose.yml -f docker-compose.vps.yml logs nexus-web`                                                                                                                                                                                                  |

---

### Платежи (ЮKassa)

- Основной сценарий оплаты подписки для нотариуса выполняется через **embedded Checkout Widget ЮKassa** прямо на странице `/notary/subscription/checkout`, без редиректа на отдельную страницу оплаты.
- Бэкенд создаёт платёж через YooKassa API, сохраняет локальный `Payment` со статусом `PENDING`, а во фронтенд возвращает только безопасные данные для инициализации виджета (`confirmation_token`, `return_url`, `payment_id`).
- Карточные данные, СБП и кошелёк вводятся только внутри виджета ЮKassa. На нашем фронтенде эти данные не собираются и не обрабатываются.

**Переменные окружения:**

- `YOOKASSA_SHOP_ID` - shop id из кабинета ЮKassa
- `YOOKASSA_SECRET_KEY` - secret key для API ЮKassa
- `PAYMENT_RETURN_URL_BASE` - базовый URL фронтенда для fallback-return routes после внешних шагов (`https://portal.example.com`)
- `PAYMENT_WEBHOOK_SECRET` - опциональный секрет для webhook. Если задан, добавляйте его в URL webhook как `?secret=<value>` или передавайте в заголовке `x-payment-webhook-secret`
- `YOOKASSA_RECEIPT_VAT_CODE` - обязательный `vat_code` для строки чека подписки, которую мы передаём в YooKassa; значение нужно задать явно по согласованию с бухгалтерией

**Webhook URL для кабинета ЮKassa:**

- `https://<api-host>/api/payments/webhook`
- если включён `PAYMENT_WEBHOOK_SECRET`: `https://<api-host>/api/payments/webhook?secret=<PAYMENT_WEBHOOK_SECRET>`

**Fallback routes после внешней авторизации / 3DS:**

- `/notary/subscription/checkout/success`
- `/notary/subscription/checkout/cancel`

---

### Prisma

- `pnpm nx run prisma:status` - проверяет текущее состояние базы данных и выводит информацию об уже примененных и ожидающих выполнения миграциях.
- `pnpm nx run prisma:migrate [-n migration_name]` - создает новые миграции на основе изменений в Prisma-схеме и автоматически применяет их к базе данных (используется только в среде разработки).
- `pnpm nx run prisma:studio` - запускает локальный веб-интерфейс (Prisma Studio) для удобного визуального просмотра и редактирования данных в базе.
- `pnpm nx run prisma:deploy` - применяет все ранее созданные, но еще не выполненные миграции к базе данных (предназначено для production-окружения и CI/CD пайплайнов).
- `pnpm nx run prisma:generate` - обновляет Prisma Client на основе текущей схемы, генерируя актуальные TypeScript-типы для безопасного взаимодействия с базой данных из кода.
- `pnpm nx run prisma:seed` - автоматически заполняет базу данных начальными или тестовыми данными в соответствии с заранее настроенным seed-скриптом.

> [!WARNING]
> Если у вас установлен PostgreSQL вне Docker, порт 5432 может быть занят, и появится необходимость поменять его на любой другой свободный порт.

### Настройка портов в Windows

- `netstat -ano | findstr :<номер_порта>` - Эта команда выводит список всех сетевых соединений, прослушиваемых портов и соответствующих им PID.
- `netsh int ipv4 show excludedportrange protocol=tcp` - просмотр списка зарезервированных портов.
- `netsh int ipv4 delete excludedportrange protocol=tcp startport=2182 numberofports=10` - исключение портов.
- `net stop winnat` | `net start winnat` - остановка и запуск службы winnat для сброза зарезервированных портов.
