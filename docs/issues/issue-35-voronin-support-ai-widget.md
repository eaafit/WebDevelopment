---
title: '[SUPPORT] ИИ-чат техподдержки для гостей — Connect RPC + Angular-виджет'
labels: ['frontend', 'backend', 'support', 'ai', 'guest']
assignees: []
---

## Номер issue и конфликты

Файл **`issue-35-voronin-support-ai-widget.md`** — отдельный номер, чтобы **не пересекаться** с:

- `issue-34-nibylitsin-tempo-tracing.md` (observability, Нибылицын);
- `issue-11-vasorin-support-chat.md` (тикеты/SLA, Васорин);
- `issue-21-govor-support-faq.md` (FAQ в чате, Говор).

Ветка разработки: **`feat_voronin_ea_support_ai_chat`** (от актуального `main`).

---

## 1. Цель и область

### 1.1. Цель

Дать **гостям** портала краткие ответы на вопросы по нотариату, оценке имущества, документам и работе портала через **чат-виджет** с вызовом LLM **только на сервере API**.

### 1.2. В scope (MVP — реализовано в этой ветке)

| Компонент | Путь / суть |
|-----------|-------------|
| Protobuf | `SupportService.AskSupportAi` — `libs/shared/api-contracts/proto/notary/support/v1alpha1/support.proto` |
| NestJS | `libs/api/support` — `SupportModule`, `SupportRpcService`, `SupportAiService` |
| Провайдеры | GigaChat (по умолчанию), OpenAI (`SUPPORT_AI_PROVIDER=openai`) |
| Angular | `lib-support-ai-chat-widget` — лента, loading, Connect RPC |
| Guest | `libs/web/guest` — виджет с `[useBackendAi]="true"` |
| Env | `.env.example` — переменные ИИ-поддержки |
| Публичный RPC | `AuthInterceptor` + `rpc-transport` whitelist |

### 1.3. Вне scope (следующие этапы)

- Тикеты, SLA, операторы → **issue-11**
- FAQ в чате → **issue-21**
- `conversation_id` + история в Prisma
- Rate limiting, антиспам, модерация
- Виджет в ЛК заявителя / нотариуса / админа

---

## 2. Роли и сценарии

| Роль | Сценарий |
|------|----------|
| Гость | FAB «💬» → вопрос → ответ ИИ в ленте |
| Система | Валидация proto, LLM + system prompt, `success` / `error_message` |
| DevOps | `SUPPORT_AI_PROVIDER`, ключи только в `.env` API |

**Happy path:** FAB → ввод → `aiLoading` → `POST Connect` `AskSupportAi` (без JWT) → ответ в transcript.

---

## 3. Архитектура

```
Frontend (SupportAiChatWidget) → RPC_TRANSPORT → Connect Router
  → SupportRpcService → SupportAiService → GigaChat / OpenAI
```

**Принципы:**

- Секреты LLM не попадают в браузер.
- Единственная точка входа для фронта — `AskSupportAi`.
- Метод в whitelist публичных RPC.

---

## 4. Контракт API

**Файл:** `libs/shared/api-contracts/proto/notary/support/v1alpha1/support.proto`

| RPC | Запрос | Ответ |
|-----|--------|-------|
| `AskSupportAi` | `AskSupportAiRequest` | `AskSupportAiResponse` |

- `text`: string, 1–8000 символов (`buf.validate`)
- `conversation_id`: optional UUID (задел)
- Ответ: `answer`, `success`, `error_message`

**Регенерация:** `nx run api-contracts:generate-proto` или `node scripts/buf-generate.cjs libs/shared/api-contracts`

---

## 5. Backend

| Компонент | Путь |
|-----------|------|
| `SupportModule` | `libs/api/support/src/lib/support/support.module.ts` |
| `SupportRpcService` | `support-rpc.service.ts` |
| `SupportAiService` | `support-ai.service.ts` |

**Регистрация:**

- `apps/api/src/app/app.module.ts` — `SupportModule`
- `apps/api/src/app/connect-router.registry.ts` — `askSupportAi`
- `libs/api/auth/.../auth.interceptor.ts` — `PUBLIC_METHODS`

**Зависимости:** `openai`, `gigachat` в корневом `package.json`.

---

## 6. Frontend

| Файл | Назначение |
|------|------------|
| `support-ai-chat-widget.ts` | Логика, signals, Connect client |
| `support-ai-chat-widget.html` | FAB, панель, transcript, composer |
| `support-ai-chat-widget.css` | Стили с `--support-ai-*` |
| `guest.html` / `guest.ts` | Подключение виджета |

**Inputs:** `useBackendAi`, `layout`, `title`, `placeholder`, …  
**Outputs:** `messageSubmit`, `openChange`

---

## 7. Конфигурация

См. блок **ИИ-техподдержка** в `.env.example`.

Минимум для GigaChat: `GIGACHAT_CREDENTIALS` + `GIGACHAT_SCOPE`.  
Для OpenAI: `SUPPORT_AI_PROVIDER=openai` + `OPENAI_API_KEY`.

---

## 8. Критерии приёмки (DoD)

### Функциональные

- [x] FAB и панель на гостевых страницах
- [x] `AskSupportAi` без JWT
- [x] Успешный ответ в ленте как `assistant`
- [x] Понятная ошибка при отсутствии конфигурации API
- [x] Fallback при сетевой ошибке
- [x] Ключи не в bundle фронта

### Технические

- [x] Proto + экспорт в `api-contracts`
- [x] `SupportModule` в `AppModule`
- [x] Публичный whitelist RPC
- [x] `.env.example` документирует переменные
- [x] Экспорт виджета из `@notary-portal/ui`

### Ручная проверка QA

- [ ] `SUPPORT_AI_PROVIDER=gigachat` + валидные `GIGACHAT_*` → ответ по теме
- [ ] Вопрос не по теме → отказ по system prompt
- [ ] Пустой ввод → кнопка неактивна
- [ ] `useBackendAi=false` → только `messageSubmit`
- [ ] Без ключей на API → «ИИ-помощник не настроен…»

---

## 9. Бэклог после MVP

| № | Задача | Приоритет |
|---|--------|-----------|
| 1 | Rate limiting на `AskSupportAi` | Высокий (prod) |
| 2 | `conversation_id` + Prisma | Средний |
| 3 | Виджет в ЛК ролей | Средний |
| 4 | Стриминг ответа | Низкий |
| 5 | Метрики latency / токены | Средний |
| 6 | E2E с mock LLM | Средний |

---

## 10. Затронутые файлы (только эта фича)

```
libs/shared/api-contracts/proto/notary/support/v1alpha1/support.proto
libs/shared/api-contracts/src/index.ts
libs/api/support/**
libs/api/auth/src/lib/auth/auth.interceptor.ts   # +1 строка PUBLIC_METHODS
apps/api/src/app/app.module.ts                   # +SupportModule
apps/api/src/app/connect-router.registry.ts    # +SupportService
libs/web/shared/ui/src/lib/support-ai-chat/**
libs/web/shared/ui/src/lib/rpc/rpc-transport.ts
libs/web/shared/ui/src/index.ts
libs/web/guest/src/lib/guest/guest.{ts,html}
.env.example
package.json
tsconfig.base.json                               # @internal/support
docs/issues/issue-35-voronin-support-ai-widget.md
docs/issues/README.md                            # +строка в таблице
```

**Намеренно не трогали:** Prisma schema, issue-11/21, модули других исполнителей, `issue-34` (Tempo).

---

## 11. Шпаргалка для защиты (1–2 мин)

1. Оформил **issue-35** (без конфликта с issue-34 и чужими support-задачами).
2. Сделал **виджет** в shared UI и встроил в **guest**.
3. Добавил **protobuf + Nest support**, **GigaChat/OpenAI** на API, вызов с фронта через **Connect**, **env** в `.env.example`.
