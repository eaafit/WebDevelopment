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
- `pnpm nx run prisma:generate` - сгенерировать Prisma Client
- `pnpm nx run prisma:deploy` - применить миграции к базе данных
- `pnpm nx run prisma:seed` - заполнить базу данных тестовыми значениями
- `pnpm nx serve api` - запустить Back-end
- `pnpm nx serve web` - запустить Front-end

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
