# @internal/bitrix-leads

Публикация заявок (Assessment) в Bitrix24 как лидов (Lead) через REST-метод
`crm.lead.add`. Задача лаб. работы №6 (issue-05, Деркач Е.С.).

## Текущее состояние

**Scaffold only** — каркас Nx-библиотеки. Реализация идёт по фазам:

| Фаза | Содержание |
|------|------------|
| 1 (эта) | Каркас, env-переменные, миграция `bitrixLeadId` |
| 2 | `BitrixLeadsConfigService` — чтение `BITRIX_WEBHOOK_URL` / `BITRIX_PORTAL_URL` через `@nestjs/config` |
| 3 | `BitrixLeadsApiService` — axios-клиент, метод `createLead(fields)` |
| 4 | `BitrixLeadMapper` — Assessment + User → Bitrix Lead fields |
| 5 | `BitrixLeadPublisherService` — оркестратор: lookup, mapping, API, persist, retry |
| 6 | Подключение в `AssessmentService.createAssessment` (fire-and-forget) |

## Архитектурное решение

Модуль автономен: собственный конфиг, HTTP-клиент и persistence-логика.
Папка `libs/api/bitrix/` (синк Users → Contacts от препода) **не используется**
ни на импорт, ни на чтение — это его зона ответственности.

## Внешние зависимости

- `axios` (уже в корневом `package.json`)
- `@internal/prisma` — для чтения `User` и записи `Assessment.bitrixLeadId`
- `@nestjs/config` — для env-переменных
