# План заполнения seed.ts примерами данных

Документ описывает, какие сущности и поля заполняются в `libs/api/shared/prisma/seed.ts`. Целевой объём: **100 примеров каждой сущности** (константа `SEED_COUNT`, при необходимости задаётся через `SEED_SIZE` в окружении).

---

## 1. Обзор сущностей в schema.prisma

| Сущность         | Целевое кол-во | Покрытие полей | Реализация |
|------------------|----------------|----------------|------------|
| User             | 100            | полное         | Генерация в цикле; роли 50 Applicant / 30 Notary / 20 Admin; уникальный email |
| Assessment       | 100            | полное         | userId (applicants), notaryId (часть), статусы и cancelReason |
| Document         | 100            | полное         | documentType из enum; assessmentId, uploadedById из массивов id |
| Subscription     | 100            | полное         | basePrice, план Basic/Premium/Enterprise по циклу |
| Payment          | 100            | полное         | Уникальный transactionId; promoId, discountAmount для части записей |
| AssessmentReport | 100            | полное         | status Draft/Signed; assessmentId, signedById из массивов |
| Notification     | 100            | полное         | type Email/SMS/Push; readAt для части записей |
| RefreshToken     | 100            | полное         | Уникальный tokenHash; часть с revokedAt |
| AuditLog         | 100            | полное         | actionType и entityName из набора шаблонов; entityId из массивов |
| Promo            | 100            | полное         | Уникальный code; usageLimit, usedCount, expiresAt |
| Sale             | 100            | полное         | type по циклу; isActive; promoId для типа Promo |

---

## 2. Детальный план по сущностям

### 2.1 User
- **Текущее состояние:** 3 пользователя (Applicant, Notary, Admin).
- **Рекомендации:**
  - Оставить как есть или добавить 1–2 пользователя (например, второй заявитель/нотариус) для тестов списков и фильтров.
  - Все поля уже заполняются (email, passwordHash, fullName, role, phoneNumber, isActive).

### 2.2 Assessment
- **Дополнить поля:**
  - `notaryId` — для одной–двух заявок назначить нотариуса (например, для office и apartment).
  - `cancelReason` — добавить одну заявку со статусом `Cancelled` и заполненной причиной отмены.
- **Охват статусов:** уже есть New (через default), InProgress, Completed, Verified; добавить пример с **Cancelled**.

### 2.3 Document
- **Дополнить:**
  - Для каждой записи задать `documentType` из enum (Passport, PropertyDeed, TechnicalPlan, CadastralPassport, Photo, Other).
  - Рекомендуемые соответствия: passport.pdf → Passport, extract-egrn.pdf → CadastralPassport, ownership-certificate.pdf → PropertyDeed.
- Опционально: один документ типа Photo или TechnicalPlan для одной из заявок.

### 2.4 Subscription
- **Дополнить:**
  - `basePrice` — для каждой подписки указать цену на момент покупки (например, Premium 4990, Enterprise 14990).
  - Добавить подписку с планом **Basic** (для заявителя или второго нотариуса), чтобы все значения enum SubscriptionPlan были представлены в seed.

### 2.5 Payment
- **Дополнить:**
  - Для одного платежа (например, подписки со скидкой): заполнить `promoId` и `discountAmount`.
  - Остальные поля уже покрыты (type, status, paymentMethod, transactionId, attachmentFileName, attachmentFileUrl).

### 2.6 AssessmentReport
- **Дополнить:**
  - Явно задать `status`: один отчёт — Draft, другой — Signed (соответственно оставить/дополнить signedById и signatureData).
  - Поле `generatedAt` можно оставить по умолчанию или задать явно для наглядности.

### 2.7 Notification
- **Дополнить:**
  - Для одной записи указать `readAt` (прочитанное уведомление).
  - Остальные оставить без readAt (непрочитанные).

### 2.8 RefreshToken (новая секция)
- **Добавить функцию** `upsertRefreshTokens()` и вызвать её из `main()`.
- **Примеры:**
  - 2–3 токена для разных пользователей (applicant, notary, admin).
  - Один активный (expiresAt в будущем, revokedAt = null).
  - Один отозванный (revokedAt заполнен).
  - `tokenHash` — тестовые хеши (например, `seed-token-hash-1`, `seed-token-hash-2`), уникальные по схеме.

### 2.9 AuditLog
- **Текущее состояние:** 3 записи (assessment.created, payment.completed, report.signed).
- **Рекомендации:** оставить как есть или добавить 1–2 типа (например, user.login, subscription.created) для полноты демонстрации.

### 2.10 Promo
- **Дополнить:**
  - `usageLimit` — например 100.
  - `usedCount` — например 3 (если есть платежи с этим промо).
  - `expiresAt` — дата окончания акции (например, конец месяца/года).
- Опционально: второй промокод с истёкшим сроком (expiresAt в прошлом) или usageLimit = 0 для тестов фильтрации.

### 2.11 Sale
- **Дополнить:**
  - Явно задать `isActive: true` для существующей акции.
  - Опционально: вторая запись Sale с типом Permanent или Product (без привязки к промо/подписке), если нужны примеры для всех типов SaleType.

---

## 3. Порядок вызовов в main()

Зависимость от связей (сначала родители, потом сущности с FK):

1. `upsertUsers(SEED_COUNT)` → userIds
2. `upsertPromos(SEED_COUNT)` → promoIds
3. `upsertSales(SEED_COUNT, promoIds)`
4. `upsertAssessments(SEED_COUNT, userIds)` → assessmentIds
5. `upsertDocuments(SEED_COUNT, assessmentIds, userIds)`
6. `upsertSubscriptions(SEED_COUNT, userIds)` → subscriptionIds
7. `upsertPayments(SEED_COUNT, userIds, subscriptionIds, assessmentIds, promoIds)`
8. `upsertReports(SEED_COUNT, assessmentIds, userIds)`
9. `upsertNotifications(SEED_COUNT, userIds)`
10. `upsertRefreshTokens(SEED_COUNT, userIds)`
11. `upsertAuditLogs(SEED_COUNT, userIds, assessmentIds, promoIds)`

В конце main() выводятся счётчики по всем 11 сущностям (ожидаемо по 100 каждой при SEED_COUNT=100).

---

## 4. Идентификаторы и константы

- **SEED_COUNT:** константа (по умолчанию 100), при необходимости задаётся через переменную окружения `SEED_SIZE`.
- **Детерминированные id:** функция `seedId(entity, i)` генерирует UUID по имени сущности и индексу (SHA-256), что обеспечивает идемпотентность повторного запуска seed.
- **Массивы id:** каждая функция upsert возвращает или использует массивы созданных id (`userIds`, `assessmentIds`, `promoIds`, `subscriptionIds` и т.д.) для подстановки в FK на следующих шагах.

---

## 5. Импорты

В начале `seed.ts` при необходимости добавить:

- `DocumentType` (для Document),
- `ReportStatus` (для AssessmentReport).

Остальные enum уже импортированы.

---

## 6. Чек-лист реализации (выполнено)

- [x] Ввести SEED_COUNT и опционально SEED_SIZE из окружения
- [x] Реализовать генерацию 100 записей для User с распределением ролей и уникальным email
- [x] Реализовать Promo (100), Sale (100) с привязкой к промо
- [x] Реализовать Assessment, Document, Subscription (по 100) с опорой на сохранённые id
- [x] Реализовать Payment, AssessmentReport, Notification (по 100); обеспечить уникальность transactionId
- [x] Реализовать RefreshToken (100) с уникальным tokenHash; часть с revokedAt
- [x] Реализовать AuditLog (100) с шаблонами actionType/entityName
- [x] main(): порядок вызовов по зависимостям; вывод счётчиков по всем 11 сущностям
- [x] Детерминированные id (seedId) для идемпотентности

Seed содержит по 100 примеров каждой сущности и покрывает все основные поля и значения enum для разработки и тестирования UI/API.
