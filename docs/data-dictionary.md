# Сущности и поля базы данных

## 1. Пользователь (User)

| Postgres      | Proto         | Prisma       | Type       | Description                               |
| :------------ | :------------ | :----------- | :--------- | :---------------------------------------- |
| **users**     | **User**      | **User**     | **Entity** | **Пользователи**                          |
| id            | id            | id           | UUID       | PK, Уникальный идентификатор пользователя |
| email         | email         | email        | varchar    | Unique, Электронная почта                 |
| password_hash | password_hash | passwordHash | varchar    | Хэш пароля                                |
| full_name     | full_name     | fullName     | varchar    | Полное имя                                |
| role          | role          | role         | enum       | Роль (Applicant, Notary, Admin)           |
| phone_number  | phone_number  | phoneNumber  | varchar    | Телефон                                   |
| is_active     | is_active     | isActive     | boolean    | Активность аккаунта                       |
| created_at    | created_at    | createdAt    | timestamp  | Дата регистрации                          |
| updated_at    | updated_at    | updatedAt    | timestamp  | Дата последнего обновления                |

## 2. Заявка на оценку (Assessment)

| Postgres        | Proto           | Prisma         | Type       | Description                                              |
| :-------------- | :-------------- | :------------- | :--------- | :------------------------------------------------------- |
| **assessments** | **Assessment**  | **Assessment** | **Entity** | **Заявки на оценку**                                     |
| id              | id              | id             | UUID       | PK, Уникальный идентификатор заявки                      |
| user_id         | user_id         | userId         | UUID       | FK, Наследник, подавший заявку                           |
| status          | status          | status         | enum       | Статус (New, Verified, InProgress, Completed, Cancelled) |
| created_at      | created_at      | createdAt      | timestamp  | Дата создания                                            |
| updated_at      | updated_at      | updatedAt      | timestamp  | Дата последнего обновления                               |
| address         | address         | address        | varchar    | Адрес объекта недвижимости                               |
| description     | description     | description    | text       | Описание объекта наследства                              |
| estimated_value | estimated_value | estimatedValue | numeric    | Оценочная стоимость                                      |

## 3. Документ (Document)

| Postgres      | Proto         | Prisma       | Type       | Description                              |
| :------------ | :------------ | :----------- | :--------- | :--------------------------------------- |
| **documents** | **Document**  | **Document** | **Entity** | **Документы**                            |
| id            | id            | id           | UUID       | PK, Уникальный идентификатор документа   |
| assessment_id | assessment_id | assessmentId | UUID       | FK, Заявка, к которой относится документ |
| file_name     | file_name     | fileName     | varchar    | Имя файла                                |
| file_type     | file_type     | fileType     | varchar    | Тип файла (pdf, jpg, docx и др.)         |
| file_path     | file_path     | filePath     | varchar    | Путь к файлу в хранилище                 |
| version       | version       | version      | integer    | Версия документа                         |
| uploaded_at   | uploaded_at   | uploadedAt   | timestamp  | Дата загрузки                            |
| uploaded_by   | uploaded_by   | uploadedBy   | UUID       | FK, Пользователь, загрузивший документ   |

## 4. Подписка (Subscription)

| Postgres          | Proto            | Prisma           | Type       | Description                        |
| :---------------- | :--------------- | :--------------- | :--------- | :--------------------------------- |
| **subscriptions** | **Subscription** | **Subscription** | **Entity** | **Подписки**                       |
| id                | id               | id               | UUID       | PK, Идентификатор подписки         |
| user_id           | user_id          | userId           | UUID       | FK, Нотариус                       |
| plan              | plan             | plan             | enum       | Тариф (Basic, Premium, Enterprise) |
| start_date        | start_date       | startDate        | date       | Дата начала                        |
| end_date          | end_date         | endDate          | date       | Дата окончания                     |
| is_active         | is_active        | isActive         | boolean    | Активность подписки                |

## 5. Платеж (Payment)

| Postgres             | Proto                | Prisma             | Type       | Description                                   |
| :------------------- | :------------------- | :----------------- | :--------- | :-------------------------------------------- |
| **payments**         | **Payment**          | **Payment**        | **Entity** | **Платежи**                                   |
| id                   | id                   | id                 | UUID       | PK, Идентификатор платежа                     |
| user_id              | user_id              | userId             | UUID       | FK, Пользователь                              |
| type                 | type                 | type               | enum       | Тип (Subscription, Assessment, DocumentCopy)  |
| subscription_id      | subscription_id      | subscriptionId     | UUID       | FK, Nullable, Привязка к подписке             |
| assessment_id        | assessment_id        | assessmentId       | UUID       | FK, Nullable, Привязка к заявке               |
| amount               | amount               | amount             | numeric    | Сумма платежа                                 |
| payment_date         | payment_date         | paymentDate        | timestamp  | Дата платежа                                  |
| status               | status               | status             | enum       | Статус (Pending, Completed, Failed, Refunded) |
| payment_method       | payment_method       | paymentMethod      | varchar    | Метод оплаты                                  |
| transaction_id       | transaction_id       | transactionId      | varchar    | Внешний ID транзакции                         |
| attachment_file_name | attachment_file_name | attachmentFileName | varchar    | Название чека                                 |
| attachment_file_url  | attachment_file_url  | attachmentFileUrl  | varchar    | Ссылка на чек                                 |

## 6. Отчёт об оценке (AssessmentReport)

| Postgres               | Proto                | Prisma               | Type       | Description                        |
| :--------------------- | :------------------- | :------------------- | :--------- | :--------------------------------- |
| **assessment_reports** | **AssessmentReport** | **AssessmentReport** | **Entity** | **Отчёты об оценке**               |
| id                     | id                   | id                   | UUID       | PK, Идентификатор отчёта           |
| assessment_id          | assessment_id        | assessmentId         | UUID       | FK, Заявка                         |
| report_path            | report_path          | reportPath           | varchar    | Путь к PDF с отчётом               |
| generated_at           | generated_at         | generatedAt          | timestamp  | Дата создания отчёта               |
| signed_by              | signed_by            | signedBy             | UUID       | FK, Нотариус, подписавший отчёт    |
| signature_data         | signature_data       | signatureData        | bytea      | Цифровая подпись (бинарные данные) |
| version                | version              | version              | integer    | Версия отчёта                      |

## 7. Уведомление (Notification)

| Postgres          | Proto            | Prisma           | Type       | Description                             |
| :---------------- | :--------------- | :--------------- | :--------- | :-------------------------------------- |
| **notifications** | **Notification** | **Notification** | **Entity** | **Уведомления**                         |
| id                | id               | id               | UUID       | PK, Идентификатор уведомления           |
| user_id           | user_id          | userId           | UUID       | FK, Получатель                          |
| type              | type             | type             | enum       | Тип (Email, SMS, Push)                  |
| message           | message          | message          | text       | Текст уведомления                       |
| sent_at           | sent_at          | sentAt           | timestamp  | Время отправки                          |
| status            | status           | status           | enum       | Статус доставки (Pending, Sent, Failed) |

## 8. Лог действий (AuditLog)

| Postgres       | Proto        | Prisma       | Type       | Description                                 |
| :------------- | :----------- | :----------- | :--------- | :------------------------------------------ |
| **audit_logs** | **AuditLog** | **AuditLog** | **Entity** | **Логи действий (Аудит)**                   |
| id             | id           | id           | UUID       | PK, Идентификатор лога                      |
| user_id        | user_id      | userId       | UUID       | FK, Пользователь, инициировавший действие   |
| action_type    | action_type  | actionType   | varchar    | Тип действия (create, update, delete и др.) |
| entity_name    | entity_name  | entityName   | varchar    | Имя сущности (Assessment, Document и др.)   |
| entity_id      | entity_id    | entityId     | UUID       | ID объекта действия                         |
| timestamp      | timestamp    | timestamp    | timestamp  | Время действия                              |
| details        | details      | details      | jsonb      | Дополнительные данные                       |

## 9. Промокод (Promo)

| Postgres    | Proto       | Prisma      | Type       | Description                 |
| :---------- | :---------- | :---------- | :--------- | :-------------------------- |
| **promos**  | **Promo**   | **Promo**   | **Entity** | **Промокоды**               |
| id          | id          | id          | UUID       | PK, Идентификатор промокода |
| code        | code        | code        | varchar    | Код                         |
| description | description | description | text       | Описание промокода          |

## 10. Скидка (Sale)

| Postgres   | Proto      | Prisma    | Type       | Description                                   |
| :--------- | :--------- | :-------- | :--------- | :-------------------------------------------- |
| **sales**  | **Sale**   | **Sale**  | **Entity** | **Скидки**                                    |
| id         | id         | id        | UUID       | PK, Идентификатор скидки                      |
| source_id  | source_id  | sourceId  | UUID       | FK, ID промокода или товара (если есть)       |
| start_date | start_date | startDate | date       | Дата начала                                   |
| end_date   | end_date   | endDate   | date       | Дата окончания                                |
| percent    | percent    | percent   | numeric    | Процент скидки                                |
| type       | type       | type      | enum       | Тип (Permanent, Subscription, Product, Promo) |

---

## Примечание для Enum:

| Enum      | Postgres            | Proto                           | Prisma             |
| :-------- | :------------------ | :------------------------------ | :----------------- |
| **Name**  | `assessment_status` | `AssessmentStatus`              | `AssessmentStatus` |
| **Value** | `in_progress`       | `ASSESSMENT_STATUS_IN_PROGRESS` | `InProgress`       |
