# План разработки gRPC-контрактов для сохранения данных форм в БД

## Цель

Создать gRPC-контракты (proto-файлы) для API сохранения данных, вводимых пользователями в формах веб-приложения, в базу данных PostgreSQL.

## Область применения

Формы в приложении «Нотариальная оценка»:

| Форма | Сущность БД | Действие | Существующий контракт |
|-------|-------------|----------|------------------------|
| Заявка на оценку | Assessment | Create, Update | assessment.proto ✓ |
| Профиль пользователя | User | Update | user.proto ✓ |
| Документ к заявке | Document | Create | — |
| Подписка нотариуса | Subscription | Create | payment.proto (частично) |
| Платёж | Payment | Create | payment.proto ✓ |

## Шаги плана

### Шаг 1. Создать `forms.proto` — единый сервис для форм

**Файл:** `libs/shared/api-contracts/proto/notary/forms/v1alpha1/forms.proto`

**Сервис FormsService** — агрегирует операции сохранения данных форм:

- `SaveAssessmentForm` — создание/обновление заявки (делегирует в AssessmentService или дублирует)
- `SaveDocumentForm` — создание документа (метаданные после загрузки файла)
- `SaveUserProfileForm` — обновление профиля (делегирует в UserService)

**Примечание:** Assessment и User уже имеют свои сервисы. FormsService может либо вызывать их, либо дублировать RPC для удобства фронтенда (единая точка входа для форм).

**Решение:** FormsService как фасад — один сервис для всех операций сохранения данных форм. Переиспользует сообщения из assessment, user, document.

### Шаг 2. Создать `document.proto` — сущность Document

**Файл:** `libs/shared/api-contracts/proto/notary/document/v1alpha1/document.proto`

**DocumentService:**

- `CreateDocument` — сохранение метаданных документа (assessment_id, file_name, file_type, file_path, uploaded_by)
- `GetDocument` — получение документа по id
- `ListDocumentsByAssessment` — список документов заявки

**Сообщения:** Document, CreateDocumentRequest/Response, GetDocumentRequest/Response, ListDocumentsRequest/Response.

### Шаг 3. Расширить `payment.proto` — CreateSubscription

**Файл:** `libs/shared/api-contracts/proto/notary/payment/v1alpha1/payment.proto`

**Добавить в PaymentService:**

- `CreateSubscription` — создание подписки (user_id, plan, start_date, end_date)
- `UpdateSubscription` — обновление подписки (опционально)

### Шаг 4. Валидация proto-файлов

- Запуск `buf lint` в `libs/shared/api-contracts`
- Запуск `buf format --write` для форматирования
- Проверка `buf breaking` при необходимости

### Шаг 5. Генерация кода и интеграция с NestJS

- Добавить `buf generate` или аналог для генерации TypeScript/Node.js из proto
- Настроить NestJS gRPC microservice в `apps/api`
- Реализовать FormsController/FormsService, DocumentController/DocumentService
- Подключить Prisma для записи в БД

### Шаг 6. Документация

- Обновить `libs/shared/api-contracts/README.md` с описанием forms и document
- Добавить примеры вызовов gRPC

## Маппинг форм → proto → Prisma

| Форма | Proto RPC | Prisma Model |
|-------|-----------|--------------|
| Заявка (создать) | CreateAssessment / SaveAssessmentForm | Assessment |
| Заявка (редактировать) | UpdateAssessment / SaveAssessmentForm | Assessment |
| Профиль | UpdateProfile / SaveUserProfileForm | User |
| Документ | CreateDocument / SaveDocumentForm | Document |
| Подписка | CreateSubscription | Subscription |
| Платёж | CreatePayment | Payment |

## Версионность

Все новые контракты — `v1alpha1` (нестабильные, допускаются изменения).

## Порядок выполнения

1. ✅ Создать план (этот документ)
2. ✅ Создать `forms.proto` — FormsService с SaveAssessmentForm, SaveUserProfileForm, SaveDocumentForm
3. ✅ Создать `document.proto` — DocumentService с CreateDocument, GetDocument, ListDocumentsByAssessment
4. ✅ Расширить `payment.proto` — CreateSubscription, CreateSubscriptionRequest/Response
5. ✅ Добавить `buf.gen.yaml` и target `generate-proto` в api-contracts
6. ✅ Обновить README api-contracts
7. Запустить `pnpm nx run api-contracts:lint-proto` для валидации
8. Установить `ts-proto` и запустить `pnpm nx run api-contracts:generate-proto` для генерации TypeScript
9. Интеграция NestJS gRPC в `apps/api` (отдельная задача)
