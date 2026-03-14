# 📊 Анализ покрытия пользовательских историй — версия 3.0

> Дата анализа: 2026-03-09
> Источники: `US.md`, `US2.md`, `US3.md`, `sitemap.md`, `Responsobility.md`,
> `api-contracts-by-module.md`, `DEVELOPMENT_PLAN.md`
>
> **Версия 3.0** — полный пересмотр на основе трёх файлов US, sitemap и матрицы ответственности.
> Добавлены истории из US3.md, проверена каждая страница sitemap.

---

## Сводная матрица покрытия

| ID    | Пользовательская история                                                                | Источник       | Экраны sitemap                                                        | API-сервис(ы)                                                                   | Статус                                        |
| ----- | --------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------- |
| US-01 | Новый пользователь регистрируется, получает подтверждение email/SMS, входит в систему   | US1/2/3        | `/auth`                                                               | AuthService: Register, Login                                                    | ⚠️ Частично                                   |
| US-02 | Пользователь восстанавливает пароль                                                     | US1/2/3        | `/auth`                                                               | AuthService: ForgotPassword, ResetPassword                                      | ❌ Не реализовано в proto                     |
| US-03 | Нотариус регистрируется через OAuth (VK/Google/Apple/Yandex)                            | US1/2/3, Resp. | `/auth`                                                               | AuthService: OAuthLogin                                                         | ❌ Не реализовано в proto                     |
| US-04 | Нотариус оформляет и оплачивает подписку онлайн                                         | US1/2/3        | `/notary/subscription`, `/notary/subscription/checkout`               | PaymentService: CreateSubscription                                              | ⚠️ Частично                                   |
| US-05 | Заявитель подаёт заявку, загружает документы, отслеживает статусы                       | US1/2/3        | `/applicant/orders/new`, `/applicant/orders`, `/applicant/orders/:id` | AssessmentService, DocumentService, FormsService                                | ✅ Покрыта                                    |
| US-06 | Нотариус просматривает, фильтрует и берёт заявки в работу                               | US1/2/3        | `/notary/orders`, `/notary/orders/:id`                                | AssessmentService: ListAssessments, VerifyAssessment                            | ✅ Покрыта                                    |
| US-07 | Пользователь получает уведомления о смене статуса (email/SMS/push) + история            | US1/2/3        | `/applicant/notifications`, `/notary/notifications`                   | NotificationService (не экспортирован)                                          | ⚠️ Частично                                   |
| US-08 | Нотариус оплачивает подписку картой или электронным кошельком                           | US1/2/3        | `/notary/subscription/checkout`, `/notary/transactions`               | PaymentService: CreatePayment, CreateSubscription                               | ⚠️ Частично                                   |
| US-09 | Заявитель оплачивает оценку → получает цифровой отчёт                                   | US1/2/3        | `/applicant/payments`, `/applicant/assessment/results`                | PaymentService + ReportService (не экспортирован)                               | ❌ Не покрыта                                 |
| US-10 | Нотариус формирует нотариально заверенный отчёт и отправляет заявителю                  | US1/2/3        | `/notary/orders/:id`                                                  | ReportService: CreateReport, SignReport (не экспортирован)                      | ❌ Не покрыта                                 |
| US-11 | Заявитель скачивает копии отчётов в личном кабинете                                     | US1/2/3        | `/applicant/assessment/results`, `/applicant/documents`               | ReportService: GetReport, ListReports (не экспортирован)                        | ❌ Не покрыта                                 |
| US-12 | Пользователь заказывает дополнительные копии документов с оплатой                       | US1/2/3        | `/applicant/copies`, `/notary/copies`                                 | SaleService (не экспортирован) + PaymentService                                 | ❌ Не покрыта                                 |
| US-13 | Пользователь загружает документы в различных форматах                                   | US1/2/3        | `/applicant/documents`, `/applicant/orders/:id`                       | DocumentService: CreateDocument, ListDocuments                                  | ✅ Покрыта                                    |
| US-14 | Нотариус просматривает PDF с масштабированием и поиском по тексту                       | US1/2/3        | `/notary/orders/:id`                                                  | DocumentService: GetDocument                                                    | ⚠️ Частично (iframe, нет pdf.js поиска)       |
| US-15 | Администратор управляет пользователями, заказами, платежами, тарифами                   | US1/2/3        | `/admin/users`, `/admin/orders`, `/admin/payments`, `/admin/plans`    | UserService, AssessmentService, PaymentService, PromoService (не экспортирован) | ⚠️ Частично                                   |
| US-16 | Администратор: отчёты о платежах, активность нотариусов, статистика                     | US1/2/3        | `/admin/statistics`, `/admin/monitoring`                              | ReportService + AuditLogService (оба не экспортированы)                         | ❌ Не покрыта                                 |
| US-17 | Пользователь получает консультацию через чат или оператора                              | US1/2/3        | `/applicant/support`, `/notary/support`                               | SupportService (proto не написан)                                               | ❌ Не покрыта                                 |
| US-18 | Заявитель вводит характеристики недвижимости (адрес, площадь, состояние)                | US1/2/3        | `/applicant/assessment`                                               | AssessmentService, FormsService                                                 | ✅ Покрыта                                    |
| US-19 | Нотариус видит историю оценок по объекту с доступом к прежним отчётам                   | US1/2/3        | `/notary/assessment`, `/applicant/assessment/history`                 | AssessmentService + ReportService (не экспортирован)                            | ⚠️ Частично                                   |
| US-20 | Заявитель редактирует заявку до начала оценки (добавляет/исправляет документы)          | **US3**        | `/applicant/orders/:id`                                               | AssessmentService: UpdateAssessment, DocumentService                            | ⚠️ Частично (метод есть, UI не описан)        |
| US-21 | Нотариус запрашивает доп. документы или уточнения через систему сообщений               | **US3**        | `/notary/orders/:id`                                                  | SupportService / TicketMessage                                                  | ❌ Не покрыта                                 |
| US-22 | Заявитель получает уведомление о необходимости предоставить доп. данные                 | **US3**        | `/applicant/notifications`                                            | NotificationService (не экспортирован)                                          | ❌ Не покрыта                                 |
| US-23 | Нотариус использует шаблоны и рекомендации по оценке разных видов наследства            | **US3**        | `/notary/assessment`                                                  | FormsService / новый TemplateService                                            | ❌ Не покрыта                                 |
| US-24 | Заявитель отменяет или приостанавливает заявку с корректировкой оплаты                  | **US3**        | `/applicant/orders/:id`                                               | AssessmentService: CancelAssessment, PaymentService: Refund                     | ⚠️ Частично (Cancel есть, Refund нет в proto) |
| US-25 | Администратор ведёт мониторинг жалоб и споров по оценкам                                | **US3**        | `/admin/monitoring`                                                   | AuditLogService + SupportService (не реализованы)                               | ❌ Не покрыта                                 |
| US-26 | Нотариус: аналитический модуль качества работы и статистики                             | **US3**        | `/notary/assessment` (нет в sitemap)                                  | ReportService + AssessmentService (агрегация)                                   | ❌ Не покрыта в sitemap                       |
| US-27 | Заявитель сохраняет промежуточные результаты и возвращается к ним                       | **US3**        | `/applicant/orders/:id`                                               | FormsService: SaveAssessmentForm (черновик)                                     | ⚠️ Частично (метод есть, TTL/UI не описан)    |
| US-28 | Нотариус: интеграция с Росреестром для автозаполнения данных                            | **US3**        | `/applicant/assessment`, `/notary/assessment`                         | Новый GovIntegrationService                                                     | ❌ Не покрыта                                 |
| US-29 | Пользователь делится результатами оценки с другими наследниками (разграничение доступа) | **US3**        | Нет в sitemap                                                         | Новый ShareService или расширение ReportService                                 | ❌ Не покрыта и нет экрана                    |
| US-30 | Пользователь получает FAQ и справочную информацию                                       | Resp.          | `/faq`, `/applicant/faq`, `/notary/faq`                               | KnowledgeService (proto не написан)                                             | ❌ Не покрыта                                 |

**Итог:** ✅ Полностью — 4 | ⚠️ Частично — 9 | ❌ Не покрыта — 17

---

## Экраны sitemap без реализации в плане

| Путь                                       | Что отсутствует                                                                          |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `/auth` (OAuth)                            | AuthService: OAuthLogin не описан в proto                                                |
| `/auth` (VerifyEmail / VerifyPhone)        | AuthService: SendEmailVerification, VerifyEmail, SendPhoneOtp, VerifyPhone — нет в proto |
| `/auth/forgot-password`                    | AuthService: ForgotPassword — нет в proto                                                |
| `/auth/reset-password`                     | AuthService: ResetPassword — нет в proto                                                 |
| `/applicant/assessment/results`            | ReportService: GetReport, ListReports — не экспортирован                                 |
| `/applicant/copies`, `/notary/copies`      | SaleService — не экспортирован, frontend не описан                                       |
| `/applicant/support`, `/notary/support`    | SupportService — proto не написан                                                        |
| `/applicant/faq`, `/notary/faq`, `/faq`    | KnowledgeService — proto не написан                                                      |
| `/notary/assessment` (аналитика нотариуса) | Нет маршрута для статистики нотариуса                                                    |
| `/admin/subscriptions`                     | PaymentService: ListSubscriptions — нет в proto                                          |
| `/admin/newsletter`                        | NotificationService: SendBroadcast — нет в proto                                         |
| `/admin/settings`                          | SettingsService — не существует                                                          |
| `/admin/files`                             | DocumentService: ModerateDocument — нет в proto                                          |
| `/admin/monitoring` (жалобы/споры)         | AuditLogService + SupportService — не экспортированы                                     |
| Нет экрана                                 | Совместный доступ к отчёту (US-29) — маршрут не определён                                |
| Нет экрана                                 | Аналитика нотариуса по собственным заказам (US-26)                                       |

---

## Детальный план закрытия пробелов

---

### 🔴 БЛОК 1 — Auth: недостающие методы (закрывает US-01, US-02, US-03)

#### 1.1 Добавить методы в `auth/v1alpha1/auth.proto`

```protobuf
// Восстановление пароля
message ForgotPasswordRequest  { string email = 1; }
message ForgotPasswordResponse {}   // всегда успех — не раскрываем существование email

message ResetPasswordRequest   { string token = 1; string new_password = 2; }
message ResetPasswordResponse  {}

// Подтверждение email
message SendEmailVerificationRequest  {}   // email берётся из JWT-контекста
message SendEmailVerificationResponse {}

message VerifyEmailRequest   { string code = 1; }
message VerifyEmailResponse  { bool verified = 1; }

// Подтверждение телефона
message SendPhoneOtpRequest  { string phone = 1; }
message SendPhoneOtpResponse {}

message VerifyPhoneRequest   { string phone = 1; string code = 2; }
message VerifyPhoneResponse  { bool verified = 1; }

// OAuth
message OAuthLoginRequest    { string provider = 1; string code = 2; string redirect_uri = 3; }
message OAuthLoginResponse   { string access_token = 1; string refresh_token = 2; User user = 3; }

// Добавить в service AuthService:
rpc ForgotPassword        (ForgotPasswordRequest)        returns (ForgotPasswordResponse);
rpc ResetPassword         (ResetPasswordRequest)         returns (ResetPasswordResponse);
rpc SendEmailVerification (SendEmailVerificationRequest) returns (SendEmailVerificationResponse);
rpc VerifyEmail           (VerifyEmailRequest)           returns (VerifyEmailResponse);
rpc SendPhoneOtp          (SendPhoneOtpRequest)          returns (SendPhoneOtpResponse);
rpc VerifyPhone           (VerifyPhoneRequest)           returns (VerifyPhoneResponse);
rpc OAuthLogin            (OAuthLoginRequest)            returns (OAuthLoginResponse);
```

#### 1.2 Prisma schema — добавить в модель User и новая таблица

```prisma
// В модель User добавить поля:
// emailVerified  Boolean  @default(false) @map("email_verified")
// phoneVerified  Boolean  @default(false) @map("phone_verified")
// oauthProvider  String?  @map("oauth_provider")
// oauthId        String?  @map("oauth_id")

model PasswordReset {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamp()
  usedAt    DateTime? @map("used_at") @db.Timestamp()
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp()
  user      User      @relation(fields: [userId], references: [id])

  @@map("password_resets")
  @@index([userId])
}
```

#### 1.3 Backend — auth.service.ts расширить

```typescript
// ForgotPassword: silent при отсутствии email, token в PasswordReset, письмо через EmailQueue
// ResetPassword: валидация токена, bcrypt нового пароля, revoke всех RT пользователя
// VerifyEmail: OTP в Redis SET email_verify:{userId} {code} EX 86400, timingSafeEqual
// VerifyPhone: OTP в Redis SET phone_otp:{phone} {code} EX 300, timingSafeEqual, лимит 5 попыток
// OAuthLogin: exchangeCode → getProfile → upsert пользователя → issueTokens
```

#### 1.4 Frontend — `/auth` расширить

```typescript
// Добавить маршруты:
// /auth/forgot-password         — форма email → AuthService.ForgotPassword
// /auth/reset-password?token=   — форма нового пароля → AuthService.ResetPassword
// /auth (после Register)        — экран «Подтвердите email», форма кода → AuthService.VerifyEmail
// /auth → кнопки OAuth VK/Google/Apple/Yandex:
//   redirect: GET /api/auth/oauth/{provider}?redirect_uri=...
//   callback: AuthService.OAuthLogin({ provider, code, redirectUri })
```

---

### 🔴 БЛОК 2 — ReportService: экспорт + реализация (закрывает US-09, US-10, US-11, US-16, US-19)

#### 2.1 Экспортировать в `libs/shared/api-contracts/src/index.ts`

```typescript
export * from './gen/report/v1alpha1/report_pb';
export * from './gen/report/v1alpha1/report_connect';
```

#### 2.2 Backend — `libs/api/report/` создать

```
libs/api/report/src/lib/report/
├── report.repository.ts
├── report.service.ts
├── report-rpc.service.ts
└── report.module.ts
```

**Prisma schema — добавить модель:**

```prisma
model Report {
  id           String       @id @default(uuid()) @db.Uuid
  assessmentId String       @map("assessment_id") @db.Uuid
  notaryId     String       @map("notary_id") @db.Uuid
  status       ReportStatus @default(DRAFT)
  fileKey      String?      @map("file_key")       // путь в хранилище
  signedAt     DateTime?    @map("signed_at") @db.Timestamp()
  createdAt    DateTime     @default(now()) @map("created_at") @db.Timestamp()
  updatedAt    DateTime     @updatedAt @map("updated_at") @db.Timestamp()
  assessment   Assessment   @relation(fields: [assessmentId], references: [id])
  notary       User         @relation("NotaryReports", fields: [notaryId], references: [id])

  @@map("reports")
  @@index([assessmentId])
  @@index([notaryId])
  @@index([status])
}

enum ReportStatus { DRAFT SIGNED DELIVERED REJECTED }
```

**Ключевые бизнес-правила report.service.ts:**

```typescript
// createReport: requireRole(NOTARY), assessment.status == IN_PROGRESS
// signReport:   requireRole(NOTARY), report.status == DRAFT → SIGNED
//               после подписания → AssessmentService.updateStatus(COMPLETED)
//               → NotificationService.send({ userId: assessment.applicantId, type: REPORT_READY })
// getDownloadUrl: requireSelfOrRole(report.applicantId, NOTARY, ADMIN)
//                 → presigned URL хранилища (TTL 3600 сек)
// listByAssessment: заявитель видит только свои, нотариус — взятые в работу
```

#### 2.3 Frontend

```typescript
// /notary/orders/:id — добавить секцию «Отчёт»:
//   Кнопка «Создать отчёт» (статус IN_PROGRESS) → ReportService.CreateReport
//   Кнопка «Подписать и отправить» (статус DRAFT) → ReportService.SignReport
//   StatusBadgeComponent: DRAFT / SIGNED / DELIVERED / REJECTED

// /applicant/assessment/results — новый компонент:
//   Список отчётов: название, дата, статус
//   Кнопка «Скачать PDF» → ReportService.GetReport → window.open(downloadUrl, '_blank')
```

---

### 🔴 БЛОК 3 — SaleService: экспорт + реализация (закрывает US-12)

#### 3.1 Экспортировать

```typescript
export * from './gen/sale/v1alpha1/sale_pb';
export * from './gen/sale/v1alpha1/sale_connect';
```

#### 3.2 Prisma schema

```prisma
model Sale {
  id          String     @id @default(uuid()) @db.Uuid
  requesterId String     @map("requester_id") @db.Uuid
  documentIds String[]   @map("document_ids")
  price       Decimal    @db.Decimal(10,2)
  status      SaleStatus @default(PENDING)
  paymentId   String?    @map("payment_id") @db.Uuid
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamp()
  updatedAt   DateTime   @updatedAt @map("updated_at") @db.Timestamp()
  requester   User       @relation(fields: [requesterId], references: [id])

  @@map("sales")
  @@index([requesterId])
  @@index([status])
}

enum SaleStatus { PENDING IN_PROGRESS COMPLETED CANCELLED }
```

**Бизнес-логика:**

```typescript
// createSale: requireAuth, создать Sale(PENDING), создать Payment → вернуть paymentUrl
// confirmPayment (из webhook): Sale PENDING → IN_PROGRESS → уведомление заявителю
// deliverCopies: requireRole(ADMIN, NOTARY), создать Document для каждого fileKey,
//               Sale → COMPLETED, уведомление заявителю
```

#### 3.3 Frontend — `/applicant/copies` и `/notary/copies`

```typescript
// 3 шага (WizardComponent):
// Шаг 1: выбор документов (DocumentService.ListDocuments) + прикрепление оснований
// Шаг 2: расчёт стоимости + оплата (SaleService.CreateSale → paymentUrl → редирект)
// Шаг 3: polling SaleService.GetSale до статуса COMPLETED → ссылки на скачивание
```

---

### 🔴 БЛОК 4 — SupportService: proto + реализация (закрывает US-17, US-21, US-22, US-25)

#### 4.1 Создать `libs/shared/api-contracts/proto/support/v1alpha1/support.proto`

```protobuf
syntax = "proto3";
package notary.support.v1alpha1;

import "google/protobuf/timestamp.proto";

enum TicketStatus {
  TICKET_STATUS_UNSPECIFIED = 0;
  TICKET_STATUS_OPEN        = 1;
  TICKET_STATUS_IN_PROGRESS = 2;
  TICKET_STATUS_RESOLVED    = 3;
  TICKET_STATUS_CLOSED      = 4;
}

enum TicketPriority {
  TICKET_PRIORITY_UNSPECIFIED = 0;
  TICKET_PRIORITY_LOW         = 1;
  TICKET_PRIORITY_MEDIUM      = 2;
  TICKET_PRIORITY_HIGH        = 3;
  TICKET_PRIORITY_URGENT      = 4;
}

message Ticket {
  string id              = 1;
  string subject         = 2;
  TicketStatus status    = 3;
  TicketPriority priority = 4;
  string author_id       = 5;
  string assessment_id   = 6;  // опционально — связь с заявкой
  google.protobuf.Timestamp sla_deadline = 7;
  google.protobuf.Timestamp created_at   = 8;
  google.protobuf.Timestamp updated_at   = 9;
}

message TicketMessage {
  string id        = 1;
  string ticket_id = 2;
  string author_id = 3;
  string text      = 4;
  repeated string attachment_ids = 5;
  google.protobuf.Timestamp created_at = 6;
}

message CreateTicketRequest  { string subject = 1; string text = 2; TicketPriority priority = 3; string assessment_id = 4; }
message CreateTicketResponse { Ticket ticket = 1; }
message GetTicketRequest     { string id = 1; }
message GetTicketResponse    { Ticket ticket = 1; }
message ListTicketsRequest   { int32 page = 1; int32 page_size = 2; TicketStatus status = 3; }
message ListTicketsResponse  { repeated Ticket tickets = 1; int32 total = 2; }
message AddMessageRequest    { string ticket_id = 1; string text = 2; repeated string attachment_ids = 3; }
message AddMessageResponse   { TicketMessage message = 1; }
message ListMessagesRequest  { string ticket_id = 1; int32 page = 1; int32 page_size = 2; }
message ListMessagesResponse { repeated TicketMessage messages = 1; int32 total = 2; }
message CloseTicketRequest   { string id = 1; string resolution = 2; }
message CloseTicketResponse  { Ticket ticket = 1; }

service SupportService {
  rpc CreateTicket  (CreateTicketRequest)  returns (CreateTicketResponse);
  rpc GetTicket     (GetTicketRequest)     returns (GetTicketResponse);
  rpc ListTickets   (ListTicketsRequest)   returns (ListTicketsResponse);
  rpc AddMessage    (AddMessageRequest)    returns (AddMessageResponse);
  rpc ListMessages  (ListMessagesRequest)  returns (ListMessagesResponse);
  rpc CloseTicket   (CloseTicketRequest)   returns (CloseTicketResponse);
}
```

#### 4.2 Prisma schema

```prisma
model Ticket {
  id           String         @id @default(uuid()) @db.Uuid
  subject      String
  status       TicketStatus   @default(OPEN)
  priority     TicketPriority @default(MEDIUM)
  authorId     String         @map("author_id") @db.Uuid
  assessmentId String?        @map("assessment_id") @db.Uuid
  slaDeadline  DateTime       @map("sla_deadline") @db.Timestamp()
  resolvedAt   DateTime?      @map("resolved_at") @db.Timestamp()
  createdAt    DateTime       @default(now()) @map("created_at") @db.Timestamp()
  updatedAt    DateTime       @updatedAt @map("updated_at") @db.Timestamp()
  messages     TicketMessage[]
  author       User           @relation(fields: [authorId], references: [id])

  @@map("tickets")
  @@index([authorId])
  @@index([status])
  @@index([assessmentId])
}

model TicketMessage {
  id            String   @id @default(uuid()) @db.Uuid
  ticketId      String   @map("ticket_id") @db.Uuid
  authorId      String   @map("author_id") @db.Uuid
  text          String
  attachmentIds String[] @map("attachment_ids")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp()
  ticket        Ticket   @relation(fields: [ticketId], references: [id])
  author        User     @relation("TicketMessageAuthor", fields: [authorId], references: [id])

  @@map("ticket_messages")
  @@index([ticketId])
}

enum TicketStatus   { OPEN IN_PROGRESS RESOLVED CLOSED }
enum TicketPriority { LOW MEDIUM HIGH URGENT }
```

**Бизнес-правила support.service.ts:**

```typescript
// createTicket: SLA deadline по приоритету:
//   URGENT=2ч, HIGH=8ч, MEDIUM=24ч, LOW=72ч
//   Уведомление нотариусу если assessmentId указан
// addMessage: только автор тикета или ADMIN могут писать
//   После каждого нового сообщения → NotificationService.send({ type: NEW_TICKET_MESSAGE })
// closeTicket: только автор или ADMIN, записать resolvedAt
```

#### 4.3 Frontend — `/applicant/support` и `/notary/support`

```typescript
// Двухпанельный layout:
// Левая: DataTableComponent со списком тикетов (фильтр по статусу)
// Правая: активный тикет
//   - Заголовок, статус badge, SLA-таймер (computed: deadline - Date.now())
//     цвет: >4ч=green, 1–4ч=yellow, <1ч=red
//   - Список сообщений (polling каждые 10 сек: timer(0, 10_000).pipe(switchMap(...)))
//   - Форма: TextareaComponent + FileUploadComponent → SupportService.AddMessage
//   - Кнопка «Закрыть тикет» (только автор) → ConfirmDialogComponent → SupportService.CloseTicket

// Нотариус из /notary/orders/:id может создать тикет с assessmentId:
// «Запросить доп. документы» → SupportService.CreateTicket({ assessmentId, ... })
//   → заявитель получает NotificationService уведомление (US-22)
```

---

### 🔴 БЛОК 5 — KnowledgeService: proto + реализация (закрывает US-30)

#### 5.1 Создать `libs/shared/api-contracts/proto/knowledge/v1alpha1/knowledge.proto`

```protobuf
syntax = "proto3";
package notary.knowledge.v1alpha1;

import "google/protobuf/timestamp.proto";

message Category {
  string id            = 1;
  string slug          = 2;
  string name          = 3;
  int32  article_count = 4;
}

message Article {
  string id          = 1;
  string slug        = 2;
  string title       = 3;
  string content     = 4;  // Markdown/HTML
  string author_id   = 5;
  string category_id = 6;
  int32  view_count  = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}

message ListCategoriesRequest  {}
message ListCategoriesResponse { repeated Category categories = 1; }
message GetCategoryRequest     { string slug = 1; }
message GetCategoryResponse    { Category category = 1; }
message GetArticleRequest      { string slug = 1; }
message GetArticleResponse     { Article article = 1; }
message SearchArticlesRequest  {
  string query     = 1;
  string logic     = 2;  // AND | OR | CONTAINS | EQUAL | LEFT | RIGHT
  string author_id = 3;
  int32  page      = 4;
  int32  page_size = 5;
}
message SearchArticlesResponse { repeated Article articles = 1; int32 total = 2; }

service KnowledgeService {
  rpc ListCategories (ListCategoriesRequest)  returns (ListCategoriesResponse);
  rpc GetCategory    (GetCategoryRequest)     returns (GetCategoryResponse);
  rpc GetArticle     (GetArticleRequest)      returns (GetArticleResponse);
  rpc SearchArticles (SearchArticlesRequest)  returns (SearchArticlesResponse);
}
```

#### 5.2 Prisma schema

```prisma
model KnowledgeCategory {
  id       String             @id @default(uuid()) @db.Uuid
  slug     String             @unique
  name     String
  articles KnowledgeArticle[]

  @@map("knowledge_categories")
}

model KnowledgeArticle {
  id         String            @id @default(uuid()) @db.Uuid
  slug       String            @unique
  title      String
  content    String            @db.Text
  authorId   String            @map("author_id") @db.Uuid
  categoryId String            @map("category_id") @db.Uuid
  viewCount  Int               @default(0) @map("view_count")
  createdAt  DateTime          @default(now()) @map("created_at") @db.Timestamp()
  updatedAt  DateTime          @updatedAt @map("updated_at") @db.Timestamp()
  author     User              @relation("ArticleAuthor", fields: [authorId], references: [id])
  category   KnowledgeCategory @relation(fields: [categoryId], references: [id])

  @@map("knowledge_articles")
  @@index([categoryId])
}
```

**Backend — knowledge.service.ts:**

```typescript
// searchArticles: full-text search PostgreSQL
//   WHERE to_tsvector('russian', title || ' ' || content)
//         @@ plainto_tsquery('russian', query)
//   AND/OR: to_tsquery с явными операторами
//   LEFT/RIGHT: ts_query prefix matching
```

**Frontend — `/faq`, `/applicant/faq`, `/notary/faq`:**

```typescript
// /faq            — категории + рекомендованные статьи + строка поиска (публичный)
// /faq/category/:slug — список статей категории
// /faq/article/:slug  — контент, breadcrumb, prev/next
// /faq/search?q=...&logic=OR — HighlightPipe для подсветки совпадений
//   HighlightPipe: DomSanitizer.bypassSecurityTrustHtml после sanitize
// Поиск по логике: фильтр-бар с RadioGroupComponent для выбора AND/OR/CONTAINS/EQUAL/LEFT/RIGHT
// Фильтр по автору: SelectComponent → KnowledgeService.SearchArticles({ authorId })
```

---

### 🟡 БЛОК 6 — NotificationService: экспорт + расширение (закрывает US-07, US-22)

#### 6.1 Экспортировать

```typescript
export * from './gen/notification/v1alpha1/notification_pb';
export * from './gen/notification/v1alpha1/notification_connect';
```

#### 6.2 Добавить методы в `notification.proto`

```protobuf
// Настройки каналов
message ChannelSettings {
  bool email_enabled = 1;
  bool sms_enabled   = 2;
  bool push_enabled  = 3;
}
message GetChannelSettingsRequest    {}
message GetChannelSettingsResponse   { ChannelSettings settings = 1; }
message UpdateChannelSettingsRequest {
  bool email_enabled = 1;
  bool sms_enabled   = 2;
  bool push_enabled  = 3;
}
message UpdateChannelSettingsResponse { ChannelSettings settings = 1; }

// Широковещательная рассылка (только Admin)
message SendBroadcastRequest  { string subject = 1; string body = 2; repeated string role_filter = 3; }
message SendBroadcastResponse { int32 recipients_count = 1; }

// Добавить в service NotificationService:
rpc GetChannelSettings    (GetChannelSettingsRequest)    returns (GetChannelSettingsResponse);
rpc UpdateChannelSettings (UpdateChannelSettingsRequest) returns (UpdateChannelSettingsResponse);
rpc SendBroadcast         (SendBroadcastRequest)         returns (SendBroadcastResponse);
```

#### 6.3 Backend — канальный роутинг

```typescript
// notification.service.ts — send():
// 1. Всегда сохранить in-app уведомление
// 2. Получить ChannelSettings пользователя
// 3. Если emailEnabled → EmailQueue.add({ type, payload })
// 4. Если smsEnabled   → SmsQueue.add({ type, payload })
// 5. Если pushEnabled  → PushQueue.add({ type, payload })
```

#### 6.4 Frontend

```typescript
// /*/notifications — NotificationPollingService:
//   timer(0, 30_000).pipe(switchMap(() => api.list({ unread: true, limit: 5 })), takeUntilDestroyed())
// /*/notifications/settings — тогглы Email/SMS/Push:
//   NotificationService.GetChannelSettings → UpdateChannelSettings (debounce 500ms)
// /admin/newsletter — NotificationService.SendBroadcast:
//   Форма: subject + body (rich text) + role_filter (чекбоксы) + кнопка «Отправить»
//   Предпросмотр количества получателей перед отправкой
```

---

### 🟡 БЛОК 7 — PromoService: экспорт + реализация (закрывает US-15, `/admin/plans`)

#### 7.1 Экспортировать

```typescript
export * from './gen/promo/v1alpha1/promo_pb';
export * from './gen/promo/v1alpha1/promo_connect';
```

#### 7.2 Prisma schema

```prisma
model Promo {
  id         String    @id @default(uuid()) @db.Uuid
  code       String    @unique
  type       PromoType
  value      Decimal   @db.Decimal(10,2)
  usageLimit Int?      @map("usage_limit")
  usageCount Int       @default(0) @map("usage_count")
  expiresAt  DateTime? @map("expires_at") @db.Timestamp()
  isActive   Boolean   @default(true) @map("is_active")
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamp()
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamp()

  @@map("promos")
  @@index([code])
  @@index([isActive])
}

enum PromoType { PERCENT FIXED }
```

**Бизнес-правила promo.service.ts:**

```typescript
// validatePromo: найти по коду, проверить expiresAt < now() → FailedPrecondition
//               usageCount >= usageLimit → FailedPrecondition
//               вернуть discount (PERCENT: amount * value / 100, FIXED: value)
// createPromo:  requireRole(ADMIN)
// deactivatePromo: requireRole(ADMIN), promo.isActive → false
```

**Frontend — `/admin/plans`:**

```typescript
// TabsComponent: «Тарифные планы» | «Промокоды»
// Вкладка «Тарифные планы»: DataTableComponent + DrawerComponent для CRUD
// Вкладка «Промокоды»:
//   DataTableComponent: код, тип скидки, использование/лимит, срок, статус
//   Создание: DrawerComponent + форма
//   Деактивация: toggle → PromoService.UpdatePromo({ isActive: false })
```

---

### 🟡 БЛОК 8 — AuditLogService: экспорт + реализация (закрывает US-16, US-25)

#### 8.1 Экспортировать

```typescript
export * from './gen/audit/v1alpha1/audit_pb';
export * from './gen/audit/v1alpha1/audit_connect';
```

#### 8.2 Prisma schema

```prisma
model AuditLog {
  id         String      @id @default(uuid()) @db.Uuid
  actorId    String      @map("actor_id") @db.Uuid
  action     AuditAction
  entityType String      @map("entity_type")
  entityId   String      @map("entity_id")
  changes    Json?       // { before: {}, after: {} }
  ipAddress  String?     @map("ip_address")
  userAgent  String?     @map("user_agent")
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamp()
  actor      User        @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt(sort: Desc)])
}

enum AuditAction { CREATE UPDATE DELETE LOGIN LOGOUT EXPORT STATUS_CHANGE MODERATION }
```

**Backend — интеграция:**

```typescript
// AuditLogService.log() вызывается через EventEmitter2:
// @OnEvent('assessment.statusChanged') → log({ action: STATUS_CHANGE, ... })
// @OnEvent('user.deactivated')         → log({ action: UPDATE, ... })
// @OnEvent('payment.completed')        → log({ action: CREATE, entityType: 'Payment' })
// listAuditLogs: requireRole(ADMIN), поддержка фильтров по actorId/entityType/action/dateRange
```

**Frontend — `/admin/monitoring` и `/admin/statistics`:**

```typescript
// /admin/monitoring:
//   DataTableComponent: актор / действие / объект / когда / IP
//   FilterBarComponent: actorId, entityType, action, dateRange
//   Экспорт CSV: AuditLogService.ListAuditLogs(all) → Blob + BOM + revokeObjectURL

// /admin/statistics:
//   Секция 1: Метрики заявок — AssessmentService → группировка по статусу → BarChart
//   Секция 2: Выручка — PaymentService → группировка по дате → LineChart
//   Секция 3: Топ нотариусов — UserService.ListUsers(NOTARY) + AssessmentService → BarChart
//   Все charts: ChartComponent + период-селектор (today/week/month/year)
```

---

### 🟡 БЛОК 9 — Недостающие методы существующих сервисов

#### 9.1 PaymentService — добавить в `payment.proto`

```protobuf
// Управление подписками (для /admin/subscriptions)
message ListSubscriptionsRequest  { int32 page = 1; int32 page_size = 2; string user_id = 3; }
message ListSubscriptionsResponse { repeated Subscription subscriptions = 1; int32 total = 2; }
message CancelSubscriptionRequest  { string id = 1; string reason = 2; }
message CancelSubscriptionResponse { Subscription subscription = 1; }

// Возврат платежа (для US-24: отмена заявки + возврат)
message RefundPaymentRequest  { string payment_id = 1; string reason = 2; }
message RefundPaymentResponse { Payment payment = 1; }

// Метод оплаты
enum PaymentMethod {
  PAYMENT_METHOD_UNSPECIFIED   = 0;
  PAYMENT_METHOD_CARD          = 1;
  PAYMENT_METHOD_YOOMONEY      = 2;
  PAYMENT_METHOD_SBP           = 3;
  PAYMENT_METHOD_BANK_TRANSFER = 4;
}
// Добавить payment_method в CreatePaymentRequest и Payment message

rpc ListSubscriptions   (ListSubscriptionsRequest)   returns (ListSubscriptionsResponse);
rpc CancelSubscription  (CancelSubscriptionRequest)  returns (CancelSubscriptionResponse);
rpc RefundPayment       (RefundPaymentRequest)        returns (RefundPaymentResponse);
```

#### 9.2 DocumentService — добавить ModerateDocument

```protobuf
// Модерация файлов (для /admin/files)
enum ModerationResult {
  MODERATION_RESULT_UNSPECIFIED = 0;
  MODERATION_RESULT_ACCEPTED    = 1;
  MODERATION_RESULT_REJECTED    = 2;
}
message ModerateDocumentRequest  {
  string id               = 1;
  ModerationResult result = 2;
  string rejection_reason = 3;  // обязателен при REJECTED
}
message ModerateDocumentResponse { Document document = 1; }

rpc ModerateDocument (ModerateDocumentRequest) returns (ModerateDocumentResponse);
```

**Бизнес-логика:**

```typescript
// moderateDocument: requireRole(ADMIN)
// result=ACCEPTED → document.status = ACCEPTED
// result=REJECTED → document.status = REJECTED, rejectionReason сохранить
// В обоих случаях: уведомление загрузившему пользователю
```

#### 9.3 AssessmentService — добавить возврат при отмене (US-24)

```typescript
// cancelAssessment: уже существует
// Расширить: если заявка была оплачена → PaymentService.RefundPayment автоматически
// Статус: PAID → CANCELLATION_REQUESTED → (подтверждение возврата) → CANCELLED
```

---

### 🟡 БЛОК 10 — Недостающие экраны sitemap

#### 10.1 `/admin/subscriptions`

```typescript
// admin-subscriptions.component.ts
// DataTableComponent: пользователь | план | дата начала | дата конца | статус
// PaymentService.ListSubscriptions({ page, pageSize })
// Действия:
//   CancelSubscription → ConfirmDialogComponent → PaymentService.CancelSubscription
// Фильтр по userId: ввод ID или поиск по email через UserService.ListUsers
```

#### 10.2 `/admin/files` — модерация документов

```typescript
// admin-files.component.ts
// DataTableComponent: файл | тип | загрузил | дата | статус модерации
// DocumentService.ListDocuments({ moderationStatus: 'PENDING' })
// DrawerComponent для детального просмотра:
//   FilePreviewComponent (PDF/изображение)
//   Кнопка «Принять» → DocumentService.ModerateDocument({ result: ACCEPTED })
//   Кнопка «Отклонить» → TextareaComponent для причины → ModerateDocument({ result: REJECTED, reason })
```

#### 10.3 `/admin/settings`

```typescript
// Минимальная реализация через key-value API:
// GET  /api/settings → { maintenance: false, maxUploadMb: 20, ... }
// PUT  /api/settings → обновить значения
// UI: FormComponent с ConfigModule-style настройками
// Или отдельный SettingsService (proto + backend lib)
```

#### 10.4 Маршрут для аналитики нотариуса (US-26) — добавить в sitemap

```
Добавить: /notary/analytics — Моя аналитика
Функции:
  - Мои заказы за период: LineChart (ReportService.ListReports по notaryId)
  - Среднее время обработки заказа
  - Рейтинг среди нотариусов (если такая метрика нужна)
  - Экспорт своих данных (CSV)
```

#### 10.5 Маршрут для совместного доступа (US-29) — добавить в sitemap

```
Вариант A: расширить ReportService
  Добавить: ShareReport(reportId, emails[]) → создаёт ShareToken с TTL
  Маршрут: /shared/report/:token → публичная страница без auth

Вариант B: ограниченный доступ
  Пользователь приглашает другого наследника → RegisterAsApplicant → доступ к конкретной заявке
  Реализуется через модель AssessmentParticipant (M:N User ↔ Assessment)
```

---

### 🟡 БЛОК 11 — Payment → Report webhook: бизнес-логика (закрывает US-09)

```typescript
// apps/api/src/app/webhook.controller.ts
@Post('payments/webhook')
async handleWebhook(@Req() req: RawBodyRequest): Promise<void> {
  // 1. Верифицировать HMAC-SHA256 подпись
  const sig = req.headers['x-provider-signature'];
  this.paymentService.verifyWebhookSignature(req.rawBody, sig);

  const event = req.body;

  // 2. Обновить Payment.status
  const payment = await this.paymentService.updateStatus(event.paymentId, 'COMPLETED');

  // 3. Роутинг по типу сущности
  switch (payment.entityType) {
    case 'ASSESSMENT':
      await this.assessmentService.updateStatus(payment.entityId, 'PAID');
      await this.notificationService.send({
        userId: payment.userId,
        type:   'PAYMENT_CONFIRMED',
        title:  'Оплата подтверждена',
        body:   'Ваша заявка передана нотариусу для проведения оценки',
      });
      break;

    case 'SALE':
      await this.saleService.confirmPayment(payment.entityId);
      break;

    case 'SUBSCRIPTION':
      await this.paymentService.activateSubscription(payment.entityId);
      await this.notificationService.send({
        userId: payment.userId,
        type:   'SUBSCRIPTION_ACTIVATED',
        title:  'Подписка активирована',
        body:   'Вам доступны новые заявки',
      });
      break;
  }
}
```

---

### 🟢 БЛОК 12 — US-14: PDF-просмотр с поиском (улучшение)

```typescript
// Заменить <iframe> на pdf.js в FilePreviewComponent
// pnpm add pdfjs-dist

// pdf-viewer.component.ts
import * as pdfjsLib from 'pdfjs-dist';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'assets/pdf.worker.min.js';

@Component({ selector: 'lib-pdf-viewer', standalone: true })
export class PdfViewerComponent {
  @Input() url!: string;

  protected readonly pageCount = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly scale = signal(1.5);
  protected readonly searchQuery = signal('');
  protected readonly searchResult = signal<string | null>(null);

  private textContent = '';

  async loadPdf(url: string): Promise<void> {
    const doc = await pdfjsLib.getDocument(url).promise;
    this.pageCount.set(doc.numPages);
    await this.renderPage(doc, this.currentPage());
    await this.extractText(doc);
  }

  protected search(): void {
    const idx = this.textContent.toLowerCase().indexOf(this.searchQuery().toLowerCase());
    this.searchResult.set(
      idx === -1 ? 'Не найдено' : `Найдено на стр. ${this.getPageByOffset(idx)}`,
    );
  }
}
```

---

### 🟢 БЛОК 13 — US-23: Шаблоны для нотариуса (новый минимальный сервис)

```typescript
// Вариант: расширить FormsService
// Добавить в forms.proto:
message AssessmentTemplate {
  string id          = 1;
  string name        = 2;     // "Жилая недвижимость", "Автомобиль", "Ценные бумаги"
  string asset_type  = 3;
  bytes  form_data   = 4;     // JSON схема формы
}
message ListTemplatesRequest  {}
message ListTemplatesResponse { repeated AssessmentTemplate templates = 1; }
message GetTemplateRequest    { string id = 1; }
message GetTemplateResponse   { AssessmentTemplate template = 1; }

// В service FormsService:
rpc ListTemplates (ListTemplatesRequest) returns (ListTemplatesResponse);
rpc GetTemplate   (GetTemplateRequest)   returns (GetTemplateResponse);

// Frontend /notary/assessment:
// SelectComponent: выбор типа имущества → загрузить шаблон
// Предзаполнение формы из AssessmentTemplate.formData
```

---

### 🟢 БЛОК 14 — US-28: Интеграция с Росреестром

```typescript
// Отдельная lib: libs/api/gov-integration/
// GovIntegrationService.getPropertyInfo(cadastralNumber: string): Promise<PropertyInfo>
// 1. Запрос к ФГИС ЕГРН (требует API-ключ Росреестра)
// 2. Парсинг XML/JSON ответа
// 3. Кэш результатов в PostgreSQL (address_hash → данные, TTL 24ч)

// Frontend: в форме ввода параметров объекта (/applicant/assessment):
// Поле «Кадастровый номер» → кнопка «Получить данные»
// → GovIntegrationService.getPropertyInfo → автозаполнение: адрес, площадь, тип
```

---

## Обновлённый реестр proto-сервисов

| Сервис              | Proto   | Экспорт | Backend lib   | Фаза       |
| ------------------- | ------- | ------- | ------------- | ---------- |
| AuthService         | ✅ есть | ✅ да   | ✅ реализован | 1          |
| UserService         | ✅ есть | ✅ да   | ✅ реализован | 1          |
| AssessmentService   | ✅ есть | ✅ да   | ✅ реализован | 3          |
| DocumentService     | ✅ есть | ✅ да   | ✅ реализован | 3          |
| FormsService        | ✅ есть | ✅ да   | ✅ реализован | 3          |
| PaymentService      | ✅ есть | ✅ да   | ✅ реализован | 5          |
| ReportService       | ✅ есть | ❌ нет  | ❌ нужен      | **Блок 2** |
| NotificationService | ✅ есть | ❌ нет  | ❌ нужен      | **Блок 6** |
| AuditLogService     | ✅ есть | ❌ нет  | ❌ нужен      | **Блок 8** |
| PromoService        | ✅ есть | ❌ нет  | ❌ нужен      | **Блок 7** |
| SaleService         | ✅ есть | ❌ нет  | ❌ нужен      | **Блок 3** |
| SupportService      | ❌ нет  | ❌ нет  | ❌ нужен      | **Блок 4** |
| KnowledgeService    | ❌ нет  | ❌ нет  | ❌ нужен      | **Блок 5** |

---

## Приоритизированный план работ

| Блок | Что делать                                                                | Закрывает                   | Приоритет      | Исполнитель                         |
| ---- | ------------------------------------------------------------------------- | --------------------------- | -------------- | ----------------------------------- |
| 1    | Auth: ForgotPassword, ResetPassword, VerifyEmail, VerifyPhone, OAuthLogin | US-01, 02, 03               | 🔴 Критический | Игорь Васильев + Глеб Патлатюк      |
| 2    | ReportService: экспорт + backend + frontend                               | US-09, 10, 11, 16, 19       | 🔴 Критический | Золотухин Артём                     |
| 3    | SaleService: экспорт + backend + frontend (/copies)                       | US-12                       | 🔴 Критический | Имамов Д.Н.                         |
| 4    | SupportService: proto + backend + frontend (/support)                     | US-17, 21, 22, 25           | 🔴 Критический | Васорин Иван + Говор Сергей         |
| 5    | KnowledgeService: proto + backend + frontend (/faq)                       | US-30                       | 🔴 Критический | Титов Святослав + Рахманов Рахман   |
| 6    | NotificationService: экспорт + расширение + frontend settings             | US-07, 22                   | 🟡 Высокий     | Мирошник И.О.                       |
| 7    | PromoService: экспорт + backend + /admin/plans frontend                   | US-15                       | 🟡 Высокий     | Сазонтов Александр                  |
| 8    | AuditLogService: экспорт + backend + /admin/monitoring, /statistics       | US-16, 25                   | 🟡 Высокий     | Нибылицын Лукьян + Черненко Дмитрий |
| 9    | PaymentService: ListSubscriptions, CancelSubscription, RefundPayment      | US-24, /admin/subscriptions | 🟡 Высокий     | Трушин Евгений + Липовцев Родион    |
| 10   | DocumentService: ModerateDocument + /admin/files                          | /admin/files                | 🟡 Высокий     | Евсеев М.В.                         |
| 11   | Payment → Report webhook: бизнес-логика разблокировки                     | US-09                       | 🟠 Средний     | —                                   |
| 12   | /admin/subscriptions + /admin/newsletter + /admin/settings                | Sitemap                     | 🟠 Средний     | Сорокин Д.Э. + Карлов И.А.          |
| 13   | PDF-просмотр с поиском (pdf.js вместо iframe)                             | US-14                       | 🟠 Средний     | Головатый Константин                |
| 14   | US-20: UI редактирования заявки до начала оценки                          | US-20                       | 🟠 Средний     | Иванова София                       |
| 15   | US-26: /notary/analytics (добавить в sitemap)                             | US-26                       | 🟠 Средний     | Еременко Анастасия                  |
| 16   | US-27: Черновик формы в sessionStorage с TTL 24ч                          | US-27                       | 🟠 Средний     | Кузиков Михаил                      |
| 17   | FormsService: шаблоны для нотариуса (US-23)                               | US-23                       | 🟢 Низкий      | Салихов Эльдар                      |
| 18   | US-29: Совместный доступ к отчёту (ShareToken)                            | US-29                       | 🟢 Низкий      | —                                   |
| 19   | GovIntegrationService: Росреестр (US-28)                                  | US-28                       | 🟢 Низкий      | —                                   |
| 20   | Push-уведомления (Web Push + VAPID)                                       | US-07                       | 🟢 Низкий      | —                                   |
| 21   | SMS (SMSRU/Twilio)                                                        | US-07                       | 🟢 Низкий      | —                                   |

---

## Итоговая статистика покрытия

| Статус               | Кол-во US | %    |
| -------------------- | --------- | ---- |
| ✅ Полностью покрыта | 4         | 13%  |
| ⚠️ Частично покрыта  | 9         | 30%  |
| ❌ Не покрыта        | 17        | 57%  |
| **Итого**            | **30**    | 100% |

**После выполнения блоков 1–11 (критические + высокие):**
| Статус | Прогноз |
|--------|---------|
| ✅ Полностью | ~20 US (67%) |
| ⚠️ Частично | ~5 US (17%) |
| ❌ Не покрыта | ~5 US (17%) — только Low priority |

---

_Версия: 3.0 · 2026-03-09_
_Следующий шаг: начать с Блока 1 (Auth), выполнять параллельно Блоки 2, 3, 4, 5 в соответствии с матрицей ответственности из Responsobility.md_
