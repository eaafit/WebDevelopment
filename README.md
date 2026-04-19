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
- `docker system prune` - Глубокая чистка и освободить максимум места
- `docker container prune` - Удаляет только остановленные контейнеры
- `docker system prune --volumes` - Добавляет к очистке неиспользуемые тома
- `docker system prune -a` - Удаляет все неиспользуемые образы, а не только "висячие"
- `rm -rf node_modules` - удаление node_modules 
- `pnpm store prune` - полная очистка.
- `nx reset` - очистка текущего проекта.
- `pnpm nx run prisma:generate` - сгенерировать Prisma Client
- `pnpm nx run prisma:deploy` - применить миграции к базе данных
- `pnpm nx run prisma:seed` - заполнить базу данных тестовыми значениями
- `pnpm nx serve api` - запустить Back-end
- `pnpm nx serve web` - запустить Front-end

---

### Docker: портал Angular + API (`portal`)

Основной портал (**Angular** `apps/web` + **Nest** `apps/api`) поднимается Compose-стеком [`apps/web/docker-compose.portal.yml`](apps/web/docker-compose.portal.yml): контейнер **edge** (`portal`, nginx) отдаёт статику и проксирует API и Connect-RPC на `api`, чтобы в браузере был **один origin** (как ожидает RPC-клиент).

- Полная последовательность (сборка, `.env.portal`, миграции, NPM: **Forward Hostname** `portal`, **Forward Port** `80`): [**apps/web/DOCKER.md**](apps/web/DOCKER.md).
- **Nginx Proxy Manager** отдельным файлом: [`apps/web/docker-compose.npm.yml`](apps/web/docker-compose.npm.yml) — из каталога `apps/web`: `docker compose -f docker-compose.npm.yml up -d` (сеть `proxy` должна существовать: `docker network create proxy`).

Кратко по типичным проблемам Docker:

| Симптом | Что сделать |
| ------- | ----------- |
| **`ENOSPC` / no space left on device** при сборке | `df -h`, `docker system df`, при необходимости `docker builder prune -af` или `docker system prune -af`. |
| **`i/o timeout`** у `docker compose` | `export COMPOSE_HTTP_TIMEOUT=300` (Linux); отдельно `compose build`, затем `up -d` без `--build`; см. [apps/web/DOCKER.md](apps/web/DOCKER.md). |
| **`EAI_AGAIN` / registry.npmjs.org** в логах сборки | DNS/сеть хоста или `/etc/docker/daemon.json` → `dns`. |

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

