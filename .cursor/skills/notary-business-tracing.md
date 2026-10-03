## Skill: Разметить backend бизнес-процесс через OpenTelemetry и Grafana Tempo

### Когда использовать

- Добавляется новый backend-процесс, который должен быть виден в Grafana Tempo.
- Меняется существующий backend-процесс, и его трассировку нужно обновить.
- В задаче упоминаются traces, spans, OpenTelemetry, Tempo, Grafana Tempo, `runInSpan`, `notary.operation` или разметка бизнес-процессов API.

### Цель

Показать в trace понятную цепочку бизнес-действий и не утащить в Tempo персональные данные, полные идентификаторы, токены, ключи файлов или тела запросов.

### Перед началом

1. Найди сервис, где живёт новая логика.
2. Посмотри похожие уже размеченные места:
   - `libs/api/assessment/src/lib/assessment/assessment.service.ts`
   - `libs/api/billing/src/lib/payment-create/payment-create.service.ts`
   - `libs/api/billing/src/lib/webhook/payment-webhook.service.ts`
   - `libs/api/auth/src/lib/auth/auth.service.ts`
   - `libs/api/shared/tracing/src/lib/tracing.ts`
   - `libs/api/shared/tracing/src/lib/business-operations.ts`
3. Определи главный бизнес-процесс: что пользователь или система реально делает.
4. Определи важные этапы внутри процесса: проверка входных данных, запись в БД, внешний сервис, audit, notification, storage, mail.

### Основное правило

Не создавай локальные `private runInSpan` и не вызывай `trace.getTracer(...)` напрямую в сервисах.

Используй только общий модуль:

```ts
import {
  BusinessOperations,
  NotarySpanAttributes,
  SpanKind,
  normalizeSpanActorRole,
  normalizeSpanContentType,
  runInSpan,
  setSpanAttributes,
  markSpanFailure,
  spanSizeBucket,
} from '@internal/tracing';
```

`trace.getTracer(...)` должен оставаться внутри `libs/api/shared/tracing/src/lib/tracing.ts`.

### Как размечать процесс

Главный публичный метод сервиса оборачивай в root business span:

```ts
return runInSpan(
  'PaymentCreateService.createPayment',
  {
    [NotarySpanAttributes.operation]: BusinessOperations.paymentCreate,
    [NotarySpanAttributes.entity]: 'Payment',
    [NotarySpanAttributes.actorRole]: normalizeSpanActorRole(getCurrentUser()?.role),
    'payment.type': formatPaymentType(request.type),
    'payment.has_promo': Boolean(request.promoCode?.trim()),
  },
  async (span) => {
    // business logic
    setSpanAttributes(span, { 'payment.provider': provider });
    return result;
  },
);
```

Внутри добавляй child spans только для этапов, которые помогают читать trace:

- запрос к БД, если это важный этап процесса;
- внешний сервис: YooKassa, Robokassa, Bitrix, S3, FIAS;
- audit event;
- notification/mail side effect;
- storage put/get/delete;
- batch-обработка рассылки или синхронизации.

Не создавай span на каждую строку кода. Для циклов и рассылок используй агрегированный span с количеством элементов, а не span на каждого получателя.

### Имена и атрибуты

Используй `BusinessOperations` для root/core spans, повторяемых этапов и операций, по которым будут строиться Tempo-запросы. Одноразовый внутренний этап можно оставить строковым литералом; не раздувай `BusinessOperations` перечнем каждого repository/helper span.

Базовые атрибуты:

- `notary.operation` - что делает процесс;
- `notary.entity` - с какой сущностью работает процесс;
- `notary.actor.role` - роль пользователя, только через `normalizeSpanActorRole`;
- `notary.result` - выставляется helper-ом автоматически.

Доменные атрибуты должны быть стабильными:

- статус: `payment.status.to`, `assessment.status.to`, `bitrix.sync.status`;
- тип: `payment.type`, `document.content_type`, `notification.category`;
- provider: `payment.provider`;
- counters/flags: `newsletter.recipient_count`, `payment.has_promo`, `bitrix.contact.has_email`.

Для файлов не пиши сырой размер и произвольный MIME type. Используй:

- `document.content_type` только через `normalizeSpanContentType(value)`;
- `document.size_bucket` только через `spanSizeBucket(size)`.

### Что нельзя писать в spans

Не передавай в span attributes:

- email, телефон, ФИО, адрес;
- token, password, secret, reset URL;
- request/response body;
- S3 object key, имя файла, путь к файлу;
- полный `userId`, `paymentId`, `assessmentId`, `documentId`, UUID, provider id;
- сырой размер файла в байтах;
- произвольный content type без allowlist-нормализации;
- raw error message или stack trace;
- текст, который может быть уникальным для каждого пользователя или файла.

Если сомневаешься, не добавляй значение в span. Лучше оставить его в audit или безопасном structured log.

### Ошибки

`runInSpan` сам помечает span ошибкой при `throw`.

Используй `markSpanFailure(span, error)` только когда ошибка обработана внутри метода и наружу не пробрасывается, но trace всё равно должен показать неуспешный этап.

Не записывай raw error в attributes. Helper записывает безопасный label через `spanErrorStatusMessage`.

### Внешние вызовы

Для внешних сервисов ставь `SpanKind.CLIENT`:

```ts
await runInSpan(
  'YooKassaClient.createPayment',
  {
    [NotarySpanAttributes.operation]: BusinessOperations.paymentProviderCreate,
    [NotarySpanAttributes.entity]: 'Payment',
    'payment.provider': 'yookassa',
  },
  () => this.yookassa.createPayment(payload),
  { kind: SpanKind.CLIENT },
);
```

Не включай исходящие HTTP/AWS auto-spans без отдельной проверки на утечки. В `apps/api/src/tracing.ts` исходящая HTTP auto-instrumentation и AWS SDK auto-instrumentation отключены намеренно: ручные CLIENT spans безопаснее.

### Логи рядом с tracing

Если правишь файл, где добавляешь spans, проверь соседние backend logs.

Не оставляй в логах:

- полные ID;
- object key и file name;
- email/phone/name/address;
- token/secret/password;
- raw error object или stack.

Для логов используй короткие низкокардинальные сообщения: `operation`, `provider`, `status`, `type`, `result`, `hasAttachment`, `hasReceipt`.

### Проверка

Минимальный набор зависит от изменённого модуля. Обычно нужно:

```bash
pnpm nx test tracing --skip-nx-cache
pnpm nx test <affected-project> --skip-nx-cache
pnpm nx lint <affected-project> --skip-nx-cache
pnpm nx build api --skip-nx-cache
git diff --check
```

Если затронута трассировка HTTP/API route:

```bash
pnpm nx test api --skip-nx-cache
```

Если менялись несколько backend libs:

```bash
pnpm nx run-many -t test -p tracing,api,<projects> --parallel=3 --skip-nx-cache
pnpm nx run-many -t lint -p tracing,api,<projects> --parallel=3 --skip-nx-cache
```

Перед финальным отчётом проверь:

```bash
rg "trace\\.getTracer\\(" apps libs -S
rg "private .*runInSpan|recordException\\(|objectKey|fileName|error\\.stack" apps/api libs/api -g '*.ts'
```

Совпадения допустимы только там, где они являются частью безопасного helper-а, тестов или бизнес-данных, а не span/log attributes.

### Связь с дашбордом

Если добавляешь новый `BusinessOperations` или новую группу бизнес-процессов, проверь, должен ли этот процесс отображаться на Grafana Tempo дашборде.

Для обновления dashboard используй отдельный skill:

- `.cursor/skills/grafana-tempo-business-dashboard.md`

### Готово когда

- Новый или изменённый бизнес-процесс виден в Grafana Tempo через стабильный `notary.operation`.
- В trace есть понятные этапы процесса, а не избыточные spans на каждую строку.
- В span attributes и backend logs нет PII, токенов, ключей файлов, raw body, stack trace и полных идентификаторов.
- Проверки для `tracing`, затронутого проекта и `api` прошли или причина пропуска описана в отчёте.

### Отчёт

В конце работы сообщи:

- какие бизнес-процессы покрыты;
- какие `notary.operation` добавлены или переиспользованы;
- какие файлы изменены;
- какие проверки прошли;
- какие предупреждения остались и почему они не относятся к этой правке;
- что не было commit/push/PR, если пользователь этого не просил.
