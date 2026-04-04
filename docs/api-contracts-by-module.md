# Распределение контрактов API по модулям

Справочник привязки API-сервисов и их методов к разделам продукта. Разделы взяты из [Responsobility.md](Responsobility.md) (таблица «Раздел / страница», «Ключевые функции»). Контракты определены в `libs/shared/api-contracts` (proto-файлы, код генерируется в Connect RPC-совместимые типы и сервисы).

**Как вызывать эти методы с фронтенда (TypeScript):** см. [frontend-api-contracts-guide.md](frontend-api-contracts-guide.md) (лабораторная по созданию RPC-клиента, типизации, маппингу и обработке ошибок).

---

## Регистрация / Вход / Восстановление пароля

| API-сервис      | RPC-методы                            |
| --------------- | ------------------------------------- |
| **AuthService** | Register, Login, RefreshToken, Logout |

Создание аккаунта, авторизация, сброс пароля по email/телефону; регистрация через внешние приложения (VK, Google, Apple, Yandex).

---

## Личный кабинет заявителя

| API-сервис            | RPC-методы                                                         |
| --------------------- | ------------------------------------------------------------------ |
| **AssessmentService** | CreateAssessment, GetAssessment, UpdateAssessment, ListAssessments |
| **DocumentService**   | CreateDocument, GetDocument, ListDocuments, DeleteDocument         |
| **FormsService**      | SaveAssessmentForm, SaveDocumentForm                               |

Подача заявки, просмотр статуса, список заявок, загрузка/замена документов, комментарии/заметки.

---

## Личный кабинет нотариуса

| API-сервис            | RPC-методы                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| **AssessmentService** | ListAssessments, GetAssessment, VerifyAssessment, CompleteAssessment, CancelAssessment |
| **PaymentService**    | GetPaymentHistory, GetSubscription, CreateSubscription                                 |
| **DocumentService**   | CreateDocument, GetDocument, ListDocuments, DeleteDocument                             |
| **UserService**       | GetProfile, UpdateProfile                                                              |

Просмотр заказов, фильтры/поиск, «взять в работу», управление статусами, оплата подписки, документы по заказу.

---

## Личный кабинет администратора

Общее, просмотр заказов, «взять в работу», управление статусами, оплата подписки, документы по заказу.

| API-сервис            | RPC-методы                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| **AssessmentService** | ListAssessments, GetAssessment, VerifyAssessment, CompleteAssessment, CancelAssessment |
| **PaymentService**    | GetPaymentHistory, GetSubscription, CreateSubscription                                 |
| **DocumentService**   | CreateDocument, GetDocument, ListDocuments, DeleteDocument                             |
| **UserService**       | GetProfile, UpdateProfile                                                              |

---

## Личный кабинет администратора / управление тарифными планами

| API-сервис       | RPC-методы                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------ |
| **PromoService** | ListPromos, CreatePromo, GetPromo, GetPromoByCode, UpdatePromo, DeletePromo, ValidatePromo |

Просмотр списка тарифных планов, скидок, промокодов. _PromoService в proto есть, в пакет пока не экспортирован._

---

## Личный кабинет администратора / управление рассылкой

| API-сервис              | RPC-методы                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| **NotificationService** | ListNotifications, MarkAsRead, MarkAllAsRead, DeleteNotification |

Просмотр списка рассылки, формирование рассылки email. _NotificationService в proto есть, в пакет пока не экспортирован._

---

## Личный кабинет администратора / пользователи и заказы

| API-сервис            | RPC-методы                                                                                               |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| **UserService**       | ListUsers, GetUserById, DeactivateUser, ActivateUser, ChangeUserRole                                     |
| **AssessmentService** | ListAssessments, GetAssessment, UpdateAssessment, VerifyAssessment, CompleteAssessment, CancelAssessment |
| **DocumentService**   | ListDocuments, GetDocument, CreateDocument, DeleteDocument                                               |

CRUD пользователей, роли/права, блокировки, управление заказами/статусами, ручные корректировки, модерация файлов.

---

## Личный кабинет администратора / География объектов оценки

| API-сервис            | RPC-методы                     |
| --------------------- | ------------------------------ |
| **AssessmentService** | ListAssessments, GetAssessment |

Карта объектов (Leaflet), маркеры по заявкам/адресам, фильтры по статусу и периоду, переход к карточке заявки.

---

## Личный кабинет администратора / Платежи

| API-сервис         | RPC-методы                                                            |
| ------------------ | --------------------------------------------------------------------- |
| **PaymentService** | GetPaymentHistory, GetSubscription, CreateSubscription, CreatePayment |

Просмотр списка платежей/транзакций, формы создания/редактирования/просмотра/удаления платежа.

---

## Форма подачи заявки на оценку наследственного имущества

| API-сервис            | RPC-методы                           |
| --------------------- | ------------------------------------ |
| **AssessmentService** | CreateAssessment                     |
| **DocumentService**   | CreateDocument, ListDocuments        |
| **FormsService**      | SaveAssessmentForm, SaveDocumentForm |

Ввод данных наследства/объекта, выбор типа имущества, прикрепление документов, согласия/чекбоксы, отправка.

---

## Загрузка и управление файлами (PDF/изображения) с предпросмотром

| API-сервис          | RPC-методы                                                 |
| ------------------- | ---------------------------------------------------------- |
| **DocumentService** | CreateDocument, GetDocument, ListDocuments, DeleteDocument |

Drag&Drop, валидация форматов/размера, предпросмотр, переименование, удаление, версии, теги, статусы «принято/на проверке».

---

## Просмотр результатов оценки

| API-сервис            | RPC-методы                                                     |
| --------------------- | -------------------------------------------------------------- |
| **ReportService**     | CreateReport, GetReport, ListReports, SignReport, DeleteReport |
| **AssessmentService** | GetAssessment, ListAssessments                                 |

Карточка результата, отчёты/файлы, детализация расчёта, скачивание копий (PDF). _ReportService в proto есть, в пакет пока не экспортирован._

---

## Платежи

| API-сервис         | RPC-методы                                                            |
| ------------------ | --------------------------------------------------------------------- |
| **PaymentService** | CreatePayment, GetPaymentHistory, GetSubscription, CreateSubscription |
| **PromoService**   | GetPromoByCode, ValidatePromo                                         |

Выбор тарифа, ввод реквизитов, промокод (опц.), подтверждение оплаты, чеки/счета, история платежей.

---

## Уведомления + история

| API-сервис              | RPC-методы                                                       |
| ----------------------- | ---------------------------------------------------------------- |
| **NotificationService** | ListNotifications, MarkAsRead, MarkAllAsRead, DeleteNotification |

In-app уведомления, фильтры, прочитано/не прочитано, история событий, настройки каналов (email/push). _NotificationService в proto есть, в пакет пока не экспортирован._

---

## Запрос, оплата и получение копий нотариальных документов

| API-сервис          | RPC-методы                                             |
| ------------------- | ------------------------------------------------------ |
| **SaleService**     | CreateSale, GetSale, ListSales, UpdateSale, DeleteSale |
| **PaymentService**  | CreatePayment, GetPaymentHistory                       |
| **DocumentService** | CreateDocument, GetDocument, ListDocuments             |

Форма запроса, прикрепление оснований, расчёт стоимости, оплата, выдача копий/ссылок, статус «в обработке/готово». _SaleService в proto есть, в пакет пока не экспортирован._

---

## Чат поддержки

Контракты в текущем репозитории не определены — **TBD** (отдельный сервис или расширение api-contracts).

Чат/тикеты, вложения, SLA-статусы, база знаний/FAQ, поиск по статьям.

---

## Справочный раздел

Контракты в api-contracts не определены — **TBD**.

База знаний/FAQ, поиск по статьям (фильтры по автору и логике поиска).

---

## История действий и логирование (через интерфейс)

| API-сервис          | RPC-методы                 |
| ------------------- | -------------------------- |
| **AuditLogService** | ListAuditLogs, GetAuditLog |

Аудит действий (кто/что/когда), фильтры, экспорт, просмотр логов по пользователю/заказу, события безопасности. _AuditLogService в proto есть, в пакет пока не экспортирован._

---

## UI: модуль оценки недвижимости (все подразделы)

Объединение подразделов: загрузка фото и документов, запрос оценки с параметрами, ввод параметров объекта, результаты и отчёты, история заказов и статусов.

| API-сервис            | RPC-методы                                                                                                                 |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **AssessmentService** | CreateAssessment, GetAssessment, UpdateAssessment, ListAssessments, VerifyAssessment, CompleteAssessment, CancelAssessment |
| **DocumentService**   | CreateDocument, GetDocument, ListDocuments, DeleteDocument                                                                 |
| **FormsService**      | SaveAssessmentForm, SaveDocumentForm                                                                                       |
| **ReportService**     | CreateReport, GetReport, ListReports, SignReport, DeleteReport                                                             |

---

## UI: админ-панель модуля — управление заказами и аналитика

| API-сервис            | RPC-методы                                                                             |
| --------------------- | -------------------------------------------------------------------------------------- |
| **AssessmentService** | ListAssessments, GetAssessment, VerifyAssessment, CompleteAssessment, CancelAssessment |
| **ReportService**     | ListReports, GetReport                                                                 |

Очередь оценок, ручная модерация, метрики (конверсия/время), отчёты, выгрузки.

---

## Landing page

Специфичных контрактов API для гостевой продажной страницы нет.

---

## Сводка: сервисы, proto и экспорт в пакете

| Сервис              | Proto-файл                               | Экспорт в `@notary-portal/api-contracts` |
| ------------------- | ---------------------------------------- | ---------------------------------------- |
| AssessmentService   | assessment/v1alpha1/assessment.proto     | Да                                       |
| AuthService         | auth/v1alpha1/auth.proto                 | Да                                       |
| DocumentService     | document/v1alpha1/document.proto         | Да                                       |
| FormsService        | forms/v1alpha1/forms.proto               | Да                                       |
| PaymentService      | payment/v1alpha1/payment.proto           | Да                                       |
| UserService         | user/v1alpha1/user.proto                 | Да                                       |
| ReportService       | report/v1alpha1/report.proto             | **Нет**                                  |
| NotificationService | notification/v1alpha1/notification.proto | **Нет**                                  |
| AuditLogService     | audit/v1alpha1/audit.proto               | **Нет**                                  |
| PromoService        | promo/v1alpha1/promo.proto               | **Нет**                                  |
| SaleService         | sale/v1alpha1/sale.proto                 | **Нет**                                  |

Пакет экспортирует только модули, перечисленные в [libs/shared/api-contracts/src/index.ts](../libs/shared/api-contracts/src/index.ts). Сервисы Report, Notification, Audit, Promo, Sale описаны в proto и при появлении соответствующих маршрутов на бэкенде их нужно добавить в `index.ts` и зарегистрировать в Connect-router приложения API ([apps/api/src/app/connect-router.registry.ts](../apps/api/src/app/connect-router.registry.ts)).
