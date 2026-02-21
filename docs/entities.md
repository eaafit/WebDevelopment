# Сущности и поля базы данных PostgreSQL для нотариальной оценки наследства

---

## 1. Пользователь (User)

- `Id` (UUID, PK) — уникальный идентификатор пользователя
- `Email` (varchar, unique) — электронная почта
- `PasswordHash` (varchar) — хэш пароля
- `FullName` (varchar) — полное имя
- `Role` (enum: Applicant, Notary, Admin) — роль пользователя
- `PhoneNumber` (varchar) — телефон
- `IsActive` (boolean) — активность аккаунта
- `CreatedAt` (timestamp) — дата регистрации
- `UpdatedAt` (timestamp) — дата последнего обновления

## 2. Заявка на оценку (Assessment)

- `Id` (UUID, PK) — уникальный идентификатор заявки
- `UserId` (UUID, FK) — наследник, подавший заявку
- `Status` (enum: New, Verified, InProgress, Completed, Cancelled) — статус заявки
- `CreatedAt` (timestamp) — дата создания
- `UpdatedAt` (timestamp) — дата последнего обновления
- `Address` (varchar) — адрес объекта недвижимости
- `Description` (text) — описание объекта наследства
- `EstimatedValue` (numeric) — оценочная стоимость, если уже рассчитана

## 3. Документ (Document)

- `Id` (UUID, PK) — уникальный идентификатор документа
- `AssessmentId` (UUID, FK) — заявка, к которой относится документ
- `FileName` (varchar) — имя файла
- `FileType` (varchar) — тип файла (pdf, jpg, docx и др.)
- `FilePath` (varchar) — путь к файлу в хранилище
- `Version` (integer) — версия документа
- `UploadedAt` (timestamp) — дата загрузки
- `UploadedBy` (UUID, FK) — пользователь, загрузивший документ

## 4. Подписка (Subscription)

- `Id` (UUID, PK) — идентификатор подписки
- `UserId` (UUID, FK) — нотариус
- `Plan` (enum: Basic, Premium, Enterprise) — тариф
- `StartDate` (date) — дата начала
- `EndDate` (date) — дата окончания
- `IsActive` (boolean) — активность подписки

## 5. Платёж (Payment)

- `Id` (UUID, PK) — идентификатор платежа
- `UserId` (UUID, FK) — пользователь
- `Type` (enum: Subscription, Assessment, DocumentCopy) — тип
- `SubscriptionId` (UUID, FK, nullable) — привязка к подписке
- `AssessmentId` (UUID, FK, nullable) — привязка к заявке
- `Amount` (numeric) — сумма платежа
- `PaymentDate` (timestamp) — дата платежа
- `Status` (enum: Pending, Completed, Failed, Refunded) — статус
- `PaymentMethod` (varchar) — метод оплаты
- `TransactionId` (varchar) — внешний ID транзакции
- `AttachmentFileName` (varchar) — название чека
- `AttachmentFileUrl` (varchar) — ссылка на чек

## 6. Отчёт об оценке (AssessmentReport)

- `Id` (UUID, PK) — идентификатор отчёта
- `AssessmentId` (UUID, FK) — заявка
- `ReportPath` (varchar) — путь к PDF с отчётом
- `GeneratedAt` (timestamp) — дата создания отчёта
- `SignedBy` (UUID, FK) — нотариус, подписавший отчёт
- `SignatureData` (bytea) — цифровая подпись
- `Version` (integer) — версия отчёта

## 7. Уведомление (Notification)

- `Id` (UUID, PK) — идентификатор уведомления
- `UserId` (UUID, FK) — получатель
- `Type` (enum: Email, SMS, Push) — тип уведомления
- `Message` (text) — текст уведомления
- `SentAt` (timestamp) — время отправки
- `Status` (enum: Pending, Sent, Failed) — статус доставки

## 8. Лог действий (AuditLog)

- `Id` (UUID, PK) — идентификатор лога
- `UserId` (UUID, FK) — пользователь, инициировавший действие
- `ActionType` (varchar) — тип действия (create, update, delete и др.)
- `EntityName` (varchar) — имя сущности (Assessment, Document и др.)
- `EntityId` (UUID) — ID объекта действия
- `Timestamp` (timestamp) — время действия
- `Details` (jsonb) — дополнительные данные

## 9. Промокод (Promo)

- `Id` (UUID, PK) — идентификатор промокода
- `Code` (varchar) - код
- `Description` (text) - описание промокода

## 9. Скидка (Sale)

- `Id` (UUID, PK) — идентификатор скидки
- `SourceId` (UUID, FK) - ID промокода или товара, если есть
- `StartDate` (date) — дата начала
- `EndDate` (date) — дата окончания
- `Percent` (numeric) - процент скидки
- `Type` (enum: Permanent, Subscription, Product, Promo) - тип скидки

---

# Краткие пояснения

- Все первичные ключи — UUID для уникальности и масштабируемости.
- Внешние ключи обеспечивают целостность связей между данными.
- Статусы и планы вынесены в enum для контроля допустимых значений.
- Метки времени (`CreatedAt`, `UpdatedAt`) используются для аудита и версионирования.
- Поле `SignatureData` в отчётах хранит бинарные данные ЭЦП.
- `AuditLogs` обеспечивают прозрачность и контроль безопасности.
