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
- `RealEstateObjectId` (UUID, FK) — объект недвижимости, переданный на оценку
- `Status` (enum: New, Verified, InProgress, Completed, Cancelled) — статус заявки
- `CreatedAt` (timestamp) — дата создания
- `UpdatedAt` (timestamp) — дата последнего обновления
- `Address` (varchar) — адрес объекта недвижимости
- `Latitude` (numeric, nullable) — широта (для отображения на карте)
- `Longitude` (numeric, nullable) — долгота (для отображения на карте)
- `Description` (text) — описание объекта наследства
- `EstimatedValue` (numeric) — оценочная стоимость, если уже рассчитана

## 3. Объект недвижимости (RealEstateObject)

- `Id` (UUID, PK) — уникальный идентификатор объекта недвижимости
- `City` (varchar) — город расположения объекта
- `District` (varchar, nullable) — район или административный округ
- `Address` (varchar) — полный адрес объекта
- `Area` (numeric) — площадь объекта в квадратных метрах
- `ObjectType` (enum: Apartment, House, Room, Apartments, LandPlot, CommercialProperty) — тип объекта
- `RoomsCount` (integer, nullable) — количество комнат
- `FloorsTotal` (integer) — этажность здания
- `Floor` (integer, nullable) — этаж объекта, может быть 0 для частного дома или участка
- `Condition` (enum: NewBuilding, Good, NeedsRepair, Emergency) — состояние объекта
- `YearBuilt` (integer, nullable) — год постройки
- `WallMaterial` (enum: Brick, Panel, Block, Monolithic, MonolithicBrick, Wooden, AeratedConcrete, nullable) — тип дома или основной материал здания
- `ElevatorType` (enum: None, Cargo, Passenger, PassengerAndCargo, nullable) — наличие и тип лифта
- `Description` (text, nullable) — дополнительное описание объекта
- `CreatedAt` (timestamp) — дата создания записи об объекте
- `UpdatedAt` (timestamp) — дата последнего обновления записи об объекте

## 4. Документ (Document)

- `Id` (UUID, PK) — уникальный идентификатор документа
- `AssessmentId` (UUID, FK) — заявка, к которой относится документ
- `Category` (enum: Scan, PropertyPhoto, AdditionalFile) — категория файла в форме объекта
- `FileName` (varchar) — имя файла
- `FileType` (varchar) — тип файла (pdf, jpg, docx и др.)
- `FilePath` (varchar) — путь к файлу в хранилище
- `Version` (integer) — версия документа
- `UploadedAt` (timestamp) — дата загрузки
- `UploadedBy` (UUID, FK) — пользователь, загрузивший документ

## 5. Подписка (Subscription)

- `Id` (UUID, PK) — идентификатор подписки
- `UserId` (UUID, FK) — нотариус
- `Plan` (enum: Basic, Premium, Enterprise) — тариф
- `StartDate` (date) — дата начала
- `EndDate` (date) — дата окончания
- `IsActive` (boolean) — активность подписки

## 6. План (TariffPlan)

- `Id` (UUID, PK) — уникальный идентификатор тарифного плана
- `Name` (varchar) — название тарифного плана
- `Price` (numeric) — стоимость в рублях
- `Description` (text) — описание
- `IsActive` (boolean) — активен ли план
- `ValidFrom` (date) — дата начала действия
- `ValidTo` (date) — дата окончания действия
- `CreatedAt` (timestamp) — дата создания записи
- `UpdatedAt` (timestamp) — дата последнего обновления

## 7. Платёж (Payment)

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

## 8. Отчёт об оценке (AssessmentReport)

- `Id` (UUID, PK) — идентификатор отчёта
- `AssessmentId` (UUID, FK) — заявка
- `ReportPath` (varchar) — путь к PDF с отчётом
- `GeneratedAt` (timestamp) — дата создания отчёта
- `SignedBy` (UUID, FK) — нотариус, подписавший отчёт
- `SignatureData` (bytea) — цифровая подпись
- `Version` (integer) — версия отчёта

# <<<<<<< HEAD

## 8. Результат оценки недвижимости (RealEstateAppraisalResult)

- `Id` (UUID, PK) — уникальный идентификатор результата оценки
- `AssessmentId` (UUID, FK) — заявка на оценку
- `MarketValue` (numeric) — итоговая рыночная стоимость, руб.
- `ValueMin` (numeric, nullable) — нижняя граница диапазона (если есть)
- `ValueMax` (numeric, nullable) — верхняя граница диапазона (если есть)
- `ConfidenceLevel` (varchar, nullable) — уровень уверенности (например, «высокий», «средний») или процент
- `ValuationMethod` (varchar) — применённый метод/подход (сравнительный, затратный и т.д.)
- `ValuationDate` (date) — дата определения стоимости
- `CalculationDetails` (text или jsonb) — детализация расчёта (текст или структурированные данные)
- `Comparables` (jsonb, nullable) — данные по объектам-аналогам (адрес, цена, поправки)
- `RestrictionsAndAssumptions` (text, nullable) — ограничения и допущения
- `Comment` (text, nullable) — комментарий нотариуса/оценщика
- `CreatedAt` (timestamp) — дата создания записи
- `CreatedBy` (UUID, FK) — нотариус/пользователь, выполнивший оценку
- `AssessmentReportId` (UUID, FK, nullable) — ссылка на сгенерированный отчёт (AssessmentReport), если уже сформирован

> > > > > > > main

## 9. Уведомление (Notification)

- `Id` (UUID, PK) — идентификатор уведомления
- `UserId` (UUID, FK) — получатель
- `Type` (enum: Email, SMS, Push) — тип уведомления
- `Message` (text) — текст уведомления
- `SentAt` (timestamp) — время отправки
- `Status` (enum: Pending, Sent, Failed) — статус доставки

## 10. Лог действий (AuditLog)

- `Id` (UUID, PK) — идентификатор лога
- `UserId` (UUID, FK) — пользователь, инициировавший действие
- `ActionType` (varchar) — тип действия (create, update, delete и др.)
- `EntityName` (varchar) — имя сущности (Assessment, Document и др.)
- `EntityId` (UUID) — ID объекта действия
- `Timestamp` (timestamp) — время действия
- `Details` (jsonb) — дополнительные данные

## 11. Промокод (Promo)

- `Id` (UUID, PK) — идентификатор промокода
- `Code` (varchar) — код
- `Description` (text) — описание промокода
- `ValidFrom` (date) — дата начала действия
- `ValidTo` (date) — дата окончания действия
- `DiscountType` (enum: percentage, fixed) — тип скидки (процент или фиксированная)
- `DiscountValue` (numeric) — значение скидки
- `MaxUses` (integer) — максимальное количество использований
- `UsedCount` (integer) — количество уже использованных
- `IsActive` (boolean) — активен ли промокод

## 12. Скидка (Sale)

- `Id` (UUID, PK) — идентификатор скидки
- `Name` (varchar) — название скидки
- `Percentage` (numeric) — процент скидки
- `Description` (text) — описание
- `ValidFrom` (date) — дата начала действия
- `ValidTo` (date) — дата окончания действия
- `IsActive` (boolean) — активна ли скидка
- `MinOrderAmount` (numeric, nullable) — минимальная сумма заказа
- `MaxDiscountAmount` (numeric, nullable) — максимальная сумма скидки
- `Type` (enum: Permanent, Subscription, Product, Promo) — тип скидки

---

# Краткие пояснения

- Все первичные ключи — UUID для уникальности и масштабируемости.
- Внешние ключи обеспечивают целостность связей между данными.
- Статусы и планы вынесены в enum для контроля допустимых значений.
- Метки времени (`CreatedAt`, `UpdatedAt`) используются для аудита и версионирования.
- Поле `SignatureData` в отчётах хранит бинарные данные ЭЦП.
- Связь по данным оценки: **Assessment** (заявка) → **RealEstateAppraisalResult** (результат расчёта: стоимость, метод, аналоги) → **AssessmentReport** (сгенерированный PDF, подпись). У одной заявки может быть один или несколько результатов оценки; по результату формируется отчёт. Связь результата с отчётом задаётся полем `AssessmentReportId` в `RealEstateAppraisalResult`.
- Поля `Latitude` и `Longitude` в Assessment используются для отображения объекта на карте в разделе «География объектов» админ-панели; при отсутствии значений координаты могут получаться путём геокодирования по полю `Address`.
- `AuditLogs` обеспечивают прозрачность и контроль безопасности.
- `RealEstateObject` хранит характеристики объекта недвижимости, а связанные сканы, фото и дополнительные файлы описываются через `Document` с разделением по категориям.
