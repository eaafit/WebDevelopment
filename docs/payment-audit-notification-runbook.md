# Runbook по платежам, аудиту и уведомлениям

Документ описывает проверку платежного flow, Robokassa, audit events,
уведомлений, CSV-экспорта и административных страниц.

Runbook можно использовать после изменения платежной логики, при локальной диагностике и перед регрессионной проверкой.
Он описывает ожидаемые состояния, ошибки, события аудита и пользовательские сообщения без привязки к внешним сценариям показа.

## Цели

- Зафиксировать ожидаемое поведение платежей.
- Зафиксировать события, которые должны попадать в аудит.
- Зафиксировать уведомления для администратора и пользователя.
- Отделить критичную оплату от best-effort уведомлений.
- Проверить, что Robokassa success и failure не теряются.
- Проверить, что CSV-экспорт не сообщает ложный успех.
- Проверить устойчивость страниц администратора.
- Проверить fallback для списка заявок.
- Проверить notary scoped visibility.

## Зоны проверки

| Зона | Страница или сервис | Основной риск |
| --- | --- | --- |
| Платежи администратора | `/admin/payments` | таблица не загружается или ломается от длинных ID |
| Заявки администратора | `/admin/orders` | backend возвращает `internal error` |
| Мониторинг | `/admin/monitoring` | audit events не находятся фильтрами |
| Уведомления | notification center | fanout ломает платежный flow |
| Robokassa redirect | checkout/applicant flow | ссылка не создана, но ошибка не видна |
| Robokassa callback | API callback | статус меняется неверно |
| CSV export | admin payments and monitoring | файл не скачивается, но лог пишет success |
| Notary scope | audit list | нотариус видит чужие события |

## Роли

| Роль | Действия | Что проверяется |
| --- | --- | --- |
| Заявитель | запускает оплату | redirect, failure state, отсутствие вечной загрузки |
| Администратор | смотрит платежи и мониторинг | фильтры, таблица, CSV, audit events |
| Нотариус | работает со своими заявками | scope по `notaryId` и assessment visibility |
| Система | пишет аудит и уведомления | идемпотентность, best-effort, безопасный контекст |

## Базовые гарантии

| Гарантия | Причина | Проверка |
| --- | --- | --- |
| Оплата не зависит от уведомлений | уведомления вторичны | ошибка notification не откатывает платеж |
| Ошибка Robokassa пишется в аудит | нужна диагностика | есть `payment.robokassa.*.failed` |
| Успех Robokassa пишется в аудит | нужна трассировка оплаты | есть success/callback/payment event |
| CSV показывает ошибку | оператору нужен feedback | `exportError` виден в UI |
| Таблица платежей держит длинные ID | UUID и transactionId длинные | ячейки не раздвигают layout |
| Заявки не падают из-за relation | локальная БД может быть несовместима | summary fallback возвращает список |
| Нотариус видит только свое | ограничение доступа | чужие payment-only events скрыты |

## Статусы платежей

| Статус | Значение | Нормальная ситуация | Риск |
| --- | --- | --- | --- |
| `pending` | платеж ожидает оплаты | redirect создан | callback может не прийти |
| `completed` | платеж подтвержден | Robokassa callback успешен | повторный callback не должен дублировать эффект |
| `failed` | платеж отклонен | ошибка провайдера или проверки | причина должна быть в аудите |
| `refunded` | платеж возвращен | возврат выполнен | нельзя считать услугу оплаченной |

## Статусы заявок

| Статус | Значение | Проверка |
| --- | --- | --- |
| `new` | заявка создана | администратор видит ее в списке |
| `verified` | заявка проверена | изменение есть в аудите |
| `in_progress` | заявка в работе | нотариус назначен или начал работу |
| `completed` | заявка завершена | создан audit event и уведомление |
| `cancelled` | заявка отменена | причина отмены есть в контексте |

## Audit events

| Event type | Actor | Target | Контекст |
| --- | --- | --- | --- |
| `payment.created` | admin/system | Payment | сумма, тип, пользователь |
| `payment.updated` | admin/system | Payment | старый и новый статус |
| `payment.deleted` | admin | Payment | id платежа и actor |
| `payment.robokassa.redirect.created` | applicant | Payment | invId, outSum, url created |
| `payment.robokassa.redirect.failed` | applicant/system | Payment | безопасная причина ошибки |
| `payment.robokassa.callback.received` | system | Payment | invId, outSum, signature check |
| `payment.robokassa.callback.completed` | system | Payment | переход статуса |
| `payment.robokassa.callback.failed` | system | Payment or invId | причина отказа |
| `payment.csv.exported` | admin | PaymentExport | строки, страница, фильтры |
| `payment.csv.export_failed` | admin | PaymentExport | ошибка скачивания |
| `notification.created` | system | Notification | category, type, recipient |
| `notification.failed` | system | Notification | recipient role, reason |
| `notification.read` | user | Notification | readAt |
| `notification.deleted` | user | Notification | delete result |
| `assessment.created` | applicant | Assessment | address, userId |
| `assessment.updated` | applicant/admin | Assessment | before/after |
| `assessment.assigned_to_notary` | admin/notary | Assessment | notaryId |
| `assessment.status_in_progress` | notary | Assessment | status transition |
| `assessment.completed` | notary | Assessment | estimatedValue |
| `assessment.cancelled` | admin/notary | Assessment | cancelReason |
| `audit.exported` | admin | AuditExport | filters, limit, cap |
| `audit.export_failed` | admin | AuditExport | error message |

## Уведомления

| Сценарий | Получатель | Category | Type | Ошибка |
| --- | --- | --- | --- | --- |
| Платеж создан | admin | Payment | IN_APP | логируется warning |
| Платеж завершен | admin | Payment | IN_APP | платеж не откатывается |
| Платеж отклонен | admin | Payment | IN_APP | audit failure сохраняется |
| Redirect Robokassa создан | admin | Payment | IN_APP | redirect не блокируется |
| Redirect Robokassa не создан | admin | Payment | IN_APP | UI показывает ошибку |
| Callback Robokassa принят | admin | Payment | IN_APP | повтор не дублирует эффект |
| Callback Robokassa отклонен | admin | Payment | IN_APP | статус не меняется неверно |
| Заявка создана | admin | Assessment | IN_APP | createAssessment не ломается |
| Заявка назначена | admin | Assessment | IN_APP | verifyAssessment не ломается |
| Заявка завершена | admin | Assessment | IN_APP | completeAssessment не ломается |
| Заявка отменена | admin | Assessment | IN_APP | cancelAssessment не ломается |
| CSV не скачан | admin | System | IN_APP | страница остается интерактивной |

## Robokassa: redirect

| Проверка | Ожидание |
| --- | --- |
| Пользователь нажимает оплату | начинается подготовка платежа |
| Backend создает платеж | статус `pending` |
| Backend формирует URL | URL содержит параметры Robokassa |
| Audit пишет success | есть `payment.robokassa.redirect.created` |
| Уведомление создается | best-effort, без влияния на redirect |
| UI выполняет переход | пользователь уходит на Robokassa |
| Провайдер недоступен | UI показывает понятную ошибку |
| Конфигурация неверная | audit пишет redirect failure |
| Повторный запуск | не ломает существующий платеж |
| Ошибка notification | не блокирует redirect |

## Robokassa: callback

| Проверка | Ожидание |
| --- | --- |
| Валидная подпись | callback принимается |
| Валидная сумма | платеж переводится в `completed` |
| Неверная подпись | пишется callback failure |
| Неверная сумма | статус не становится `completed` |
| Неизвестный paymentId | ошибка есть в аудите |
| Повторный callback | бизнес-эффект не дублируется |
| Callback после failed | переход проверяется явно |
| Callback после completed | сохраняется идемпотентность |
| Notification failure | callback не откатывается |
| Audit failure | ошибка логируется отдельно |

## Admin payments: загрузка

| Шаг | Ожидание |
| --- | --- |
| Открыть `/admin/payments` | запрос уходит сразу |
| Не выбирать фильтры | список все равно загружается |
| API отвечает успешно | loading исчезает |
| API отвечает ошибкой | появляется текст ошибки |
| Пользователи не загружены | платежи остаются видимыми |
| Страница обновлена | состояние пересобирается |
| Пагинация изменилась | новый запрос содержит page |
| Page size задан | запрос содержит limit |
| Empty result | показывается пустое состояние |
| Long id | таблица не ломается |

## Admin payments: таблица

| Элемент | Проверка |
| --- | --- |
| ID | компактная ширина по умолчанию |
| Дата | остается читаемой |
| Плательщик | не перекрывает соседние ячейки |
| Тип | фильтруется по server query |
| Сумма | не переносится хаотично |
| Комиссия | помещается в компактную колонку |
| Метод | отображает label |
| Transaction ID | обрезается внутри ячейки |
| Чек | кнопки не расширяют строку |
| Заявка | ссылка передает assessmentId |
| Статус | badge не ломает layout |
| Действия | кнопки остаются доступны |

## Admin payments: изменение ширины столбцов

| Действие | Ожидание |
| --- | --- |
| Потянуть границу ID | меняется ширина ID |
| Потянуть payer | меняется ширина payer |
| Потянуть status | badge остается внутри |
| Потянуть actions | кнопки остаются в строке |
| Сжать ID до минимума | применяется minimum width |
| Расширить ID слишком сильно | применяется maximum width |
| Открыть фильтр после resize | меню работает |
| Resize во время loading | данные не перезагружаются |
| Клик по resize handle | фильтр не открывается |
| Наведение на handle | видна подсказка изменения ширины |

## Admin payments: фильтры

| Фильтр | Ожидание |
| --- | --- |
| Search | ищет по платежу и transactionId |
| Status | уходит в server query |
| Type | уходит в server query |
| Amount | применяется локально |
| Fee | применяется локально |
| Method | применяется локально |
| Attachment | применяется локально |
| Application | применяется локально |
| Sort ASC | сортирует текущую выборку |
| Sort DESC | сортирует текущую выборку |
| Clear filter | возвращает первую страницу |
| Click outside | закрывает меню |

## CSV export

| Сценарий | Ожидание |
| --- | --- |
| Непустая выборка | создается CSV |
| Пустая выборка | показывается `exportError` |
| Ошибка `createObjectURL` | показывается ошибка скачивания |
| Повторный экспорт | старое состояние очищается |
| Кириллица | значения экранируются |
| Кавычки в поле | кавычки удваиваются |
| Дата | форматируется в читаемый вид |
| Сумма | форматируется через `ru-RU` |
| Разделитель | используется `;` |
| Object URL | освобождается после dispatch |
| Лог старта | `payment.admin.export_csv_started` |
| Лог успеха | `payment.admin.export_csv_succeeded` |
| Лог ошибки | `payment.admin.export_csv_failed` |

## Admin orders

| Сценарий | Backend | Frontend |
| --- | --- | --- |
| Нормальная база | full include | список заявок виден |
| Битый `realEstateObject.city` | summary fallback | список заявок виден |
| Битый `district` | summary fallback | список заявок виден |
| User lookup упал | заявки загружаются | имя заменяется коротким ID |
| Assessment API упал | ошибка нормализуется | нет сырого `internal error` |
| Empty result | пустой список | кнопка повтора доступна |
| Reload | новый запрос | фильтры не ломаются |
| Query assessmentId | фильтр применяется | переход из платежа работает |

## Assessment repository fallback

| Шаг | Ожидание |
| --- | --- |
| Выполнить full query | используется include realEstateObject |
| Full query упал | ошибка логируется |
| Ошибка не `P2025` | запускается summary fallback |
| Summary query | выбирает базовые поля |
| Summary response | содержит id и userId |
| Summary response | содержит status |
| Summary response | содержит address |
| Summary response | содержит description |
| Summary response | содержит createdAt и updatedAt |
| Summary response | содержит realEstateObjectId |
| Summary response | не содержит вложенный broken object |
| Meta | сохраняет totalItems и perPage |

## Audit monitoring

| Проверка | Ожидание |
| --- | --- |
| Фильтр по eventType | находит только выбранный тип |
| Фильтр по targetType | отделяет Payment от Assessment |
| Фильтр по targetId | находит конкретный платеж |
| Фильтр по actorUserId | находит действия пользователя |
| Фильтр по дате | не выходит за диапазон |
| Export | учитывает cap |
| Export success | пишет `audit.exported` |
| Export failure | показывает ошибку |
| Admin role | видит payment events |
| Notary role | видит только свои assessment events |
| Payment-only event | не виден чужому нотариусу |
| Empty state | отображается без ошибки |

## Notification center

| Проверка | Ожидание |
| --- | --- |
| Title | берется из API payload |
| Message | отображается без эвристики |
| Category | отображается по API category |
| Type | отображается по API type |
| Status | читается из readAt/status |
| Mark as read | идемпотентно |
| Delete | возвращает понятный result |
| Bulk mark read | допускает partial failures |
| Bulk delete | допускает partial failures |
| Loading state | не блокирует всю страницу |
| Error state | виден оператору |
| Local update | список обновляется без лишнего reload |

## Проверка notary visibility

| Условие | Ожидание |
| --- | --- |
| Нотариус назначен на заявку | видит audit по этой заявке |
| Нотариус не назначен | не видит audit по чужой заявке |
| Payment связан с его заявкой | видит только через assessment context |
| Payment-only target | не видит без связи с assessment |
| Admin | видит все payment events |
| Applicant | не получает admin monitoring view |
| Export notary | экспорт ограничен scope |
| Target filter | не расширяет права |

## Smoke-test платежного flow

| Шаг | Действие | Ожидание |
| --- | --- | --- |
| 1 | открыть `/admin/payments` | список загрузился |
| 2 | изменить ширину ID | таблица не перезагрузилась |
| 3 | применить фильтр статуса | запрос ушел с statuses |
| 4 | экспортировать CSV | файл скачан |
| 5 | сделать пустую выборку | видна ошибка empty export |
| 6 | перейти к заявке | открыт `/admin/orders` |
| 7 | открыть `/admin/orders` напрямую | нет raw internal error |
| 8 | открыть monitoring | events доступны |
| 9 | найти payment event | targetId работает |
| 10 | открыть уведомления | category и read state видны |
| 11 | запустить Robokassa failure | audit failure есть |
| 12 | запустить Robokassa success | completed event есть |

## Troubleshooting

| Симптом | Вероятная причина | Проверка | Действие |
| --- | --- | --- | --- |
| `/admin/payments` грузится бесконечно | initial request не ушел | Network tab | проверить `page` и `limit` |
| CSV пишет success, файла нет | браузер заблокировал download | `exportError` | проверить download helper |
| `/admin/orders` показывает internal error | full include упал | backend logs | проверить summary fallback |
| Нет имен заявителей | User API недоступен | user lookup logs | показывать short ID |
| Robokassa не открывается | redirect URL не создан | audit redirect.failed | проверить настройки |
| Callback не меняет статус | signature/amount mismatch | callback.failed | сверить InvId и OutSum |
| Уведомления не появились | fanout упал | warning logs | проверить NotificationService |
| Audit пустой | неверный фильтр | reset filters | проверить targetId |
| Notary видит лишнее | scope не применен | role context | проверить notaryId |
| Таблица разъехалась | слишком длинный ID | layout inspect | проверить column width |

## Команды проверки

```powershell
pnpm.cmd nx test admin --ci
pnpm.cmd nx test assessment --ci
pnpm.cmd nx test audit --ci
pnpm.cmd nx test notification --ci
pnpm.cmd nx run web:build:production
pnpm.cmd exec nx affected -t test --parallel=3
git status --short --branch
git diff --stat
```

## Что проверить в логах

| Лог | Когда появляется |
| --- | --- |
| `payment.admin.list_init_started` | открытие списка платежей |
| `payment.admin.list_loaded` | платежи пришли в компонент |
| `payment.admin.export_csv_started` | пользователь нажал экспорт |
| `payment.admin.export_csv_succeeded` | скачивание CSV инициировано |
| `payment.admin.export_csv_failed` | браузер не смог скачать CSV |
| `payment.admin.navigate_application` | переход к связанной заявке |
| `payment.admin.receipt_open_requested` | открытие чека |
| `payment.admin.receipt_download_requested` | скачивание чека |
| `notification.bell.preview_load_started` | загрузка preview уведомлений |
| `notification.bell.preview_load_succeeded` | preview уведомлений загружен |

## Критерии готовности

| Критерий | Статус |
| --- | --- |
| Платежи загружаются без фильтров | обязательно |
| Таблица платежей управляется по ширине | обязательно |
| CSV показывает ошибку при сбое | обязательно |
| Robokassa failure попадает в аудит | обязательно |
| Robokassa success попадает в аудит | обязательно |
| Уведомления не ломают оплату | обязательно |
| Заявки не падают от broken relation | обязательно |
| Monitoring фильтрует события | обязательно |
| Notary scope сохранен | обязательно |
| Production build проходит | обязательно |

## Минимальный набор тестов

| Проект | Команда | Что покрывает |
| --- | --- | --- |
| admin | `pnpm.cmd nx test admin --ci` | payments UI, orders UI, monitoring UI |
| assessment | `pnpm.cmd nx test assessment --ci` | repository fallback and assessment events |
| audit | `pnpm.cmd nx test audit --ci` | scoped audit filters and export |
| notification | `pnpm.cmd nx test notification --ci` | list, read, delete, fanout |
| web | `pnpm.cmd nx run web:build:production` | Angular production compilation |
| affected | `pnpm.cmd exec nx affected -t test --parallel=3` | CI-like regression check |

## API-контракты платежей

| Метод | Вход | Выход | Проверка |
| --- | --- | --- | --- |
| `getPaymentHistory` | page, limit, filters | payments, meta | первичная загрузка работает без фильтров |
| `getPaymentHistory` | status filter | filtered payments | статус уходит в RPC enum |
| `getPaymentHistory` | type filter | filtered payments | тип уходит в RPC enum |
| `createPayment` | userId, amount, type | payment | audit event создан |
| `updatePayment` | id, status | payment | before/after статус виден |
| `deletePayment` | id | deleted result | UI удаляет строку локально |
| `receipt` | paymentId | html/blob | чек открывается или скачивается |
| `robokassa redirect` | paymentId/outSum | paymentUrl | URL проверяется до перехода |
| `robokassa callback` | InvId, OutSum, Signature | status update | подпись и сумма валидируются |

## API-контракты заявок

| Метод | Вход | Выход | Проверка |
| --- | --- | --- | --- |
| `listAssessments` | page, limit | assessments, meta | список загружается |
| `listAssessments` | broken relation | summary rows | fallback не отдает 500 |
| `getAssessment` | id | assessment | id валидируется |
| `verifyAssessment` | id, notaryId | assessment | notaryId фиксируется |
| `completeAssessment` | id, value | assessment | completed event создается |
| `cancelAssessment` | id, reason | assessment | cancelReason виден в audit |
| `listCities` | empty request | cities | справочник не ломает форму |
| `listDistricts` | cityId | districts | cityId валидируется |

## Негативные кейсы

| ID | Ситуация | Ожидание |
| --- | --- | --- |
| NEG-001 | Robokassa не вернула URL | UI показывает ошибку оплаты |
| NEG-002 | Robokassa вернула неверную подпись | callback rejected, статус не меняется |
| NEG-003 | Robokassa вернула неверную сумму | audit failure, платеж не completed |
| NEG-004 | PaymentService вернул 500 | таблица показывает понятную ошибку |
| NEG-005 | AssessmentService full include упал | включается summary fallback |
| NEG-006 | NotificationService недоступен | платежный flow продолжается |
| NEG-007 | AuditService недоступен | ошибка логируется отдельно |
| NEG-008 | CSV download заблокирован браузером | оператор видит exportError |
| NEG-009 | User API недоступен | отображается короткий userId |
| NEG-010 | Пустая выборка CSV | скачивание не стартует |
| NEG-011 | Длинный UUID платежа | колонка ID не растягивает таблицу |
| NEG-012 | Длинный transactionId | ячейка обрезается |
| NEG-013 | Повторный callback | бизнес-эффект не дублируется |
| NEG-014 | Переход к заявке без assessmentId | открывается общий список заявок |
| NEG-015 | Notary открывает чужой audit target | событие скрыто |

## Позитивные кейсы

| ID | Ситуация | Ожидание |
| --- | --- | --- |
| POS-001 | Платеж создан администратором | платеж появился в списке |
| POS-002 | Платеж обновлен | статус обновился |
| POS-003 | Платеж удален | строка исчезла |
| POS-004 | CSV выгружен | файл скачан |
| POS-005 | Чек открыт | blob/html открыт в новой вкладке |
| POS-006 | Чек скачан | файл скачан |
| POS-007 | Redirect Robokassa создан | пользователь перенаправлен |
| POS-008 | Callback Robokassa успешен | платеж completed |
| POS-009 | Заявка открыта из платежа | assessmentId передан |
| POS-010 | Monitoring фильтрует targetId | найдено нужное событие |
| POS-011 | Notification read | readAt установлен |
| POS-012 | Notification delete | уведомление удалено из списка |
| POS-013 | Notary видит свою заявку | audit доступен |
| POS-014 | Admin видит payment-only event | событие доступно |
| POS-015 | Production build | Angular build завершен |

## Проверка данных в таблице платежей

| Поле | Откуда берется | Отображение | Ошибка |
| --- | --- | --- | --- |
| `id` | Payment.id | компактная колонка | не раздвигать таблицу |
| `paymentDate` | Payment.paymentDate | дата | fallback на исходное значение |
| `payer` | user lookup или payment.payer | имя | short id при ошибке |
| `type` | Payment.type | label | enum mapping |
| `amount` | Payment.amount | RUB | формат `ru-RU` |
| `fee` | Payment.fee | RUB | ноль допустим |
| `paymentMethod` | Payment.paymentMethod | label | dash fallback |
| `transactionId` | provider transaction | текст | ellipsis |
| `attachment` | receipt fields | кнопки | dash fallback |
| `assessmentId` | linked assessment | link button | dash fallback |
| `status` | Payment.status | badge | label mapping |
| `actions` | row commands | icon buttons | не переносить хаотично |

## Ревью-чеклист

| Вопрос | Ответ должен быть |
| --- | --- |
| Есть ли изменение бизнес-логики оплаты? | только в местах audit/notification/fallback |
| Может ли уведомление сломать платеж? | нет |
| Может ли CSV скрыть ошибку? | нет |
| Может ли таблица уйти за экран из-за ID? | нет |
| Может ли `/admin/orders` получить 500 из-за broken relation? | fallback должен помочь |
| Сохранился ли notary scope? | да |
| Есть ли тест на fallback заявок? | да |
| Есть ли тест на resize колонок? | да |
| Проверен ли production build? | да |
| Не попали ли локальные файлы в commit? | проверить `git status` |

## Итог

Runbook фиксирует ожидаемое поведение платежей, аудита и уведомлений.
Он помогает быстро проверить платежный flow после изменений и перед регрессионной проверкой.
Основной принцип реализации: платежная операция остается главной,
а уведомления, CSV и мониторинг дают наблюдаемость без разрушения flow.
