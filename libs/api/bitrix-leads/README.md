# @internal/bitrix-leads

Модуль интеграции **Notary Portal → Bitrix24**. При создании заявки на оценку
(Assessment) автоматически публикует её как лид (Lead) в Bitrix24 через REST
`crm.lead.add`. Лаб. работа №6, issue-05 (Деркач Е.С.).

## Поток данных

1. Заявитель создаёт Assessment через UI (`/applicant/...`).
2. `AssessmentService.createAssessment` сохраняет заявку в БД.
3. Сразу после успешного `create` — **fire-and-forget** вызов
   `BitrixLeadPublisherService.publishLead(assessmentId)`.
4. Publisher тянет Assessment + User из БД, мапит в `LeadFields`, шлёт POST
   на `{webhook}/crm.lead.add.json` через axios (с retry для transient ошибок).
5. При успехе — `bitrixLeadId` сохраняется в Assessment.

```
Applicant UI ──> AssessmentService.createAssessment
                       │
                       ├─ await assessmentRepository.createAssessment ─> БД
                       │
                       └─ bitrixLeadPublisher.publishLead (fire-and-forget)
                              │
                              ├─ prisma.assessment + user.findUnique
                              ├─ идемпотентность: skip если bitrixLeadId уже есть
                              ├─ buildLeadFields (pure mapper)
                              ├─ retryWithBackoff(api.createLead)
                              │      └─ POST {webhook}/crm.lead.add.json
                              └─ prisma.assessment.update({ bitrixLeadId })
```

## Структура файлов

| Файл | Назначение |
|------|------------|
| `bitrix-leads.module.ts` | NestJS-модуль, экспортирует `BitrixLeadPublisherService` |
| `bitrix-leads-config.service.ts` | Чтение `BITRIX_WEBHOOK_URL` / `BITRIX_PORTAL_URL` из env |
| `bitrix-leads-api.service.ts` | Низкоуровневая axios-обёртка `createLead(fields)` |
| `bitrix-lead-publisher.service.ts` | Оркестратор — единственный публичный entry point |
| `bitrix-lead.mapper.ts` | Pure function `buildLeadFields(assessment, user)` |
| `bitrix-leads.types.ts` | `LeadFields`, `BitrixResponse<T>`, `LeadCreateResult` |
| `bitrix-leads.errors.ts` | Иерархия `BitrixApiError` (5 subclass-ов с `code`) |
| `bitrix-leads-retry.helper.ts` | Generic `retryWithBackoff` с экспоненциальным delay |
| `bitrix-leads.tokens.ts` | DI-токен `BITRIX_LEADS_HTTP_CLIENT` |

## Настройка локально

1. Зарегистрировать бесплатный портал на https://www.bitrix24.ru/
2. Войти в портал → **Приложения → Разработчикам → Другое → Входящий вебхук**
3. Дать права webhook'у: **CRM** (для `crm.lead.add`)
4. Скопировать полный URL вебхука (включая `/rest/N/<token>/`)
5. В корне репо в `.env` (не закоммичен):
   ```
   BITRIX_WEBHOOK_URL=https://your-portal.bitrix24.ru/rest/1/your-token/
   BITRIX_PORTAL_URL=https://your-portal.bitrix24.ru
   ```
6. Применить миграцию (если ещё не): `pnpm nx run prisma:deploy`
7. Перезапустить API: `pnpm nx serve api`

## Smoke-тест

1. Открыть как заявитель `/applicant/...` → создать заявку
2. Открыть `https://<your-portal>.bitrix24.ru/crm/lead/list/` → должен появиться
   лид с TITLE вида `Заявка xxxxxxxx — <адрес>`
3. `pnpm nx run prisma:studio` → у заявки заполнено поле `bitrix_lead_id`
4. Negative path: испортить `BITRIX_WEBHOOK_URL` в `.env` → перезапустить API →
   создать заявку → она всё равно создалась, в логе API warning
   `Bitrix lead publish failed for assessment=...`

## Retry-политика

- 3 попытки максимум, экспоненциальный backoff 1s → 3s → 9s
- **Retry только для:** `BitrixUnavailableError` (5xx, network),
  `BitrixRateLimitError` (~2 req/sec)
- **НЕ retry:** `BitrixAuthError` (webhook отозван/невалиден),
  `BitrixValidationError` (плохие данные), `BitrixUnknownError`

## Кастомное поле `UF_CRM_ASSESSMENT_ID`

Маппер пишет ID нашей заявки в кастомное поле лида `UF_CRM_ASSESSMENT_ID`.
Чтобы оно сохранилось в Bitrix, в админке портала нужно создать пользовательское
поле для сущности «Лид» с таким именно кодом. Если поле не создано — Bitrix
просто проигнорирует его, остальные поля заполнятся нормально (не критично).

## Подключение в AssessmentModule

```typescript
@Module({
  imports: [PrismaModule, AuditModule, NotificationModule, BitrixLeadsModule],
})
export class AssessmentModule {}
```

```typescript
constructor(
  private readonly bitrixLeadPublisher: BitrixLeadPublisherService,
  // ...
) {}

async createAssessment(req) {
  const assessment = await this.assessmentRepository.createAssessment(...);
  // ...
  this.bitrixLeadPublisher.publishLead(assessment.id).catch((error) =>
    this.logger.warn(`Bitrix lead publish failed: ${error.message}`),
  );
  return create(...);
}
```

## Зависимости

- `axios ^1.13.2` (уже в корневом `package.json`)
- `@internal/prisma` — для `Assessment.findUnique`/`update`, `User.findUnique`
- `@nestjs/common` (Module, Injectable, Logger, Inject)

## Что НЕ использует

- `@internal/bitrix` — это зона препода (синхронизация Users→Contacts),
  у нас параллельный изолированный модуль (Strategy B). Никаких импортов оттуда.

## Тесты

- 78 тестов внутри bitrix-leads:
  - 8 — `bitrix-leads-config.service.spec.ts` (валидация env)
  - 12 — `bitrix-leads-api.service.spec.ts` (HTTP-клиент + классификация ошибок)
  - 41 — `bitrix-lead.mapper.spec.ts` (граничные случаи маппинга)
  - 6 — `bitrix-leads-retry.helper.spec.ts` (backoff + isRetriable)
  - 11 — `bitrix-lead-publisher.service.spec.ts` (оркестрация + retry)
- 2 теста в `assessment.service.spec.ts` (integration): publisher вызван
  с правильным id, ошибки publisher не пробрасываются в ответ заявителю

Запуск: `pnpm nx run bitrix-leads:test`
