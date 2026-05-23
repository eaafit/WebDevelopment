# Логирование и аудит: трансфер технологии для Cursor

Инструкция описывает, **как в монорепозитории устроены технические (ops) логи и продуктовый аудит**, куда смотреть в коде и как добавлять новое поведение без смешения ответственности. Дополняет правило `.cursor/rules/observability-logging-pii.md`.

---

## 1. Два разных канала: не смешивать

| | **Ops-логи** | **Аудит (product audit)** |
|---|----------------|---------------------------|
| **Назначение** | Диагностика, ошибки, latency, трассировка запроса | События для мониторинга/расследований в админке, юридически значимые действия пользователей |
| **Хранение** | STDOUT, JSON (агрегация вне приложения: Loki и т.д.) | Таблица БД `audit_logs` (Prisma `AuditLog`) |
| **Типичный API** | Pino / Nest `Logger` | `AuditService.record()` |
| **Содержимое** | Метод, путь, статус, duration, `requestId`; без тел и секретов | `eventType`, сущность, `before`/`after`, IP, User-Agent, человекочитаемые заголовки |

**Правило:** не писать «аудит» только в `console.log` / Pino; не складывать в `AuditLog` сырые стеки и внутренние tech-дампы. Ops — для разработки и SRE; аудит — для продукта и ограниченного круга ролей.

---

## 2. Ops-логирование — API (`apps/api`)

### Стек и входная точка

- **Pino** + **nestjs-pino**: `LoggingModule`, глобальный логгер Nest.
- В **`main.ts`**: `app.useLogger(app.get(PinoNestLogger))`, поверх Express — `createHttpLoggingMiddleware()` (лог завершения HTTP-запроса, request id, сериализация req/res без лишнего).

### Конфигурация

Файл: `apps/api/src/app/logging/logging.config.ts`

- Уровень: **`LOG_LEVEL`** или по умолчанию `info` (production) / `debug` (иначе).
- В каждой записи в `base`: `service: 'api'`, `env` из `NODE_ENV`.
- **Маскирование (redact):** пути вроде `authorization`, `cookie`, секреты вебхуков — см. `REDACTED_LOG_PATHS`.
- HTTP: кастомные уровни по коду ответа (5xx → error, 4xx → warn).

### Request ID и корреляция

- Файл: `apps/api/src/app/logging/request-id.ts`.
- Заголовок клиента: **`x-request-id`**; ответ: **`X-Request-Id`**.
- Fallback: **`traceparent`** (извлекается trace id) или новый UUID.
- CORS: в `main.ts` разрешены / экспонируются `X-Request-Id` и `traceparent`.

### Логирование в доменных сервисах

- Допустимы **`Logger` из `@nestjs/common`** или инжект Pino-контекста там, где принят в модуле.
- Паттерн из `assessment.service`: короткое текстовое сообщение + структурные поля через локальный **`formatLogFields`**, без PII и без больших объектов.

### Ошибки записи аудита

В **`AuditService.record`** при ошибке БД пишется **`Logger.warn`** (ops), сам бизнес-поток не падает — это норма для отказоустойчивости аудита.

---

## 3. Ops-логирование — веб (Angular)

- Сервис: **`WebLoggerService`** — `libs/web/shared/ui/src/lib/logging/web-logger.service.ts`.
- В production по умолчанию пишутся только **`warn`** и **`error`**; в dev — все уровни.
- Записи унифицированы: `service`, `env`, `level`, `message`, `timestamp`, опционально `context` (с санитизацией).
- **`sanitizeLogValue`**: маскирует чувствительные ключи (токены, пароли, платежи, паспорт и т.д.) — не обходить произвольными `console.log` с сырыми объектами.

---

## 4. Продуктовый аудит — бэкенд

### Модуль и хранилище

- Библиотека: **`libs/api/audit`** (`AuditModule`).
- **`AuditService`**: запись (`record`), список, экспорт (с лимитом строк и записью события `audit.exported`).
- **`AuditRepository`**: Prisma `auditLog.create` / выборки с фильтрами и скоупом (админ vs нотариус).

### Схема БД (`libs/api/shared/prisma/schema.prisma`, модель `AuditLog`)

- Колонки: `userId`, `actionType`, `entityName`, `entityId` (UUID), `timestamp`, `details` (JSONB).
- Индексы по времени, типу события, сущности, пользователю.

### Контекст запроса (кто и откуда)

- **`AsyncLocalStorage`**: `requestContextStorage` в `libs/api/shared/auth/src/lib/request-context.ts`.
- **`getCurrentUser()`** — payload доступа; **`getRequestMetadata()`** — `ip`, `userAgent`.
- Заполнение контекста: **`AuthInterceptor`** (`libs/api/auth/...`) вокруг каждого Connect-RPC вызова; IP прокидывается через **`REQUEST_IP_CONTEXT_KEY`** из **`main.ts`** (`contextValues` + `resolveRequestIp` с учётом `x-forwarded-for`).
- Для **публичных** методов (`Login`, `Register`, …) в контексте `user: null`, но **metadata** всё равно есть.

### Вызов `AuditService.record`

Интерфейс ввода: **`RecordAuditEventInput`** в `audit.service.ts`:

- **`eventType`**: строка вида `domain.action` (например `assessment.created`, `audit.exported`, константы вроде событий логина — см. `auth`).
- **`targetType` / `targetId`**: тип сущности и её UUID (для «не сущности» иногда используют осмысленные заглушки, см. `Security`, `AuditLog`).
- **`actionTitle` / `actionContext`**, **`targetTitle` / `targetContext`**: то, что видит пользователь в UI.
- **`before` / `after`**: снимки для diff (Prisma `JsonValue`); пустые поля из `details` отбрасываются (`compactJson`).
- **`actorUserId`**: если не задан, берётся **`getCurrentUser()?.sub`**; если итог **`null`**, **`record` тихо выходит** — событие **не сохраняется** (важно для системных сценариев: явно передавать актора, если он известен).

Примеры интеграции: **`assessment.service`**, **`auth.service`** (неудачный вход), **`payment-create`**, **`payment-attachment`**, **`transaction-history`**, **`payment-webhook`**.

### API для клиента

- Proto: **`libs/shared/api-contracts/proto/notary/audit/v1alpha1/audit.proto`** — `ListAuditEvents`, `ExportAuditEvents`.
- Реестр Connect: **`apps/api/src/app/connect-router.registry.ts`**.
- Фронт: **`audit-monitoring-api.service`** и связанные компоненты в `libs/web/shared/ui`.

### Доступ к просмотру

- В **`AuditService`**: **`requireRole(Role.Admin, Role.Notary)`** для list/export; нотариус видит ограниченный скоуп (заявки «свои»).

---

## 5. Метрики

- В **`MetricsService`** есть счётчик **`recordAuditEvent`** — при добавлении цепочки аудита при необходимости вызывайте его из точки записи (сейчас может быть не везде подключено; ориентир — единый стиль с другими `record*` метриками).

---

## 6. Чеклист для новой фичи

1. Нужна ли запись в **таблицу аудита** (действие пользователя / изменение сущности)? → **`auditService.record`** с понятным `eventType` и при необходимости `before`/`after`.
2. Нужна ли **диагностика** (отладка, ошибки)? → **Pino / Nest `Logger`**, без тел запРосов и без секретов.
3. Есть ли актёр без JWT (например фоновый job)? → либо передавать **`actorUserId`**, либо осознанно не писать аудит.
4. Меняется ли контракт списка/экспорта? → **proto** в `api-contracts`, регенерация TS, фасад на фронте.
5. Не логировать в ops **PII/токены**; в аудит — только то, что допустимо по продуктовой политике (email в событиях безопасности уже есть в существующих паттернах — сохранять согласованность с текущими модулями).

---

## 7. Файлы-буёк (быстрый поиск)

| Тема | Путь |
|------|------|
| Pino / HTTP / redact | `apps/api/src/app/logging/logging.config.ts` |
| Request id | `apps/api/src/app/logging/request-id.ts` |
| Bootstrap логов | `apps/api/src/main.ts` |
| ALS пользователь + IP | `libs/api/shared/auth/src/lib/request-context.ts`, `libs/api/auth/src/lib/auth/auth.interceptor.ts` |
| Запись и чтение аудита | `libs/api/audit/src/lib/audit/audit.service.ts`, `audit.repository.ts` |
| Модель БД | `libs/api/shared/prisma/schema.prisma` → `AuditLog` |
| Контракт RPC | `libs/shared/api-contracts/proto/notary/audit/v1alpha1/audit.proto` |
| Веб-логер | `libs/web/shared/ui/src/lib/logging/web-logger.service.ts` |
| Политика PII / ссылки на issues | `.cursor/rules/observability-logging-pii.md`, `docs/issues/issue-22-*.md`, `issue-32-*.md`, `issue-33-*.md` |

---

## 8. Антипаттерны

- Писать значимые для compliance действия **только** в stdout без `AuditLog`.
- Логировать **тела** запросов/ответов и **сырые** заголовки Authorization в Pino.
- Вызывать **`getRequestContext()`** вне запроса Connect (бросает) — для опционального чтения использовать **`getCurrentUser()`** / **`getRequestMetadata()`**, которые безопасно отдают дефолты.
- Считать, что аудит записался, **не проверяя** наличие `actorUserId` / текущего пользователя.
