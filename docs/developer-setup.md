# Инструкция для разработчика

## Подготовка к запуску

1. Установите `pnpm` (если ещё не установлен):

   ```bash
   npm install -g pnpm
   ```

2. В корне проекта установите зависимости:
   ```bash
   pnpm install
   ```

## Запуск приложения

Используйте команды **строго в указанном порядке**:

1. Установите Docker Desktop

Проверьте доступность docker командой:

```bash
docker info
```

2. Поднимите инфраструктуру (PostgreSQL, MinIO, при необходимости — Prometheus и Grafana):

   ```bash
   docker-compose up
   ```

   Вместе с БД поднимаются **MinIO** (S3 API на порту `MINIO_PORT`, по умолчанию 9000; веб-консоль на `MINIO_CONSOLE_PORT`, по умолчанию 9001) и одноразовый контейнер **minio-init**, который создаёт бакет из `S3_BUCKET_PAYMENT_DOCUMENTS` (по умолчанию `payment-documents`). Учётные данные сервера задаются `MINIO_ROOT_USER` и `MINIO_ROOT_PASSWORD` (см. [`.env.example`](../.env.example)).

   Для загрузки PDF к платежам API читает переменные **`S3_ENDPOINT`**, **`S3_REGION`**, **`S3_ACCESS_KEY`**, **`S3_SECRET_KEY`**, **`S3_BUCKET_PAYMENT_DOCUMENTS`**, **`S3_FORCE_PATH_STYLE`** (`true` для MinIO). При запуске API на хосте укажите `S3_ENDPOINT=http://127.0.0.1:9000` (или порт из `MINIO_PORT`); ключи и секрет должны совпадать с `MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`.

   Для мониторинга метрик вместе с БД поднимаются сервисы **Prometheus** (порт 9090), **Grafana** (порт 3001) и **postgres_exporter** (порт 9187, метрики PostgreSQL). Источник данных Prometheus и дашборды «System metrics», «Business metrics» и «PostgreSQL» подключаются автоматически (provisioning). Логин Grafana по умолчанию: `admin`, пароль задаётся переменной `GF_ADMIN_PASSWORD` (по умолчанию `admin`). Чтобы Prometheus собирал метрики с API, запустите API на хосте (`pnpm nx serve api`); в конфиге используется `host.docker.internal:3000`.

3. В отдельном терминале запустите Front-end:

```bash
pnpm nx serve web
```

## Примечания

- Если порт `5432` занят (например, установлен PostgreSQL вне Docker), измените порт в `docker-compose.yaml` на свободный.
- **Мониторинг:** API отдаёт эндпоинты `/health` (проверка БД) и `/metrics` (метрики в формате Prometheus). После запуска `docker-compose up` откройте Grafana на http://localhost:3001 и используйте дашборды «System metrics», «Business metrics» и «PostgreSQL» (метрики БД через postgres_exporter).

## Создание компонента

Новый компонент создаётся командой:

```bash
pnpm nx generate @nx/angular:component libs/web/<guest|applicant|notary|admin|shared>/src/lib/features/<component_name>/<component_name> --standalone
```

Примеры:
Компонент в guest:

```bash
pnpm nx generate @nx/angular:component libs/web/guest/src/lib/features/login-form/login-form --standalone
```

Компонент в shared:

```bash
pnpm nx generate @nx/angular:component libs/web/shared/src/lib/features/button/button --standalone
```

Компонент в applicant:

```bash
pnpm nx generate @nx/angular:component libs/web/applicant/src/lib/features/dashboard/dashboard --standalone
```

Параметры:
guest, applicant, notary, admin, shared — целевая библиотека
<component_name> — имя компонента (дважды: путь и имя файла)
--standalone — standalone-компонент
Краткая форма:

```bash
pnpm nx g @nx/angular:component libs/web/guest/src/lib/features/my-component/my-component --standalone
```
