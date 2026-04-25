# 📋 План разработки веб-приложения

## NX Monorepo · Angular 21 · NestJS 11 · PostgreSQL · Prisma 7 · ConnectRPC · TypeScript 5.9

> **Назначение документа:** пошаговый план для AI-агента и команды разработчиков.
> Каждая фаза содержит: цель, инструкции агенту, чеклисты, артефакты и критерии готовности (DoD).
> План предметно-независим — применим к любому SaaS-проекту на данном стеке.

---

## Стек технологий

| Уровень           | Технология                                 | Версия     |
| ----------------- | ------------------------------------------ | ---------- |
| Монорепозиторий   | NX Workspace                               | 22.x       |
| Frontend          | Angular (standalone components, Signals)   | 21.x       |
| Backend           | NestJS                                     | 11.x       |
| База данных       | PostgreSQL                                 | 16.x       |
| ORM               | Prisma                                     | 7.x        |
| API-протокол      | ConnectRPC (buf/protobuf)                  | 2.x        |
| Язык              | TypeScript                                 | 5.9        |
| Пакетный менеджер | pnpm                                       | latest     |
| Контейнеризация   | Docker / Docker Compose                    | latest     |
| CI/CD             | GitHub Actions                             | —          |
| Frontend deploy   | Netlify                                    | —          |
| Тестирование      | Jest + jest-preset-angular                 | 30.x       |
| Линтинг           | ESLint (typescript-eslint) + Prettier      | 9.x / 3.x  |
| CSS-линтинг       | Stylelint (stylelint-config-standard-scss) | 17.x       |
| Pre-commit        | Husky + lint-staged                        | 9.x / 16.x |
| Мониторинг ошибок | Sentry                                     | —          |

---

## Обзор фаз

| Фаза   | Название                                            | Тип             | Блокирует |
| ------ | --------------------------------------------------- | --------------- | --------- |
| **A**  | Анализ предметной области                           | Аналитическая   | Всё       |
| **B**  | Бизнес-требования                                   | Аналитическая   | C, D, E   |
| **C**  | Функциональные и нефункциональные требования        | Аналитическая   | D, E      |
| **D**  | Модель данных                                       | Проектировочная | E, 0, 1   |
| **E**  | Технические решения (Architecture Decision Records) | Проектировочная | 0         |
| **0**  | Инфраструктура и DevOps                             | Блокирующая     | 1         |
| **1**  | Аутентификация и транспортный слой                  | Блокирующая     | 2, 3      |
| **2**  | Shared UI-библиотека и Design System                | Блокирующая     | 3         |
| **3**  | Бизнес-логика: доменные модули                      | Функциональная  | 4, 5      |
| **4**  | Ролевые кабинеты (Frontend)                         | Функциональная  | 6         |
| **5**  | Платёжный модуль                                    | Функциональная  | —         |
| **6**  | Реалтайм и коммуникации                             | Функциональная  | —         |
| **7**  | Публичная часть и SEO                               | Функциональная  | —         |
| **8**  | Тестирование и QA                                   | Параллельная    | —         |
| **9**  | Развёртывание Production                            | Завершающая     | —         |
| **10** | Внешние интеграции                                  | Расширяющая     | —         |

**Подфазы доменных модулей (Фазы 3–6):**

| Подфаза | Название                                     | Закрывает US          | Приоритет |
| ------- | -------------------------------------------- | --------------------- | --------- |
| **3.A** | ReportModule                                 | US-07, 08, 09, 17, 19 | 🔴        |
| **3.B** | SaleModule                                   | US-12                 | 🔴        |
| **3.C** | Auth расширение (ForgotPassword, OAuth)      | US-01, 02, 03         | 🔴        |
| **3.D** | DocumentService расширение (Moderация)       | US-14, `/admin/files` | 🟡        |
| **3.E** | AssessmentService расширение (cancel+refund) | US-24                 | 🟡        |
| **4.A** | NotificationModule                           | US-07, 22             | 🟡        |
| **4.B** | AuditModule + AdminStatistics                | US-16, 25             | 🟡        |
| **4.C** | PromoModule                                  | US-13, 15             | 🟡        |
| **4.D** | Admin: Subscriptions + Settings              | sitemap               | 🟠        |
| **4.E** | Notary Analytics                             | US-26                 | 🟠        |
| **5.A** | PaymentService расширение + Webhook          | US-06, 09             | 🔴        |
| **6.A** | SupportModule                                | US-15, 17, 21, 22, 25 | 🔴        |
| **6.B** | KnowledgeModule (FAQ)                        | US-30                 | 🟡        |

---

---

# ФАЗА A — Анализ предметной области

> **Инструкция агенту:** Эта фаза выполняется до написания любого кода.
> Цель — сформировать структурированное понимание домена, которое ляжет в основу
> всех последующих решений. Агент обязан задавать уточняющие вопросы заказчику,
> фиксировать ответы в артефактах и не переходить к фазе B без явного подтверждения
> полноты анализа.

---

## Этап A.1 — Сбор контекста

**Инструкция агенту:**

1. Запросить у заказчика все доступные материалы: бриф, конкурентный анализ, существующие
   системы, регуляторные ограничения.
2. Провести интервью по шаблону ниже. Каждый вопрос — отдельный диалог, не список.
3. Зафиксировать ответы в `docs/domain-context.md`.

**Вопросы для интервью с заказчиком:**

```
1. Что является основным продуктом / услугой системы?
2. Кто конечные пользователи? Перечислить все роли.
3. Каков жизненный цикл основной сущности системы (от создания до завершения)?
4. Какие внешние системы должны быть интегрированы?
5. Каковы регуляторные / правовые ограничения?
6. Каков ожидаемый масштаб: пользователи, транзакции в день, объём данных?
7. Существуют ли аналогичные системы на рынке? В чём отличие?
8. Какова бизнес-модель монетизации?
```

**Артефакт:** `docs/domain-context.md`

```markdown
# Контекст предметной области

## Продукт

<описание>

## Роли пользователей

| Роль | Описание | Ключевые сценарии |
| ---- | -------- | ----------------- |

## Жизненный цикл основной сущности

<диаграмма или описание статусов>

## Внешние системы

<список>

## Ограничения

<регуляторные, технические, бюджетные>

## Масштаб

<метрики>
```

---

## Этап A.2 — Глоссарий домена

**Инструкция агенту:**

1. Выписать все термины предметной области из собранных материалов.
2. Для каждого термина определить: определение, синонимы, связанные сущности.
3. Согласовать глоссарий с заказчиком — убедиться, что нет разночтений.
4. Глоссарий будет использоваться как единственный источник истины
   при именовании сущностей в коде (Ubiquitous Language).

**Артефакт:** `docs/glossary.md`

```markdown
# Глоссарий предметной области

| Термин | Определение  | Синонимы   | Связанные сущности   |
| ------ | ------------ | ---------- | -------------------- |
| <Term> | <definition> | <synonyms> | <Entity1>, <Entity2> |
```

---

## Этап A.3 — Карта процессов (Business Process Map)

**Инструкция агенту:**

1. Описать каждый бизнес-процесс в виде последовательности шагов.
2. Для каждого шага указать: актор, действие, триггер, результат.
3. Выявить ветвления и альтернативные пути.
4. Сохранить в `docs/process-map.md` в формате таблиц или псевдо-BPMN.

**Шаблон описания процесса:**

```markdown
## Процесс: <Название>

**Актор-инициатор:** <роль>
**Триггер:** <что запускает процесс>
**Результат:** <что происходит по завершении>

| Шаг | Актор | Действие | Условие | Результат |
| --- | ----- | -------- | ------- | --------- |
| 1   |       |          |         |           |
```

---

## Этап A.4 — Анализ конкурентов и аналогов

**Инструкция агенту:**

1. Исследовать 3–5 аналогичных систем.
2. Для каждого аналога зафиксировать: функциональность, UX-паттерны, ограничения.
3. Выявить «лучшие практики» домена, которые стоит позаимствовать.
4. Выявить «антипаттерны» — что делать не нужно.

**Артефакт:** `docs/competitive-analysis.md`

---

**DoD фазы A:**

- [ ] `docs/domain-context.md` — заполнен и согласован с заказчиком
- [ ] `docs/glossary.md` — все ключевые термины определены
- [ ] `docs/process-map.md` — все основные процессы описаны
- [ ] `docs/competitive-analysis.md` — минимум 3 аналога проанализированы
- [ ] Глоссарий согласован: нет терминов без определения

---

---

# ФАЗА B — Бизнес-требования

> **Инструкция агенту:** Бизнес-требования описывают ЧТО система должна делать
> с точки зрения бизнеса — без деталей реализации. Источник: материалы фазы A.
> Каждое требование должно быть: атомарным, измеримым, приоритизированным.
> Агент формирует требования сам на основе анализа, затем согласует с заказчиком.

---

## Этап B.1 — Пользовательские истории (User Stories)

**Инструкция агенту:**

1. Для каждой роли из глоссария сформировать пользовательские истории.
2. Формат: `Как <роль>, я хочу <действие>, чтобы <ценность>`.
3. К каждой истории добавить критерии приёмки (Acceptance Criteria) в формате Given/When/Then.
4. Приоритизировать по MoSCoW: Must / Should / Could / Won't.

**Артефакт:** `docs/user-stories.md`

```markdown
# Пользовательские истории

## Роль: <RoleName>

### US-001: <Краткое название>

**История:** Как <роль>, я хочу <действие>, чтобы <ценность>.
**Приоритет:** Must | Should | Could | Won't
**Критерии приёмки:**

- Given <контекст> When <действие> Then <результат>
- Given <контекст> When <действие> Then <результат>
```

---

## Этап B.2 — Бизнес-правила

**Инструкция агенту:**

1. Выявить все бизнес-правила из пользовательских историй и процессов.
2. Бизнес-правило — это ограничение или условие, которое система обязана соблюдать.
3. Каждое правило — атомарно и однозначно.
4. Правила станут основой для валидаций в бизнес-логике (`*.service.ts`).

**Артефакт:** `docs/business-rules.md`

```markdown
# Бизнес-правила

| ID     | Правило        | Связанные US | Где применяется |
| ------ | -------------- | ------------ | --------------- |
| BR-001 | <формулировка> | US-001       | <Domain>Service |
| BR-002 | <формулировка> | US-003       | <Domain>Service |
```

---

## Этап B.3 — Use Case диаграмма

**Инструкция агенту:**

1. Составить список всех Use Cases системы.
2. Для каждого Use Case указать: актора, предусловие, основной поток, альтернативные потоки.
3. Сохранить текстовое описание и опционально PlantUML-диаграмму.

**Артефакт:** `docs/use-cases.md`

```markdown
# Use Cases

## UC-001: <Название>

**Актор:** <роль>
**Предусловие:** <что должно быть истинно перед выполнением>
**Основной поток:**

1. ...
2. ...
   **Альтернативный поток A (ошибка X):**
3. ...
   **Постусловие:** <что гарантируется после выполнения>
```

---

**DoD фазы B:**

- [ ] `docs/user-stories.md` — истории для всех ролей, все приоритизированы
- [ ] `docs/business-rules.md` — все правила перечислены, каждое имеет ID
- [ ] `docs/use-cases.md` — все UC описаны с альтернативными потоками
- [ ] Согласовано с заказчиком: все Must-истории подтверждены

---

---

# ФАЗА C — Функциональные и нефункциональные требования

> **Инструкция агенту:** ФТ описывают поведение системы (что делает).
> НФТ описывают качество системы (как делает). Источник: фазы A и B.
> ФТ должны быть трассируемы до User Stories. НФТ должны быть измеримы.

---

## Этап C.1 — Функциональные требования (ФТ)

**Инструкция агенту:**

1. Преобразовать User Stories в формальные ФТ.
2. Каждое ФТ: однозначно, проверяемо, не содержит деталей реализации.
3. Сгруппировать по модулям системы.
4. Добавить ссылку на US-источник.

**Артефакт:** `docs/FR.md`

```markdown
# Функциональные требования

## Модуль: <ModuleName>

| ID     | Требование                                                  | Источник (US) | Приоритет |
| ------ | ----------------------------------------------------------- | ------------- | --------- |
| FR-001 | Система должна позволять пользователю с ролью X выполнить Y | US-001        | Must      |
| FR-002 | Система должна отправлять уведомление Z при событии W       | US-004        | Should    |
```

---

## Этап C.2 — Нефункциональные требования (НФТ)

**Инструкция агенту:**

1. Определить НФТ по каждой категории ниже.
2. Каждое НФТ должно иметь числовой критерий — иначе оно не проверяемо.
3. НФТ станут основой для архитектурных решений в фазе E.

**Артефакт:** `docs/NFR.md`

```markdown
# Нефункциональные требования

## Производительность

| ID        | Требование              | Метрика                | Метод проверки |
| --------- | ----------------------- | ---------------------- | -------------- |
| NFR-P-001 | Время ответа API        | p95 < 500ms            | Load test (k6) |
| NFR-P-002 | Время загрузки страницы | LCP < 2.5s             | Lighthouse CI  |
| NFR-P-003 | Пропускная способность  | > N RPS без деградации | k6 stress test |

## Надёжность

| ID        | Требование                     | Метрика   | Метод проверки |
| --------- | ------------------------------ | --------- | -------------- |
| NFR-R-001 | Доступность сервиса            | SLA 99.9% | Uptime monitor |
| NFR-R-002 | RTO (Recovery Time Objective)  | < 1 час   | DR drill       |
| NFR-R-003 | RPO (Recovery Point Objective) | < 24 часа | Backup policy  |

## Безопасность

| ID        | Требование                   | Стандарт               | Метод проверки  |
| --------- | ---------------------------- | ---------------------- | --------------- |
| NFR-S-001 | Шифрование данных в транзите | TLS 1.2+               | SSL Labs A+     |
| NFR-S-002 | Шифрование паролей           | bcrypt rounds≥12       | Code review     |
| NFR-S-003 | Защита от brute force        | max 10 req/min на auth | Rate limit test |
| NFR-S-004 | Хранение платёжных данных    | PCI DSS                | Audit           |

## Масштабируемость

| ID         | Требование                     | Метрика                           | Метод проверки      |
| ---------- | ------------------------------ | --------------------------------- | ------------------- |
| NFR-SC-001 | Горизонтальное масштабирование | Stateless API                     | Architecture review |
| NFR-SC-002 | Рост БД                        | Партиционирование при > N записей | Schema review       |

## Удобство использования

| ID        | Требование              | Метрика                                       | Метод проверки        |
| --------- | ----------------------- | --------------------------------------------- | --------------------- |
| NFR-U-001 | Доступность (a11y)      | WCAG 2.1 AA                                   | axe-core audit        |
| NFR-U-002 | Адаптивность            | 320px – 1440px                                | Manual + BrowserStack |
| NFR-U-003 | Совместимость браузеров | Chrome/Firefox/Safari/Edge последние 2 версии | BrowserStack          |

## Сопровождаемость

| ID        | Требование                | Метрика        | Метод проверки |
| --------- | ------------------------- | -------------- | -------------- |
| NFR-M-001 | Покрытие тестами backend  | branches ≥ 60% | Jest coverage  |
| NFR-M-002 | Покрытие тестами frontend | branches ≥ 50% | Jest coverage  |
| NFR-M-003 | Документация API          | 100% методов   | Proto comments |
```

---

## Этап C.3 — Матрица трассируемости требований

**Инструкция агенту:**
После заполнения FR и NFR построить матрицу трассируемости:
FR → US → UC → модуль кода. Это позволяет проверить, что ни одно требование
не потеряно при реализации.

**Артефакт:** `docs/traceability-matrix.md`

```markdown
# Матрица трассируемости

| FR     | User Story | Use Case | NestJS Module | Proto Service | Frontend Feature |
| ------ | ---------- | -------- | ------------- | ------------- | ---------------- |
| FR-001 | US-001     | UC-001   | AuthModule    | AuthService   | /auth/login      |
```

---

**DoD фазы C:**

- [ ] `docs/FR.md` — все ФТ перечислены, каждое трассируется до US
- [ ] `docs/NFR.md` — все НФТ имеют числовые метрики
- [ ] `docs/traceability-matrix.md` — матрица заполнена
- [ ] Ни одна User Story не осталась без ФТ

---

---

# ФАЗА D — Модель данных

> **Инструкция агенту:** Модель данных строится на основе глоссария (фаза A)
> и функциональных требований (фаза C). Агент должен пройти все шаги ниже
> последовательно, не переходя к Prisma-схеме без завершения концептуальной модели.

---

## Этап D.1 — Концептуальная модель (Entity-Relationship)

**Инструкция агенту:**

1. Выписать все сущности из глоссария.
2. Определить атрибуты каждой сущности (без типов — только имена).
3. Определить связи между сущностями: тип (1:1, 1:N, M:N), обязательность.
4. Зафиксировать в текстовом формате (PlantUML @startuml / @enduml опционально).

**Артефакт:** `docs/entities.md`

```markdown
# Концептуальная модель данных

## Сущность: <EntityName>

**Описание:** <из глоссария>
**Атрибуты:** id, <attr1>, <attr2>, createdAt, updatedAt
**Связи:**

- 1:N с <OtherEntity> (одна <Entity> имеет много <OtherEntity>)
- M:N с <Entity3> через <JunctionEntity>

## Связи (сводная таблица)

| Сущность A | Тип | Сущность B | Обязательность  |
| ---------- | --- | ---------- | --------------- |
| User       | 1:N | Order      | User обязателен |
```

---

## Этап D.2 — Логическая модель (типизация и нормализация)

**Инструкция агенту:**

1. Для каждого атрибута определить: тип данных PostgreSQL, nullable, unique, default.
2. Убедиться в 3NF (третья нормальная форма): нет транзитивных зависимостей.
3. Определить enum-значения для статусных и типовых полей.
4. Определить индексы: по каким полям будут фильтрация, сортировка, JOIN.

**Правила именования:**

```
Таблицы:        snake_case, множественное число         (users, refresh_tokens)
Поля:           snake_case                              (created_at, user_id)
Prisma модели:  PascalCase, единственное число          (User, RefreshToken)
Prisma поля:    camelCase                               (createdAt, userId)
Enum:           PascalCase название, SCREAMING_SNAKE значения (UserRole { ADMIN, USER })
PK:             всегда UUID v4: @id @default(uuid()) @db.Uuid
FK:             <entity>Id + @map("<entity>_id") @db.Uuid
Timestamps:     createdAt @default(now()) @db.Timestamp()
                updatedAt @updatedAt @db.Timestamp()
```

---

## Этап D.3 — Prisma Schema

**Инструкция агенту:**

1. Перенести логическую модель в `schema.prisma`.
2. Соблюдать конвенции именования из D.2.
3. Добавить `@@map` для каждой модели (snake_case имя таблицы).
4. Добавить `@@index` для полей, участвующих в фильтрах и JOIN.
5. После написания схемы — запустить `prisma validate` и устранить ошибки.

**Шаблон модели:**

```prisma
model EntityName {
  id        String    @id @default(uuid()) @db.Uuid
  // бизнес-поля
  status    EntityStatus
  // FK
  userId    String    @map("user_id") @db.Uuid
  user      User      @relation(fields: [userId], references: [id])
  // timestamps
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp()
  updatedAt DateTime  @updatedAt      @map("updated_at") @db.Timestamp()

  @@map("entity_names")
  @@index([userId])
  @@index([status, createdAt(sort: Desc)])
}

enum EntityStatus {
  DRAFT
  ACTIVE
  COMPLETED
  CANCELLED
}
```

**Команды после написания схемы:**

```bash
npx prisma validate               # проверить синтаксис
npx prisma migrate dev --name <migration_name>
npx prisma generate               # сгенерировать клиент
```

---

## Этап D.4 — Seed-данные

**Инструкция агенту:**

1. Написать `libs/api/shared/prisma/seed.ts`.
2. Seed должен покрывать: все роли, все enum-статусы, связанные записи.
3. Использовать `prisma.$transaction([...])` для атомарности.
4. Seed должен быть идемпотентным: повторный запуск не создаёт дубликатов
   (использовать `upsert` или `deleteMany` + `createMany`).

```typescript
// Шаблон seed.ts
import { PrismaClient } from './generated/prisma';

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // 1. Создать базовые справочники (если есть)
    // 2. Создать пользователей каждой роли
    // 3. Создать связанные записи в разных статусах
    // 4. Использовать upsert: { where: { email }, update: {}, create: {...} }
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

---

**DoD фазы D:**

- [ ] `docs/entities.md` — все сущности описаны, связи указаны
- [ ] `schema.prisma` — валидна (`prisma validate` без ошибок)
- [ ] Все enum-типы определены в схеме
- [ ] Индексы добавлены для всех FK и фильтруемых полей
- [ ] `seed.ts` — идемпотентный, покрывает все роли и статусы
- [ ] Миграция применена: `prisma migrate dev` прошёл без ошибок

---

---

# ФАЗА E — Технические решения (Architecture Decision Records)

> **Инструкция агенту:** Каждое значимое техническое решение фиксируется как ADR.
> ADR описывает: контекст, варианты, выбранное решение, последствия.
> Цель фазы — до начала разработки зафиксировать все архитектурные решения,
> которые дорого менять позднее.

---

## Этап E.1 — API-контракты (Proto-файлы)

**Инструкция агенту:**

1. На основе ФТ (фаза C) и модели данных (фаза D) определить все RPC-сервисы.
2. Для каждого сервиса: имя, методы, входные/выходные сообщения.
3. Написать `.proto`-файлы. Соблюдать конвенции buf.
4. Запустить `buf lint` — устранить все предупреждения.
5. Запустить `buf generate` — убедиться что TypeScript-типы генерируются.

**Структура proto-файла:**

```protobuf
// libs/shared/api-contracts/proto/<domain>/v1alpha1/<domain>.proto
syntax = "proto3";
package <org>.<domain>.v1alpha1;

import "google/protobuf/timestamp.proto";

// Перечисления — все значения с префиксом имени enum
enum EntityStatus {
  ENTITY_STATUS_UNSPECIFIED = 0;
  ENTITY_STATUS_DRAFT       = 1;
  ENTITY_STATUS_ACTIVE      = 2;
  ENTITY_STATUS_COMPLETED   = 3;
}

// Основная сущность
message Entity {
  string id         = 1;
  string name       = 2;
  EntityStatus status = 3;
  google.protobuf.Timestamp created_at = 4;
}

// Запросы и ответы — отдельные сообщения для каждого метода
message CreateEntityRequest  { string name = 1; }
message CreateEntityResponse { Entity entity = 1; }
message GetEntityRequest     { string id = 1; }
message GetEntityResponse    { Entity entity = 1; }
message ListEntitiesRequest  {
  int32 page      = 1;
  int32 page_size = 2;
  string search   = 3;
}
message ListEntitiesResponse {
  repeated Entity entities = 1;
  int32 total = 2;
}

// Сервис
service EntityService {
  rpc CreateEntity (CreateEntityRequest)  returns (CreateEntityResponse);
  rpc GetEntity    (GetEntityRequest)     returns (GetEntityResponse);
  rpc ListEntities (ListEntitiesRequest)  returns (ListEntitiesResponse);
  rpc UpdateEntity (UpdateEntityRequest)  returns (UpdateEntityResponse);
  rpc DeleteEntity (DeleteEntityRequest)  returns (DeleteEntityResponse);
}
```

**Правила написания proto:**

```
- Все enum начинаются со значения UNSPECIFIED = 0
- Имена полей: snake_case
- Имена сообщений и сервисов: PascalCase
- Каждый метод имеет уникальные Request/Response сообщения (не переиспользовать)
- Пагинация: page (1-based) + page_size в Request, total в Response
- Timestamps: google.protobuf.Timestamp (не string)
- IDs: string (UUID передаётся как строка)
```

**buf.gen.yaml:**

```yaml
version: v2
plugins:
  - plugin: es
    out: libs/shared/api-contracts/src/gen
    opt: target=ts
  - plugin: connect-es
    out: libs/shared/api-contracts/src/gen
    opt: target=ts
```

**NX таргеты в `libs/shared/api-contracts/project.json`:**

```json
{
  "targets": {
    "generate-proto": {
      "executor": "nx:run-commands",
      "options": { "command": "buf generate", "cwd": "libs/shared/api-contracts" }
    },
    "lint-proto": {
      "executor": "nx:run-commands",
      "options": { "command": "buf lint", "cwd": "libs/shared/api-contracts" }
    },
    "breaking-proto": {
      "executor": "nx:run-commands",
      "options": {
        "command": "buf breaking --against '.git#branch=main'",
        "cwd": "libs/shared/api-contracts"
      }
    }
  }
}
```

---

## Этап E.2 — Карта модулей и зависимостей

**Инструкция агенту:**

1. Нарисовать (текстом) граф зависимостей между NX-библиотеками.
2. Определить теги (`scope:backend`, `scope:frontend`, `scope:shared`) для каждой lib.
3. Настроить `@nx/enforce-module-boundaries` в ESLint.
4. Проверить граф: `pnpm nx graph`.

**Структура libs:**

```
libs/
├── shared/
│   └── api-contracts/    # scope:shared — proto types, NO бизнес-логики
├── api/
│   ├── shared/prisma/    # scope:backend — PrismaModule, schema, seed
│   └── <domain>/         # scope:backend — Repository + Service + RpcService
└── web/
    ├── shared/ui/         # scope:frontend — Design System, Guards, Transport
    ├── guest/             # scope:frontend — публичная часть
    └── <role>/            # scope:frontend — кабинет роли
```

**ESLint module-boundary rules:**

```javascript
// eslint.config.mjs
{
  rules: {
    '@nx/enforce-module-boundaries': ['error', {
      depConstraints: [
        { sourceTag: 'scope:frontend', onlyDependOnLibsWithTags: ['scope:frontend', 'scope:shared'] },
        { sourceTag: 'scope:backend',  onlyDependOnLibsWithTags: ['scope:backend',  'scope:shared'] },
        { sourceTag: 'scope:shared',   onlyDependOnLibsWithTags: ['scope:shared'] },
      ]
    }]
  }
}
```

---

## Этап E.3 — Sitemap и маршрутизация

**Инструкция агенту:**

1. На основе ролей и Use Cases определить все маршруты приложения.
2. Для каждого маршрута указать: путь, компонент/lib, guard, lazy-loading.
3. Сохранить в `docs/sitemap.md`.

**Шаблон sitemap:**

```markdown
# Sitemap

## Публичные маршруты (без guard)

| Путь  | Lib   | Компонент   | Описание         |
| ----- | ----- | ----------- | ---------------- |
| /     | guest | LandingPage | Главная          |
| /auth | guest | AuthPage    | Вход/регистрация |

## Роль: <RoleName>

**Guard:** `canActivate: [authGuard, roleGuard(UserRole.X)]`
| Путь | Lib | Компонент | Описание |
|------|-----|-----------|----------|
| /role | role-lib | Dashboard | Главная кабинета |
| /role/section | role-lib | ListComponent | Список |
| /role/section/:id | role-lib | DetailComponent | Детали |
```

---

## Этап E.4 — ADR (Architecture Decision Records)

**Инструкция агенту:**
Для каждого значимого решения создать отдельный файл `docs/adr/ADR-NNN.md`.

**Шаблон ADR:**

```markdown
# ADR-001: <Название решения>

**Статус:** Принято / Отклонено / Заменено ADR-XXX
**Дата:** YYYY-MM-DD

## Контекст

<Почему это решение вообще нужно принимать?>

## Рассмотренные варианты

1. **Вариант A** — <описание>. Плюсы: ... Минусы: ...
2. **Вариант B** — <описание>. Плюсы: ... Минусы: ...

## Принятое решение

**Выбран вариант X** по следующим причинам: ...

## Последствия

- Позитивные: ...
- Негативные / компромиссы: ...
```

**Обязательные ADR для данного стека:**

- `ADR-001`: Выбор ConnectRPC vs REST vs GraphQL
- `ADR-002`: Стратегия хранения токенов (in-memory vs cookie vs localStorage)
- `ADR-003`: Монорепозиторий NX vs polyrepo
- `ADR-004`: Стратегия миграций БД (prisma migrate vs Flyway vs ручные)
- `ADR-005`: Стратегия реалтайм-обновлений (polling vs WebSocket vs SSE)
- `ADR-006`: Стратегия авторизации (RBAC vs ABAC)

---

**DoD фазы E:**

- [ ] Все `.proto`-файлы написаны, `buf lint` проходит без ошибок
- [ ] `buf generate` генерирует TypeScript без ошибок
- [ ] `libs/shared/api-contracts/src/index.ts` экспортирует все сервисы и типы
- [ ] `docs/sitemap.md` — все маршруты определены
- [ ] `pnpm nx graph` — нет нарушений module-boundary
- [ ] Минимум 6 ADR написаны и согласованы

---

---

# ФАЗА 0 — Инфраструктура и DevOps

> **Инструкция агенту:** Инфраструктура настраивается один раз до начала разработки
> и не меняется в процессе. Каждый пункт — конкретная команда или файл.
> Не переходить к фазе 1 пока `docker-compose up` + `pnpm nx serve web` не работают
> без ошибок.

---

## Этап 0.1 — Локальная среда разработки

### 0.1.1 — Docker Compose

```yaml
# docker-compose.yaml — полная структура
services:
  postgres:
    image: postgres:16-alpine
    container_name: <project>-postgres
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASS}
    ports: ['${DB_PORT}:5432']
    volumes: [<project>_data:/var/lib/postgresql/data]
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB']
      interval: 10s
      retries: 5
    restart: always

  pgadmin:
    image: dpage/pgadmin4
    profiles: [tools] # запускается только с --profile tools
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@local.dev
      PGADMIN_DEFAULT_PASSWORD: admin
    ports: ['5050:80']
    depends_on:
      postgres: { condition: service_healthy }

  api:
    build: { context: ., dockerfile: apps/api/Dockerfile, target: dev }
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASS}@postgres:5432/${DB_NAME}
      NODE_ENV: development
    volumes: ['.:/app', '/app/node_modules'] # hot reload
    ports: ['3000:3000']
    depends_on:
      postgres: { condition: service_healthy }
    command: pnpm nx serve api

volumes:
  <project>_data:
```

**Инструкция агенту — создать файлы:**

- [ ] `apps/api/Dockerfile` — multi-stage (target: dev с nodemon, target: prod без devDeps)
- [ ] `apps/web/Dockerfile` — nginx:alpine + `try_files $uri /index.html`
- [ ] `.dockerignore`: `node_modules`, `.git`, `dist`, `tmp`, `.nx`, `*.log`
- [ ] `.env.example` — шаблон переменных с комментариями к каждой

```bash
# .env.example
DB_NAME=<project>_db       # имя базы данных
DB_USER=postgres            # пользователь PostgreSQL
DB_PASS=changeme            # пароль (менять в prod!)
DB_PORT=5432                # порт PostgreSQL на хосте

JWT_ACCESS_SECRET=          # 64 байта hex: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_ACCESS_TTL=900          # время жизни access token в секундах (15 мин)
JWT_REFRESH_SECRET=         # другой 64-байтовый секрет
JWT_REFRESH_TTL=604800      # время жизни refresh token в секундах (7 дней)

NODE_ENV=development
PORT=3000

# Заполнить после выбора провайдеров (фаза 10):
# PAYMENT_SECRET_KEY=
# PAYMENT_WEBHOOK_SECRET=
# SMTP_HOST=
# SMTP_PORT=
# SMTP_USER=
# SMTP_PASS=
# REDIS_URL=
# SENTRY_DSN_API=
# SENTRY_DSN_WEB=
```

### 0.1.2 — Database bootstrapping

```bash
# Обязательная последовательность при первом запуске
cp .env.example .env          # заполнить значения
docker-compose up -d postgres # поднять только БД
npx prisma migrate dev --name init
npx prisma generate
pnpm db:seed
```

**Инструкция агенту — реализовать `libs/api/shared/prisma/seed.ts`:**

```typescript
import { PrismaClient } from './generated/prisma';
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    // Паттерн: upsert по уникальному полю → идемпотентность
    const admin = await tx.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: { email: 'admin@example.com', role: 'ADMIN' /* ... */ },
    });
    // Повторить для каждой роли
    // Создать связанные записи в разных статусах
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 0.1.3 — ConfigModule (NestJS)

```typescript
// apps/api/src/app/app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    // ... остальные модули
  ],
})
export class AppModule {}
```

```typescript
// Использование в сервисах:
constructor(private config: ConfigService) {}
const secret = this.config.get<string>('JWT_ACCESS_SECRET');
// Никогда не использовать process.env напрямую вне main.ts
```

---

## Этап 0.2 — CI/CD Pipeline (GitHub Actions)

### 0.2.1 — Workflow: CI (`ci.yml`)

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }

      - uses: pnpm/action-setup@v3
        with: { version: 9 }

      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }

      - name: Cache NX
        uses: actions/cache@v4
        with:
          path: .nx/cache
          key: nx-${{ hashFiles('nx.json', 'pnpm-lock.yaml') }}

      - run: pnpm install --frozen-lockfile

      - run: pnpm nx affected --target=lint     --base=origin/main --head=HEAD
      - run: pnpm nx affected --target=test     --base=origin/main --head=HEAD --ci --coverage
      - run: pnpm nx affected --target=build    --base=origin/main --head=HEAD
```

### 0.2.2 — Workflow: Deploy (`deploy.yml`)

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & push Docker image
        run: |
          docker build -t ${{ secrets.DOCKER_REGISTRY }}/api:${{ github.sha }} \
            -f apps/api/Dockerfile --target prod .
          docker push ${{ secrets.DOCKER_REGISTRY }}/api:${{ github.sha }}
      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.DEPLOY_HOST }}
          key: ${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            docker pull ${{ secrets.DOCKER_REGISTRY }}/api:${{ github.sha }}
            docker-compose up -d api

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - run: pnpm install --frozen-lockfile
      - run: pnpm nx build web --prod
      - run: npx netlify-cli deploy --prod --dir=dist/apps/web/browser
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

### 0.2.3 — Code Quality Gates

```bash
# Установить commitlint
pnpm add -D @commitlint/cli @commitlint/config-conventional

# commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };

# .husky/commit-msg
npx --no -- commitlint --edit $1
```

```json
// .lintstagedrc.cjs — проверить актуальность
{
  "*.ts": ["eslint --fix", "prettier --write"],
  "*.scss": ["stylelint --fix"],
  "*.html": ["prettier --write"]
}
```

**Branching strategy:**

```
main     — production (защищена, только через PR + CI green)
develop  — staging
feature/<issue-number>-<short-description>  → PR в develop
hotfix/<description>                        → PR в main + backmerge в develop
```

---

## Этап 0.3 — NestJS: регистрация модулей

**Инструкция агенту — создать `apps/api/src/app/connect-router.registry.ts`:**

```typescript
// connect-router.registry.ts
import { createRouter } from '@connectrpc/connect';
// Импортировать все RpcService-ы по мере реализации:
// import { AuthRpcService } from '@internal/auth';

export function buildConnectRouter() {
  return createRouter();
  // .service(AuthService, new AuthRpcService())
  // .service(UserService, new UserRpcService())
}
```

```typescript
// main.ts — подключение ConnectRPC
import { connectNodeAdapter } from '@connectrpc/connect-node';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ConnectRPC router
  const router = buildConnectRouter();
  app.use('/rpc', connectNodeAdapter({ routes: router }));

  // REST health endpoint
  app.use('/health', (_, res) => res.json({ status: 'ok' }));

  await app.listen(process.env.PORT ?? 3000);
}
```

---

**DoD фазы 0:**

- [ ] `docker-compose up` запускается без ошибок
- [ ] `pnpm nx serve api` — API стартует, `/health` возвращает 200
- [ ] `pnpm nx serve web` — Angular запускается без ошибок
- [ ] `prisma migrate dev` — проходит без ошибок
- [ ] `pnpm db:seed` — проходит без ошибок (повторный запуск тоже)
- [ ] CI workflow проходит на тестовом PR
- [ ] `.env.example` содержит все переменные

---

---

# ФАЗА 1 — Аутентификация и транспортный слой

> **Инструкция агенту:** Auth — критическая блокирующая фаза. Без работающего
> Auth нельзя разрабатывать ни один кабинет. Реализовать полный цикл:
> register → login → access token → refresh → logout. Затем — RPC-транспорт
> на фронтенде с автоматическим обновлением токена.

---

## Этап 1.1 — Backend: AuthModule

### 1.1.1 — PasswordService

```typescript
// libs/api/auth/src/lib/auth/password.service.ts
import * as bcrypt from 'bcryptjs';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 12;

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.SALT_ROUNDS);
  }

  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed); // timing-safe внутри bcrypt
  }
}
```

### 1.1.2 — TokenService

```typescript
// libs/api/auth/src/lib/auth/token.service.ts
// Алгоритм: HS256 через Node.js crypto — без внешних JWT-библиотек

@Injectable()
export class TokenService {
  constructor(private config: ConfigService) {}

  signAccess(payload: JwtPayload): string {
    // header.payload.signature — base64url-кодирование
    const header = base64url({ alg: 'HS256', typ: 'JWT' });
    const body = base64url({ ...payload, iat: now(), exp: now() + this.accessTtl });
    const sig = hmacSha256(`${header}.${body}`, this.accessSecret);
    return `${header}.${body}.${sig}`;
  }

  verifyAccess(token: string): JwtPayload {
    // 1. Разобрать на части
    // 2. Проверить подпись (timingSafeEqual)
    // 3. Проверить exp > now()
    // 4. Вернуть payload или throw ConnectError(UNAUTHENTICATED)
  }

  generateRefreshToken(): string {
    return crypto.randomBytes(48).toString('hex'); // opaque, не JWT
  }

  hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private get accessSecret() {
    return this.config.get<string>('JWT_ACCESS_SECRET')!;
  }
  private get accessTtl() {
    return Number(this.config.get('JWT_ACCESS_TTL', 900));
  }
}
```

### 1.1.3 — RefreshToken: Prisma schema + Repository

```prisma
// Добавить в schema.prisma:
model RefreshToken {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash") @db.VarChar(64)
  expiresAt DateTime  @map("expires_at") @db.Timestamp()
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp()
  revokedAt DateTime? @map("revoked_at") @db.Timestamp()
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("refresh_tokens")
  @@index([userId])
}
```

```typescript
// libs/api/auth/src/lib/auth/refresh-token.repository.ts
@Injectable()
export class RefreshTokenRepository {
  constructor(private prisma: PrismaService) {}

  create(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findValid(tokenHash: string) {
    return this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  revoke(id: string) {
    return this.prisma.refreshToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }

  revokeAllForUser(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
```

### 1.1.4 — AuthService: бизнес-логика

```typescript
// libs/api/auth/src/lib/auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private users: UserRepository,
    private tokens: RefreshTokenRepository,
    private password: PasswordService,
    private jwt: TokenService,
    private config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    // 1. Проверить уникальность email
    const exists = await this.users.findByEmail(dto.email);
    if (exists) throw new ConnectError('Email already registered', Code.AlreadyExists);

    // 2. Хешировать пароль
    const hash = await this.password.hash(dto.password);

    // 3. Создать пользователя
    const user = await this.users.create({ ...dto, passwordHash: hash });

    // 4. Выдать токены
    return this.issueTokens(user);
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    // 1. Найти пользователя
    const user = await this.users.findByEmail(dto.email);
    if (!user) throw new ConnectError('Invalid credentials', Code.Unauthenticated);

    // 2. Проверить пароль (timing-safe)
    const valid = await this.password.compare(dto.password, user.passwordHash);
    if (!valid) throw new ConnectError('Invalid credentials', Code.Unauthenticated);

    // 3. Выдать токены
    return this.issueTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    // 1. Найти валидный RT в БД
    const hash = this.jwt.hashToken(refreshToken);
    const stored = await this.tokens.findValid(hash);
    if (!stored) throw new ConnectError('Invalid refresh token', Code.Unauthenticated);

    // 2. Отозвать старый (rotation pattern — защита от replay)
    await this.tokens.revoke(stored.id);

    // 3. Получить пользователя и выдать новую пару
    const user = await this.users.findById(stored.userId);
    if (!user) throw new ConnectError('User not found', Code.NotFound);
    return this.issueTokens(user);
  }

  async logout(refreshToken: string): Promise<void> {
    const hash = this.jwt.hashToken(refreshToken);
    const stored = await this.tokens.findValid(hash);
    if (stored) await this.tokens.revoke(stored.id); // idempotent: не throws если не найден
  }

  private async issueTokens(user: User): Promise<AuthResult> {
    const accessToken = this.jwt.signAccess({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = this.jwt.generateRefreshToken();
    const hash = this.jwt.hashToken(refreshToken);
    const ttl = Number(this.config.get('JWT_REFRESH_TTL', 604800));
    const expiresAt = new Date(Date.now() + ttl * 1000);

    await this.tokens.create(user.id, hash, expiresAt);
    return { accessToken, refreshToken, user };
  }
}
```

### 1.1.5 — ConnectRPC Auth Interceptor

```typescript
// libs/api/auth/src/lib/auth/auth.interceptor.ts
import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  user: JwtPayload | null;
}
const contextStorage = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = () => contextStorage.getStore() ?? { user: null };
export const getCurrentUser = () => getRequestContext().user;

// Публичные методы — не требуют токена
const PUBLIC_METHODS = new Set([
  '<pkg>.AuthService/Register',
  '<pkg>.AuthService/Login',
  '<pkg>.AuthService/RefreshToken',
]);

export function createAuthInterceptor(tokenService: TokenService): Interceptor {
  return (next) => async (req) => {
    const methodKey = `${req.service.typeName}/${req.method.name}`;

    if (PUBLIC_METHODS.has(methodKey)) {
      return contextStorage.run({ user: null }, () => next(req));
    }

    const authHeader = req.header.get('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) throw new ConnectError('Missing authorization header', Code.Unauthenticated);

    const payload = tokenService.verifyAccess(token); // throws если невалидный
    return contextStorage.run({ user: payload }, () => next(req));
  };
}
```

### 1.1.6 — Guard-хелперы

```typescript
// libs/api/auth/src/lib/auth/guards.ts
// Чистые функции — вызываются в начале каждого service-метода

export function requireAuth(): JwtPayload {
  const user = getCurrentUser();
  if (!user) throw new ConnectError('Authentication required', Code.Unauthenticated);
  return user;
}

export function requireRole(...roles: UserRole[]): JwtPayload {
  const user = requireAuth();
  if (!roles.includes(user.role as UserRole))
    throw new ConnectError('Insufficient permissions', Code.PermissionDenied);
  return user;
}

export function requireSelfOrRole(resourceOwnerId: string, ...roles: UserRole[]): JwtPayload {
  const user = requireAuth();
  if (user.sub === resourceOwnerId) return user;
  if (roles.includes(user.role as UserRole)) return user;
  throw new ConnectError('Access denied', Code.PermissionDenied);
}
```

---

## Этап 1.2 — Frontend: TokenStore, Transport, Guards

_(Содержимое без изменений относительно предыдущей версии плана — см. версию 2.0)_

### 1.2.1 — TokenStore

### 1.2.2 — RPC Transport с interceptor

### 1.2.3 — AuthService

### 1.2.4 — Route Guards (authGuard, roleGuard)

### 1.2.5 — Auth-страницы (Login, Register, ForgotPassword, ResetPassword)

### 1.2.6 — Silent refresh в APP_INITIALIZER

---

**DoD фазы 1:**

- [ ] `POST /rpc/<pkg>.AuthService/Register` — возвращает accessToken + refreshToken
- [ ] `POST /rpc/<pkg>.AuthService/Login` — корректная проверка пароля
- [ ] `POST /rpc/<pkg>.AuthService/RefreshToken` — rotation: старый RT отзывается
- [ ] `POST /rpc/<pkg>.AuthService/Logout` — RT отзывается, повторный logout не throws
- [ ] Запрос к защищённому методу без токена → `Code.Unauthenticated`
- [ ] Запрос с токеном неверной роли → `Code.PermissionDenied`
- [ ] Frontend: закрытый маршрут без токена → redirect на `/auth`
- [ ] Frontend: silent refresh при наличии RT в sessionStorage

---

---

# ФАЗА 3 — Бизнес-логика: доменные модули

> **Инструкция агенту:** Это самая трудоёмкая фаза. Каждый доменный модуль
> реализуется по единому паттерну: Repository → Service → RpcService → Module.
> Порядок разработки внутри модуля строго соблюдать. Не писать бизнес-логику
> в Repository и не писать Prisma-запросы в Service.

---

## Этап 3.0 — Паттерн доменного модуля (обязательно прочитать перед реализацией)

### Разделение ответственности

```
Repository   — ТОЛЬКО Prisma-запросы + маппинг Prisma-типов в Proto-типы.
               Не содержит: валидаций, бизнес-правил, вызовов других сервисов.

Service      — ТОЛЬКО бизнес-логика: валидации, правила, оркестрация.
               Не содержит: Prisma-запросов, HTTP/RPC-деталей.
               Вызывает: Repository, другие Service-ы (через DI), внешние сервисы.

RpcService   — ТОЛЬКО приём RPC-запроса → вызов Service → возврат RPC-ответа.
               Не содержит: бизнес-логики, Prisma-запросов.
               Обрабатывает: маппинг Proto-запроса → DTO → Service → Proto-ответ.

Module       — @Module: объявляет providers, imports, exports.
               Правило: Repository и Service в providers.
               RpcService в exports (регистрируется в connect-router.registry.ts).
```

### Структура файлов

```
libs/api/<domain>/src/lib/<domain>/
├── <domain>.repository.ts        # Prisma layer
├── <domain>.repository.spec.ts   # тесты репозитория (опц., с test-containers)
├── <domain>.service.ts           # бизнес-логика
├── <domain>.service.spec.ts      # unit-тесты сервиса (обязательно)
├── <domain>-rpc.service.ts       # ConnectRPC handler
├── <domain>.module.ts            # @Module
└── dto/
    ├── create-<domain>.dto.ts    # входные данные операции Create
    ├── update-<domain>.dto.ts    # входные данные операции Update
    └── <domain>-filters.dto.ts   # параметры фильтрации для List
libs/api/<domain>/src/index.ts    # экспортировать только Module и RpcService
```

---

## Этап 3.1 — Repository: паттерн и примеры

**Инструкция агенту:**

1. Repository работает только с `PrismaService`.
2. Все методы возвращают Prisma-типы ИЛИ сразу Proto-типы через `toProto*` функции.
3. Маппинг Proto — только здесь, в одном месте.
4. Pagination: принимает `{ page: number, pageSize: number }`, возвращает `{ items, total }`.

```typescript
// libs/api/<domain>/src/lib/<domain>/<domain>.repository.ts
@Injectable()
export class <Domain>Repository {
  constructor(private prisma: PrismaService) {}

  // CREATE
  async create(data: Create<Domain>Dto): Promise<Proto<Domain>> {
    const record = await this.prisma.<domain>.create({ data: this.toCreateInput(data) });
    return this.toProto(record);
  }

  // READ ONE
  async findById(id: string): Promise<Proto<Domain> | null> {
    const record = await this.prisma.<domain>.findUnique({ where: { id } });
    return record ? this.toProto(record) : null;
  }

  // READ MANY (pagination + filters)
  async findMany(filters: <Domain>FiltersDto): Promise<{ items: Proto<Domain>[]; total: number }> {
    const { page, pageSize, search, status } = filters;
    const skip  = (page - 1) * pageSize;
    const where = this.buildWhere(filters);

    const [records, total] = await this.prisma.$transaction([
      this.prisma.<domain>.findMany({
        where,
        skip,
        take:    pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.<domain>.count({ where }),
    ]);

    return { items: records.map(r => this.toProto(r)), total };
  }

  // UPDATE
  async update(id: string, data: Update<Domain>Dto): Promise<Proto<Domain>> {
    const record = await this.prisma.<domain>.update({
      where: { id },
      data:  this.toUpdateInput(data),
    });
    return this.toProto(record);
  }

  // DELETE (soft delete через deletedAt или hard delete)
  async delete(id: string): Promise<void> {
    await this.prisma.<domain>.delete({ where: { id } });
  }

  // PRIVATE: Prisma → Proto маппинг
  private toProto(record: Prisma<Domain>): Proto<Domain> {
    return create(<Domain>Schema, {
      id:        record.id,
      // ... остальные поля
      status:    this.mapStatus(record.status),
      createdAt: timestampFromDate(record.createdAt),
    });
  }

  // PRIVATE: строим where-условие из фильтров
  private buildWhere(filters: <Domain>FiltersDto): Prisma.<Domain>WhereInput {
    const where: Prisma.<Domain>WhereInput = {};
    if (filters.search)  where.name = { contains: filters.search, mode: 'insensitive' };
    if (filters.status)  where.status = filters.status;
    if (filters.userId)  where.userId = filters.userId;
    return where;
  }

  // PRIVATE: маппинг enum Prisma → Proto
  private mapStatus(s: Prisma<Domain>Status): Proto<Domain>Status {
    const map: Record<Prisma<Domain>Status, Proto<Domain>Status> = {
      DRAFT:     Proto<Domain>Status.<DOMAIN>_STATUS_DRAFT,
      ACTIVE:    Proto<Domain>Status.<DOMAIN>_STATUS_ACTIVE,
      COMPLETED: Proto<Domain>Status.<DOMAIN>_STATUS_COMPLETED,
    };
    return map[s] ?? Proto<Domain>Status.<DOMAIN>_STATUS_UNSPECIFIED;
  }
}
```

---

## Этап 3.2 — Service: паттерн и правила бизнес-логики

**Инструкция агенту:**

1. Service получает DTO (не Proto, не Prisma), возвращает Proto (для RpcService) или void.
2. Все бизнес-правила из `docs/business-rules.md` реализуются здесь.
3. Используй guard-хелперы (`requireAuth`, `requireRole`) в начале каждого метода.
4. Атомарные операции (несколько write в разных таблицах) — через `prisma.$transaction`.
5. Побочные эффекты (email, уведомление, аудит) — через отдельные сервисы, после основной операции.

```typescript
// libs/api/<domain>/src/lib/<domain>/<domain>.service.ts
@Injectable()
export class <Domain>Service {
  constructor(
    private repo:          <Domain>Repository,
    // private otherService: OtherService,       // зависимость на другой сервис через DI
    // private eventEmitter: EventEmitter2,       // для побочных эффектов (email, audit)
  ) {}

  // ─── CREATE ────────────────────────────────────────────────────────────────

  async create(dto: Create<Domain>Dto): Promise<Proto<Domain>> {
    // 1. Авторизация
    const actor = requireRole(UserRole.ROLE_A, UserRole.ROLE_B);

    // 2. Бизнес-валидации (BR-XXX из business-rules.md)
    await this.validateCreate(dto, actor);

    // 3. Создание
    const entity = await this.repo.create({ ...dto, ownerId: actor.sub });

    // 4. Побочные эффекты (fire-and-forget — не блокируют ответ)
    // this.eventEmitter.emit('<domain>.created', { entity, actor });

    return entity;
  }

  // ─── READ ──────────────────────────────────────────────────────────────────

  async getById(id: string): Promise<Proto<Domain>> {
    requireAuth();
    const entity = await this.repo.findById(id);
    if (!entity) throw new ConnectError('Not found', Code.NotFound);
    // Если нужна проверка владельца:
    // requireSelfOrRole(entity.ownerId, UserRole.ROLE_ADMIN);
    return entity;
  }

  async list(filters: <Domain>FiltersDto): Promise<{ items: Proto<Domain>[]; total: number }> {
    const actor = requireAuth();
    // Ограничение по роли: обычный пользователь видит только своё
    if (actor.role === UserRole.ROLE_A) filters.userId = actor.sub;
    return this.repo.findMany(filters);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────────

  async update(id: string, dto: Update<Domain>Dto): Promise<Proto<Domain>> {
    const actor = requireAuth();

    // Получить текущее состояние
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConnectError('Not found', Code.NotFound);

    // Проверить права на редактирование
    requireSelfOrRole(existing.ownerId, UserRole.ROLE_ADMIN);

    // Валидация перехода статуса (State Machine)
    if (dto.status) this.validateStatusTransition(existing.status, dto.status);

    return this.repo.update(id, dto);
  }

  // ─── DELETE ────────────────────────────────────────────────────────────────

  async delete(id: string): Promise<void> {
    requireRole(UserRole.ROLE_ADMIN);
    const existing = await this.repo.findById(id);
    if (!existing) throw new ConnectError('Not found', Code.NotFound);
    // Проверить, можно ли удалять (бизнес-правило)
    if (existing.status === '<DOMAIN>_STATUS_ACTIVE')
      throw new ConnectError('Cannot delete active entity', Code.FailedPrecondition);
    await this.repo.delete(id);
  }

  // ─── STATE MACHINE ─────────────────────────────────────────────────────────

  // Допустимые переходы статусов — определяются из business-rules.md
  private readonly ALLOWED_TRANSITIONS: Record<Proto<Domain>Status, Proto<Domain>Status[]> = {
    [Proto<Domain>Status.<DOMAIN>_STATUS_DRAFT]:     [Proto<Domain>Status.<DOMAIN>_STATUS_ACTIVE],
    [Proto<Domain>Status.<DOMAIN>_STATUS_ACTIVE]:    [Proto<Domain>Status.<DOMAIN>_STATUS_COMPLETED,
                                                      Proto<Domain>Status.<DOMAIN>_STATUS_CANCELLED],
    [Proto<Domain>Status.<DOMAIN>_STATUS_COMPLETED]: [], // терминальный
    [Proto<Domain>Status.<DOMAIN>_STATUS_CANCELLED]: [], // терминальный
    [Proto<Domain>Status.<DOMAIN>_STATUS_UNSPECIFIED]: [],
  };

  private validateStatusTransition(from: Proto<Domain>Status, to: Proto<Domain>Status): void {
    const allowed = this.ALLOWED_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to))
      throw new ConnectError(
        `Status transition ${from} → ${to} is not allowed`,
        Code.FailedPrecondition,
      );
  }

  // ─── PRIVATE VALIDATIONS ───────────────────────────────────────────────────

  private async validateCreate(dto: Create<Domain>Dto, actor: JwtPayload): Promise<void> {
    // BR-001: <описание из business-rules.md>
    // if (condition) throw new ConnectError('...', Code.InvalidArgument);

    // BR-002: проверка уникальности
    // const dup = await this.repo.findByUnique(dto.uniqueField);
    // if (dup) throw new ConnectError('Already exists', Code.AlreadyExists);
  }
}
```

---

## Этап 3.3 — RpcService: паттерн

**Инструкция агенту:**

1. RpcService — тонкий слой. Только маппинг Proto ↔ DTO и делегирование в Service.
2. Не добавлять бизнес-логику в RpcService.
3. Все методы — `async`, возвращают Proto-response напрямую.

```typescript
// libs/api/<domain>/src/lib/<domain>/<domain>-rpc.service.ts
@Injectable()
export class <Domain>RpcService implements ServiceImpl<typeof <Domain>Service> {
  constructor(private service: <Domain>Service) {}

  async create<Domain>(
    req:  Create<Domain>Request,
    _ctx: HandlerContext,
  ): Promise<Create<Domain>Response> {
    const entity = await this.service.create(this.toCreateDto(req));
    return create(Create<Domain>ResponseSchema, { entity });
  }

  async get<Domain>(
    req:  Get<Domain>Request,
    _ctx: HandlerContext,
  ): Promise<Get<Domain>Response> {
    const entity = await this.service.getById(req.id);
    return create(Get<Domain>ResponseSchema, { entity });
  }

  async list<Domain>s(
    req:  List<Domain>sRequest,
    _ctx: HandlerContext,
  ): Promise<List<Domain>sResponse> {
    const { items, total } = await this.service.list(this.toFiltersDto(req));
    return create(List<Domain>sResponseSchema, { entities: items, total });
  }

  async update<Domain>(
    req:  Update<Domain>Request,
    _ctx: HandlerContext,
  ): Promise<Update<Domain>Response> {
    const entity = await this.service.update(req.id, this.toUpdateDto(req));
    return create(Update<Domain>ResponseSchema, { entity });
  }

  async delete<Domain>(
    req:  Delete<Domain>Request,
    _ctx: HandlerContext,
  ): Promise<Delete<Domain>Response> {
    await this.service.delete(req.id);
    return create(Delete<Domain>ResponseSchema, {});
  }

  // Proto Request → DTO маппинг
  private toCreateDto(req: Create<Domain>Request): Create<Domain>Dto { /* ... */ }
  private toUpdateDto(req: Update<Domain>Request): Update<Domain>Dto { /* ... */ }
  private toFiltersDto(req: List<Domain>sRequest): <Domain>FiltersDto {
    return {
      page:     req.page     || 1,
      pageSize: req.pageSize || 25,
      search:   req.search   || undefined,
    };
  }
}
```

---

## Этап 3.4 — Module

```typescript
// libs/api/<domain>/src/lib/<domain>/<domain>.module.ts
@Module({
  imports:   [PrismaModule],
  providers: [<Domain>Repository, <Domain>Service, <Domain>RpcService],
  exports:   [<Domain>RpcService],  // только RpcService — для регистрации в router
})
export class <Domain>Module {}
```

```typescript
// libs/api/<domain>/src/index.ts
export { <Domain>Module }    from './lib/<domain>/<domain>.module';
export { <Domain>RpcService } from './lib/<domain>/<domain>-rpc.service';
// НЕ экспортировать Repository и Service — internal implementation details
```

```typescript
// Зарегистрировать в connect-router.registry.ts:
import { <Domain>RpcService } from '@internal/<domain>';
// ...
router.service(<Domain>Proto_Service, app.get(<Domain>RpcService));
```

---

## Этап 3.5 — Unit-тесты Service (обязательно для каждого модуля)

```typescript
// libs/api/<domain>/src/lib/<domain>/<domain>.service.spec.ts
import { Test }        from '@nestjs/testing';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('<Domain>Service', () => {
  let service: <Domain>Service;
  let repo:    DeepMockProxy<<Domain>Repository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        <Domain>Service,
        { provide: <Domain>Repository, useValue: mockDeep<<Domain>Repository>() },
      ],
    }).compile();

    service = module.get(<Domain>Service);
    repo    = module.get(<Domain>Repository);
  });

  // ─── CREATE ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('should create entity when actor has required role', async () => {
      // Arrange
      setRequestContext({ user: mockUser(UserRole.ROLE_A) });
      repo.create.mockResolvedValue(mockProtoEntity());

      // Act
      const result = await service.create(mockCreateDto());

      // Assert
      expect(result.id).toBeTruthy();
      expect(repo.create).toHaveBeenCalledTimes(1);
    });

    it('should throw PERMISSION_DENIED when actor has wrong role', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_B) });
      await expect(service.create(mockCreateDto()))
        .rejects.toMatchObject({ code: Code.PermissionDenied });
    });

    it('should throw ALREADY_EXISTS when duplicate found (BR-002)', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_A) });
      repo.findByUnique.mockResolvedValue(mockProtoEntity()); // уже существует
      await expect(service.create(mockCreateDto()))
        .rejects.toMatchObject({ code: Code.AlreadyExists });
    });
  });

  // ─── UPDATE / STATE MACHINE ────────────────────────────────────────────────

  describe('update — status transitions', () => {
    it('should allow DRAFT → ACTIVE transition', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_A) });
      repo.findById.mockResolvedValue(mockProtoEntity({ status: Status.DRAFT }));
      repo.update.mockResolvedValue(mockProtoEntity({ status: Status.ACTIVE }));

      const result = await service.update('id-1', { status: Status.ACTIVE });
      expect(result.status).toBe(Status.ACTIVE);
    });

    it('should throw FAILED_PRECONDITION for invalid transition COMPLETED → ACTIVE', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_A) });
      repo.findById.mockResolvedValue(mockProtoEntity({ status: Status.COMPLETED }));

      await expect(service.update('id-1', { status: Status.ACTIVE }))
        .rejects.toMatchObject({ code: Code.FailedPrecondition });
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────────────

  describe('delete', () => {
    it('should delete when entity is in DRAFT status', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_ADMIN) });
      repo.findById.mockResolvedValue(mockProtoEntity({ status: Status.DRAFT }));
      await service.delete('id-1');
      expect(repo.delete).toHaveBeenCalledWith('id-1');
    });

    it('should throw FAILED_PRECONDITION when deleting ACTIVE entity', async () => {
      setRequestContext({ user: mockUser(UserRole.ROLE_ADMIN) });
      repo.findById.mockResolvedValue(mockProtoEntity({ status: Status.ACTIVE }));
      await expect(service.delete('id-1'))
        .rejects.toMatchObject({ code: Code.FailedPrecondition });
    });
  });
});
```

---

## Этап 3.6 — Чеклист реализации каждого модуля

**Инструкция агенту: перед отметкой модуля как «готов» пройти весь список:**

```
Модуль: <DomainName>

Repository:
  [ ] create — принимает DTO, возвращает Proto
  [ ] findById — возвращает Proto | null
  [ ] findMany — принимает filters с page/pageSize, возвращает { items, total }
  [ ] update — принимает id + DTO, возвращает Proto
  [ ] delete — принимает id, возвращает void
  [ ] buildWhere — все фильтры обрабатываются
  [ ] toProto — все поля маппируются, enum преобразуются явно
  [ ] @@index добавлен в schema для всех фильтруемых полей

Service:
  [ ] requireAuth / requireRole вызывается в начале каждого метода
  [ ] Все бизнес-правила из business-rules.md реализованы
  [ ] State machine: ALLOWED_TRANSITIONS определён и проверяется
  [ ] Атомарные операции обёрнуты в prisma.$transaction
  [ ] ConnectError используется с правильными Code (NotFound, AlreadyExists, etc.)
  [ ] Побочные эффекты вызываются после основной операции

RpcService:
  [ ] Каждый proto-метод сервиса реализован
  [ ] Нет бизнес-логики — только маппинг и делегирование
  [ ] toCreateDto / toUpdateDto / toFiltersDto реализованы

Module:
  [ ] @Module объявлен корректно
  [ ] RpcService экспортируется
  [ ] Зарегистрирован в connect-router.registry.ts

Тесты:
  [ ] service.spec.ts существует
  [ ] Покрыты: create (success + forbidden + duplicate)
  [ ] Покрыты: getById (success + not found)
  [ ] Покрыты: list (с фильтром по роли)
  [ ] Покрыты: update (success + not found + forbidden + все invalid transitions)
  [ ] Покрыты: delete (success + forbidden + FailedPrecondition)
  [ ] jest --coverage: branches ≥ 60%

Proto:
  [ ] buf lint проходит без предупреждений
  [ ] Все методы имеют уникальные Request/Response
  [ ] Enum имеет UNSPECIFIED = 0
```

---

**DoD фазы 3:**

- [ ] Все доменные модули из `docs/FR.md` реализованы
- [ ] Каждый модуль прошёл чеклист 3.6
- [ ] `pnpm nx test --all` — все тесты зелёные
- [ ] `pnpm nx build api` — сборка без ошибок TypeScript
- [ ] `buf lint` — без предупреждений

---

---

# ФАЗА 4 — Frontend: ролевые кабинеты

> **Инструкция агенту:** Фаза 2 (Design System) должна быть завершена.
> Фаза 3 (Backend) должна быть завершена хотя бы для тех модулей,
> которые нужны текущему кабинету. Паттерны Feature-модуля, ApiService,
> компонент с Signals — строго соблюдать.

_(Содержимое паттернов Feature-модуля, ApiService, компонента с Signals,
Dashboard, List+Detail, Wizard, Detail с вкладками — без изменений
относительно версии 2.0 плана)_

---

---

# ФАЗА 2 — Shared UI-библиотека и Design System

_(Без изменений относительно версии 2.0 — этапы 2.1–2.8)_

---

---

# ФАЗЫ 5–10

_(Содержимое без изменений: Платёжный модуль, Реалтайм и коммуникации,
Публичная часть, Тестирование, Деплой, Внешние интеграции)_

---

---

# 📐 Технические стандарты и соглашения

_(Без изменений относительно версии 2.0)_

---

---

# 🤖 Инструкции агенту: общие правила работы

> Этот раздел читать перед началом каждой фазы.

## Правила работы с кодом

```
1. Перед написанием любого файла — прочитать соответствующий раздел плана.

2. Перед реализацией модуля — открыть docs/business-rules.md и убедиться,
   что все BR для этого модуля отражены в Service.

3. Перед написанием proto-метода — открыть docs/FR.md и найти ФТ,
   которое этот метод реализует.

4. После реализации модуля — пройти чеклист 3.6 полностью.

5. Никогда не коммитить код с failing тестами.

6. При обнаружении противоречия между планом и бизнес-правилами —
   остановиться и уточнить у заказчика, затем обновить docs/.

7. Именование: строго по конвенциям раздела «Соглашения».
   При сомнении — смотреть глоссарий (docs/glossary.md).
```

## Порядок выполнения задачи агентом

```
Шаг 1: Прочитать задачу и определить к какой фазе/этапу она относится.
Шаг 2: Открыть соответствующий раздел плана.
Шаг 3: Открыть связанные docs/ файлы (FR, business-rules, entities, glossary).
Шаг 4: Открыть существующий код аналогичного модуля (если есть) как образец.
Шаг 5: Реализовать согласно паттернам плана.
Шаг 6: Написать тесты (service.spec.ts обязателен).
Шаг 7: Запустить тесты: pnpm nx test <lib-name>.
Шаг 8: Запустить lint: pnpm nx lint <lib-name>.
Шаг 9: Пройти чеклист DoD соответствующей фазы.
Шаг 10: Зафиксировать в git с conventional commit: feat(<scope>): <description>
```

## Конвенции коммитов

```
feat(<scope>):     новый функционал
fix(<scope>):      исправление бага
refactor(<scope>): рефакторинг без изменения поведения
test(<scope>):     добавление / исправление тестов
docs(<scope>):     изменение документации
chore(<scope>):    изменение конфигурации, зависимостей

Примеры:
feat(auth): add refresh token rotation
fix(user): handle empty display name in toProto mapper
test(assessment): add status transition edge cases
docs(plan): update phase 3 checklist
```

## Обработка ошибок ConnectRPC

```typescript
// Использовать правильные Code для каждого типа ошибки:
Code.NotFound; // сущность не найдена по ID
Code.AlreadyExists; // дублирование уникального поля
Code.InvalidArgument; // невалидные входные данные (формат, диапазон)
Code.FailedPrecondition; // нарушение бизнес-правила (неверный статус, недостаточно средств)
Code.PermissionDenied; // нет прав на операцию
Code.Unauthenticated; // нет или неверный токен
Code.Internal; // непредвиденная внутренняя ошибка (логировать!)
Code.Unavailable; // внешний сервис недоступен
```

---

# 🚨 Технический долг и риски

| Проблема                                                                                         | Приоритет      | Решение                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------- | ------------------------------------------------------------------------------- |
| Refresh token в `sessionStorage` — XSS-уязвим                                                    | 🔴 Критический | BFF-прокси с `httpOnly`-cookie или SSR + cookie-proxy                           |
| Нет rate-limiting на Auth endpoints                                                              | 🔴 Критический | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` из `@nestjs/throttler`   |
| ReportService, SaleService, NotificationService, PromoService, AuditLogService не экспортированы | 🔴 Критический | Добавить экспорт в `api-contracts/index.ts` + зарегистрировать в connect-router |
| SupportService и KnowledgeService: proto не написан, backend не реализован                       | 🔴 Критический | Написать proto → реализовать libs/api/support/ и libs/api/knowledge/            |
| Auth: нет методов ForgotPassword, ResetPassword, VerifyEmail, OAuthLogin                         | 🔴 Критический | Расширить auth.proto + AuthService + auth-страницы                              |
| `moduleResolution: "node"` в `tsconfig.base.json` — устаревшее                                   | 🟡 Средний     | Мигрировать на `"bundler"` (Angular 17+)                                        |
| Нет `Content-Security-Policy` header                                                             | 🟡 Средний     | Nginx: `add_header Content-Security-Policy "default-src 'self'"`                |
| `prisma.$transaction` не используется в сложных write-операциях                                  | 🟡 Средний     | Обернуть все create+update пары                                                 |
| Нет E2E-тестов                                                                                   | 🟢 Низкий      | Playwright в Фазе 8.4                                                           |
| `docker-compose.yaml` не содержит сервис `api`                                                   | 🟡 Средний     | Добавить в Этапе 0.1.1                                                          |

---

---

# ФАЗА 3-ДОМЕННЫЕ МОДУЛИ — Реестр реализации (привязка к US)

> **Инструкция агенту:** Этот раздел — обязательный контрольный список.
> Перед закрытием задачи по модулю — убедиться, что US из колонки «Закрывает» отмечены как реализованные.
> Порядок реализации: сначала 🔴, затем 🟡, затем 🟠.

| Модуль                            | lib path                     | Статус        | Закрывает US                          | Приоритет |
| --------------------------------- | ---------------------------- | ------------- | ------------------------------------- | --------- |
| AuthModule (base)                 | `libs/api/auth`              | ✅ Реализован | US-01 (частично), US-04               | —         |
| UserModule                        | `libs/api/user`              | ✅ Реализован | US-13 (частично)                      | —         |
| AssessmentModule                  | `libs/api/assessment`        | ✅ Реализован | US-03, US-04, US-16                   | —         |
| DocumentModule                    | `libs/api/document`          | ✅ Реализован | US-11                                 | —         |
| FormsModule                       | `libs/api/forms`             | ✅ Реализован | US-03, US-16                          | —         |
| PaymentModule                     | `libs/api/payment`           | ✅ Реализован | US-06 (частично), US-07 (частично)    | —         |
| **ReportModule**                  | `libs/api/report`            | ❌ Нужен      | **US-07, US-08, US-09, US-14, US-17** | 🔴        |
| **SaleModule**                    | `libs/api/sale`              | ❌ Нужен      | **US-10**                             | 🔴        |
| **SupportModule**                 | `libs/api/support`           | ❌ Нужен      | **US-15**                             | 🔴        |
| **Auth расширение**               | `libs/api/auth` (доп.)       | ❌ Нужен      | **US-01, US-02**                      | 🔴        |
| **NotificationModule**            | `libs/api/notification`      | ❌ Нужен      | **US-05**                             | 🟡        |
| **PromoModule**                   | `libs/api/promo`             | ❌ Нужен      | **US-13, US-06**                      | 🟡        |
| **AuditModule**                   | `libs/api/audit`             | ❌ Нужен      | **US-14**                             | 🟡        |
| **KnowledgeModule**               | `libs/api/knowledge`         | ❌ Нужен      | **/faq**                              | 🟡        |
| **DocumentModule (расш.)**        | `libs/api/document` (доп.)   | ❌ Нужен      | **US-14, /admin/files**               | 🟡        |
| **AssessmentModule (расш.)**      | `libs/api/assessment` (доп.) | ❌ Нужен      | **US-20, US-24**                      | 🟡        |
| **PaymentModule (расш.)**         | `libs/api/payment` (доп.)    | ❌ Нужен      | **/admin/subscriptions, US-06**       | 🟡        |
| **Новый экран /notary/analytics** | `libs/web/notary`            | ❌ Нужен      | **US-26**                             | 🟠        |
| **Новый экран /admin/settings**   | `libs/web/admin`             | ❌ Нужен      | **sitemap**                           | 🟠        |

---

---

# ФАЗА 3.A — ReportModule

> **Закрывает:** US-07, US-08, US-09, US-14, US-17
> **Блокирует:** frontend `/applicant/assessment/results`, `/notary/orders/:id` (кнопка «Подписать»)

## Этап 3.A.1 — Экспорт proto

```typescript
// libs/shared/api-contracts/src/index.ts — добавить:
export * from './gen/report/v1alpha1/report_pb';
export * from './gen/report/v1alpha1/report_connect';
```

После добавления: `pnpm nx run api-contracts:generate-proto && buf lint`

## Этап 3.A.2 — Prisma Schema

```prisma
model Report {
  id           String       @id @default(uuid()) @db.Uuid
  assessmentId String       @map("assessment_id") @db.Uuid
  notaryId     String       @map("notary_id") @db.Uuid
  status       ReportStatus @default(DRAFT)
  fileKey      String?      @map("file_key")       // путь в S3/MinIO
  signedAt     DateTime?    @map("signed_at") @db.Timestamp()
  createdAt    DateTime     @default(now()) @map("created_at") @db.Timestamp()
  updatedAt    DateTime     @updatedAt @map("updated_at") @db.Timestamp()
  assessment   Assessment   @relation(fields: [assessmentId], references: [id])
  notary       User         @relation("NotaryReports", fields: [notaryId], references: [id])

  @@map("reports")
  @@index([assessmentId])
  @@index([notaryId])
  @@index([status])
}

enum ReportStatus {
  DRAFT
  SIGNED
  DELIVERED
  REJECTED
}
```

## Этап 3.A.3 — Service: бизнес-логика

```typescript
// libs/api/report/src/lib/report/report.service.ts

async createReport(dto: CreateReportDto): Promise<ProtoReport> {
  const actor = requireRole(UserRole.NOTARY);

  // Проверить: заявка существует, статус IN_PROGRESS (нотариус взял в работу)
  const assessment = await this.assessmentRepo.findById(dto.assessmentId);
  if (!assessment)
    throw new ConnectError('Assessment not found', Code.NotFound);
  if (assessment.status !== AssessmentStatus.IN_PROGRESS)
    throw new ConnectError('Assessment must be IN_PROGRESS to create report', Code.FailedPrecondition);

  return this.repo.create({ ...dto, notaryId: actor.sub, status: ReportStatus.DRAFT });
}

async signReport(id: string): Promise<ProtoReport> {
  const actor = requireRole(UserRole.NOTARY);

  const report = await this.repo.findById(id);
  if (!report) throw new ConnectError('Not found', Code.NotFound);

  // Только нотариус — владелец отчёта
  requireSelfOrRole(report.notaryId, UserRole.ADMIN);

  // Только DRAFT можно подписать
  if (report.status !== ReportStatus.DRAFT)
    throw new ConnectError('Only DRAFT report can be signed', Code.FailedPrecondition);

  const signed = await this.repo.update(id, {
    status:   ReportStatus.SIGNED,
    signedAt: new Date(),
  });

  // Побочный эффект: перевести заявку в COMPLETED
  await this.assessmentService.updateStatus(report.assessmentId, AssessmentStatus.COMPLETED);

  // Уведомление заявителю
  this.eventEmitter.emit('report.signed', {
    reportId:      signed.id,
    assessmentId:  report.assessmentId,
    applicantId:   report.assessment.applicantId,
  });

  return signed;
}

async getDownloadUrl(id: string): Promise<string> {
  requireAuth();
  const report = await this.repo.findById(id);
  if (!report) throw new ConnectError('Not found', Code.NotFound);
  // Заявитель видит только свои отчёты
  requireSelfOrRole(report.assessment.applicantId, UserRole.NOTARY, UserRole.ADMIN);
  return this.storageService.getPresignedUrl(report.fileKey, 3600);
}

async listByAssessment(
  assessmentId: string,
  filters: ReportFiltersDto,
): Promise<{ items: ProtoReport[]; total: number }> {
  const actor = requireAuth();
  // Заявитель — только своя заявка
  const assessment = await this.assessmentRepo.findById(assessmentId);
  if (actor.role === UserRole.APPLICANT && assessment?.applicantId !== actor.sub)
    throw new ConnectError('Access denied', Code.PermissionDenied);
  return this.repo.findMany({ ...filters, assessmentId });
}
```

## Этап 3.A.4 — Frontend

**`/notary/orders/:id` — добавить блок «Отчёт»:**

```html
<!-- notary-order-detail.component.html -->
<section class="report-section" *ngIf="order()">
  <h3>Отчёт об оценке</h3>

  @if (!report()) {
  <lib-button (click)="createReport()" [loading]="reporting()"> Сформировать отчёт </lib-button>
  } @if (report() && report().status === 'DRAFT') {
  <lib-button variant="primary" (click)="signReport()" [loading]="signing()">
    Подписать и отправить заявителю
  </lib-button>
  } @if (report() && report().status === 'SIGNED') {
  <lib-status-badge [status]="report().status" [config]="reportStatusConfig" />
  <a [href]="reportDownloadUrl()" target="_blank">Скачать подписанный отчёт</a>
  }
</section>
```

**`/applicant/assessment/results` — новый компонент:**

```typescript
// applicant-assessment-results.component.ts
@Component({ standalone: true, selector: 'app-assessment-results' })
export class AssessmentResultsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly reportApi = inject(ReportApiService);

  protected readonly reports = signal<ReportUiModel[]>([]);
  protected readonly loading = signal(false);

  ngOnInit(): void {
    const assessmentId = this.route.snapshot.params['id'];
    this.loading.set(true);
    this.reportApi.listByAssessment(assessmentId).subscribe({
      next: (r) => this.reports.set(r.items),
      complete: () => this.loading.set(false),
    });
  }

  downloadReport(reportId: string): void {
    this.reportApi.getDownloadUrl(reportId).subscribe((url) => {
      window.open(url, '_blank');
    });
  }
}
```

**DoD 3.A:**

- [ ] `ReportService` экспортирован из `api-contracts/index.ts`
- [ ] `libs/api/report/` реализован (Repository + Service + RpcService + Module)
- [ ] Зарегистрирован в `connect-router.registry.ts`
- [ ] `report.service.spec.ts`: create (success + wrong status), signReport (success + wrong status transition)
- [ ] Frontend: нотариус видит кнопку «Сформировать» и «Подписать» в карточке заказа
- [ ] Frontend: заявитель видит список отчётов и кнопку «Скачать PDF»

---

---

# ФАЗА 3.B — SaleModule (копии нотариальных документов)

> **Закрывает:** US-10
> **Блокирует:** frontend `/applicant/copies`, `/notary/copies`

## Этап 3.B.1 — Экспорт proto

```typescript
export * from './gen/sale/v1alpha1/sale_pb';
export * from './gen/sale/v1alpha1/sale_connect';
```

## Этап 3.B.2 — Prisma Schema

```prisma
model Sale {
  id          String     @id @default(uuid()) @db.Uuid
  requesterId String     @map("requester_id") @db.Uuid
  documentIds String[]   @map("document_ids")
  price       Decimal    @db.Decimal(10,2)
  status      SaleStatus @default(PENDING)
  paymentId   String?    @map("payment_id") @db.Uuid
  deliveredAt DateTime?  @map("delivered_at") @db.Timestamp()
  createdAt   DateTime   @default(now()) @map("created_at") @db.Timestamp()
  updatedAt   DateTime   @updatedAt @map("updated_at") @db.Timestamp()
  requester   User       @relation(fields: [requesterId], references: [id])

  @@map("sales")
  @@index([requesterId])
  @@index([status])
}

enum SaleStatus { PENDING IN_PROGRESS COMPLETED CANCELLED }
```

## Этап 3.B.3 — Service: бизнес-логика

```typescript
async createSale(dto: CreateSaleDto): Promise<CreateSaleResult> {
  const actor = requireAuth();

  // Создать запрос в статусе PENDING
  const sale = await this.repo.create({
    ...dto,
    requesterId: actor.sub,
    status:      SaleStatus.PENDING,
  });

  // Создать платёж → получить URL для оплаты
  const payment = await this.paymentService.createPayment({
    amount:     sale.price,
    entityId:   sale.id,
    entityType: 'SALE',
    userId:     actor.sub,
  });

  await this.repo.update(sale.id, { paymentId: payment.id });

  return { sale, paymentUrl: payment.checkoutUrl };
}

// Вызывается из webhook после успешной оплаты
async confirmPayment(saleId: string): Promise<ProtoSale> {
  const sale = await this.repo.findById(saleId);
  if (!sale) throw new ConnectError('Not found', Code.NotFound);
  if (sale.status !== SaleStatus.PENDING)
    throw new ConnectError('Sale already processed', Code.FailedPrecondition);
  return this.repo.update(saleId, { status: SaleStatus.IN_PROGRESS });
  // Дальнейшее: администратор вручную переводит в COMPLETED + прикладывает копии
}

async deliverCopies(saleId: string, fileKeys: string[]): Promise<ProtoSale> {
  requireRole(UserRole.ADMIN, UserRole.NOTARY);
  const sale = await this.repo.findById(saleId);
  if (!sale) throw new ConnectError('Not found', Code.NotFound);
  if (sale.status !== SaleStatus.IN_PROGRESS)
    throw new ConnectError('Sale must be IN_PROGRESS', Code.FailedPrecondition);

  // Уведомить заявителя
  this.eventEmitter.emit('sale.delivered', { saleId, requesterId: sale.requesterId });

  return this.repo.update(saleId, {
    status:      SaleStatus.COMPLETED,
    deliveredAt: new Date(),
  });
}
```

## Этап 3.B.4 — Frontend: `/applicant/copies` и `/notary/copies`

```typescript
// copies.component.ts (используется в обоих кабинетах)
// Вкладка 1: «Мои запросы» — DataTableComponent + StatusBadgeComponent
// Вкладка 2: «Новый запрос» — 3-шаговый wizard:
//
// Шаг 1: Выбор документов
//   DocumentService.ListDocuments() → чекбоксы
//   FileUploadComponent — прикрепить основания
//
// Шаг 2: Подтверждение и оплата
//   Показать итоговую стоимость
//   Кнопка «Оплатить» → SaleService.CreateSale() → открыть paymentUrl
//   После возврата: polling SaleService.GetSale(id) через timer(0, 3000)
//   До статуса IN_PROGRESS или COMPLETED
//
// Шаг 3: Статус / получение
//   При COMPLETED: список ссылок → кнопки «Скачать»
```

**DoD 3.B:**

- [ ] `SaleService` экспортирован из `api-contracts/index.ts`
- [ ] `libs/api/sale/` реализован (Repository + Service + RpcService + Module)
- [ ] Зарегистрирован в `connect-router.registry.ts`
- [ ] Webhook: `PaymentService` при `entityType=SALE` вызывает `SaleService.confirmPayment`
- [ ] `sale.service.spec.ts`: create (success), confirmPayment (success + wrong status), deliverCopies
- [ ] Frontend: `/applicant/copies` и `/notary/copies` реализованы

---

---

# ФАЗА 3.C — Auth: расширение (подтверждение контакта, OAuth)

> **Закрывает:** US-01 (полностью), US-02 (частично)
> **Ответственный:** Игорь Васильев (base auth), Глеб Патлатюк (OAuth)

## Этап 3.C.1 — Новые proto-методы в auth.proto

```protobuf
// Добавить в auth/v1alpha1/auth.proto:

message ForgotPasswordRequest  { string email = 1; }
message ForgotPasswordResponse {}   // всегда пустой — не раскрывать существование email

message ResetPasswordRequest   { string token = 1; string new_password = 2; }
message ResetPasswordResponse  {}

message SendEmailVerificationRequest  {}   // токен из заголовка Authorization
message SendEmailVerificationResponse {}

message VerifyEmailRequest   { string code = 1; }
message VerifyEmailResponse  { bool verified = 1; }

message SendPhoneOtpRequest  { string phone = 1; }
message SendPhoneOtpResponse {}

message VerifyPhoneRequest   { string phone = 1; string code = 2; }
message VerifyPhoneResponse  { bool verified = 1; }

message OAuthLoginRequest  {
  string provider     = 1;  // vk | google | apple | yandex
  string code         = 2;
  string redirect_uri = 3;
}
message OAuthLoginResponse {
  string access_token  = 1;
  string refresh_token = 2;
  User   user          = 3;
}

// Добавить в service AuthService:
rpc ForgotPassword        (ForgotPasswordRequest)        returns (ForgotPasswordResponse);
rpc ResetPassword         (ResetPasswordRequest)         returns (ResetPasswordResponse);
rpc SendEmailVerification (SendEmailVerificationRequest) returns (SendEmailVerificationResponse);
rpc VerifyEmail           (VerifyEmailRequest)           returns (VerifyEmailResponse);
rpc SendPhoneOtp          (SendPhoneOtpRequest)          returns (SendPhoneOtpResponse);
rpc VerifyPhone           (VerifyPhoneRequest)           returns (VerifyPhoneResponse);
rpc OAuthLogin            (OAuthLoginRequest)            returns (OAuthLoginResponse);
```

## Этап 3.C.2 — AuthService: новые методы

```typescript
async forgotPassword(email: string): Promise<void> {
  const user = await this.users.findByEmail(email);
  if (!user) return; // silent — не раскрывать существование email

  const token   = crypto.randomBytes(32).toString('hex');
  const hash    = this.jwt.hashToken(token);
  const expires = new Date(Date.now() + 3_600_000); // 1 час

  await this.passwordResetRepo.create({ userId: user.id, tokenHash: hash, expiresAt: expires });
  this.emailQueue.add({ type: 'reset-password', payload: { email: user.email, token } });
}

async resetPassword(token: string, newPassword: string): Promise<void> {
  const hash   = this.jwt.hashToken(token);
  const record = await this.passwordResetRepo.findValid(hash);
  if (!record) throw new ConnectError('Invalid or expired token', Code.InvalidArgument);

  if (newPassword.length < 8)
    throw new ConnectError('Password too short (min 8)', Code.InvalidArgument);

  const passwordHash = await this.password.hash(newPassword);
  await this.users.update(record.userId, { passwordHash });
  await this.passwordResetRepo.revoke(record.id);
  await this.refreshTokenRepo.revokeAllForUser(record.userId); // принудительный logout
}

async sendEmailVerification(userId: string): Promise<void> {
  const code = crypto.randomInt(100_000, 999_999).toString();
  await this.redis.set(`email_verify:${userId}`, code, 'EX', 86400); // 24ч
  const user = await this.users.findById(userId);
  this.emailQueue.add({ type: 'verify-email', payload: { email: user.email, code } });
}

async verifyEmail(userId: string, code: string): Promise<void> {
  const stored = await this.redis.get(`email_verify:${userId}`);
  if (!stored)
    throw new ConnectError('Code expired or not sent', Code.InvalidArgument);
  if (!timingSafeEqual(Buffer.from(stored), Buffer.from(code)))
    throw new ConnectError('Invalid code', Code.InvalidArgument);
  await this.users.update(userId, { emailVerified: true });
  await this.redis.del(`email_verify:${userId}`);
}

async sendPhoneOtp(phone: string, userId: string): Promise<void> {
  // Rate limit: max 3 попытки за 15 минут
  const attemptsKey = `otp_attempts:${userId}`;
  const attempts = await this.redis.incr(attemptsKey);
  if (attempts === 1) await this.redis.expire(attemptsKey, 900);
  if (attempts > 3) throw new ConnectError('Too many OTP requests', Code.ResourceExhausted);

  const code = crypto.randomInt(100_000, 999_999).toString();
  await this.redis.set(`phone_otp:${userId}`, code, 'EX', 300); // 5 минут
  this.smsQueue.add({ phone, code }); // SMSRU / Twilio
}

async verifyPhone(userId: string, code: string): Promise<void> {
  const stored = await this.redis.get(`phone_otp:${userId}`);
  if (!stored) throw new ConnectError('OTP expired', Code.InvalidArgument);
  if (!timingSafeEqual(Buffer.from(stored), Buffer.from(code)))
    throw new ConnectError('Invalid OTP', Code.InvalidArgument);
  await this.users.update(userId, { phoneVerified: true });
  await this.redis.del(`phone_otp:${userId}`);
}

async oauthLogin(provider: string, code: string, redirectUri: string): Promise<AuthResult> {
  // 1. Обменять code на токен провайдера
  const oauthToken = await this.oauthService.exchangeCode(provider, code, redirectUri);
  // 2. Получить профиль
  const profile = await this.oauthService.getProfile(provider, oauthToken);
  // 3. Найти или создать пользователя
  const user = await this.users.upsertOAuth({
    email:       profile.email,
    displayName: profile.name,
    oauthId:     profile.id,
    provider,
  });
  return this.issueTokens(user);
}
```

**Prisma schema — добавить:**

```prisma
model PasswordReset {
  id        String    @id @default(uuid()) @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  tokenHash String    @unique @map("token_hash")
  expiresAt DateTime  @map("expires_at") @db.Timestamp()
  usedAt    DateTime? @map("used_at") @db.Timestamp()
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamp()
  user      User      @relation(fields: [userId], references: [id])

  @@map("password_resets")
  @@index([userId])
}

// Добавить в модель User:
// emailVerified  Boolean @default(false) @map("email_verified")
// phoneVerified  Boolean @default(false) @map("phone_verified")
// oauthProvider  String? @map("oauth_provider")
// oauthId        String? @map("oauth_id")
```

## Этап 3.C.3 — Frontend: расширение auth-страниц

```typescript
// 1. /auth/forgot-password → AuthService.ForgotPassword
//    Форма: только email. Кнопка «Отправить». После отправки: сообщение без подтверждения.

// 2. /auth/reset-password?token=... → AuthService.ResetPassword
//    Форма: новый пароль + подтверждение. Валидация matchPasswordValidator.

// 3. /auth (Register) → после успешного Register:
//    Показать экран «Подтвердите email» → AuthService.SendEmailVerification
//    → форма ввода 6-значного кода → AuthService.VerifyEmail

// 4. /auth → кнопки OAuth:
//    <lib-button (click)="loginWithOAuth('vk')">Войти через VK</lib-button>
//    loginWithOAuth(provider: string): void {
//      const redirectUri = `${window.location.origin}/auth/oauth-callback`;
//      window.location.href = `/api/auth/oauth/${provider}?redirect_uri=${redirectUri}`;
//    }

// 5. /auth/oauth-callback?code=...&provider=... (новая страница)
//    → AuthService.OAuthLogin({ provider, code, redirectUri })
//    → tokenStore.setTokens() → router.navigateByUrl по роли
```

**DoD 3.C:**

- [ ] `auth.proto` содержит все новые методы, `buf lint` проходит
- [ ] `AuthService` реализует: ForgotPassword, ResetPassword, SendEmailVerification, VerifyEmail, SendPhoneOtp, VerifyPhone, OAuthLogin
- [ ] `password_resets` таблица создана, migration applied
- [ ] User model: поля emailVerified, phoneVerified, oauthProvider, oauthId
- [ ] Redis: OTP хранится с TTL
- [ ] Frontend: `/auth/forgot-password` и `/auth/reset-password` работают
- [ ] Frontend: после Register — экран подтверждения email
- [ ] Frontend: кнопки OAuth на странице `/auth`, callback-страница работает
- [ ] PUBLIC_METHODS в auth interceptor обновлён (ForgotPassword, ResetPassword — публичные)

---

---

# ФАЗА 3.D — DocumentService: модерация файлов

> **Закрывает:** US-14 (частично), `/admin/files`
> **Ответственный:** Головатый Константин, Евсеев М.В.

## Этап 3.D.1 — Новые методы в `document.proto`

```protobuf
// Добавить в document.proto:

enum ModerationStatus {
  MODERATION_STATUS_UNSPECIFIED = 0;
  MODERATION_STATUS_PENDING     = 1;
  MODERATION_STATUS_ACCEPTED    = 2;
  MODERATION_STATUS_REJECTED    = 3;
}

enum ModerationResult {
  MODERATION_RESULT_UNSPECIFIED = 0;
  MODERATION_RESULT_ACCEPTED    = 1;
  MODERATION_RESULT_REJECTED    = 2;
}

// Добавить поле moderation_status в сообщение Document

message ModerateDocumentRequest {
  string id               = 1;
  ModerationResult result = 2;
  string rejection_reason = 3;  // обязателен при REJECTED
}
message ModerateDocumentResponse { Document document = 1; }

// Пагинация документов по статусу модерации (для /admin/files)
message ListDocumentsPendingRequest {
  int32 page      = 1;
  int32 page_size = 2;
}
message ListDocumentsPendingResponse {
  repeated Document documents = 1;
  int32 total = 2;
}

// Добавить в service DocumentService:
rpc ModerateDocument       (ModerateDocumentRequest)       returns (ModerateDocumentResponse);
rpc ListDocumentsPending   (ListDocumentsPendingRequest)   returns (ListDocumentsPendingResponse);
```

## Этап 3.D.2 — Prisma Schema

```prisma
// Добавить в модель Document:
// moderationStatus  ModerationStatus  @default(PENDING) @map("moderation_status")
// rejectionReason   String?           @map("rejection_reason")
// moderatedBy       String?           @map("moderated_by") @db.Uuid
// moderatedAt       DateTime?         @map("moderated_at") @db.Timestamp()

// Добавить enum:
enum ModerationStatus { PENDING ACCEPTED REJECTED }

// Добавить в @@index:
// @@index([moderationStatus])
```

## Этап 3.D.3 — document.service.ts: новые методы

```typescript
async moderateDocument(
  id: string,
  result: ModerationResult,
  rejectionReason?: string,
): Promise<ProtoDocument> {
  requireRole(UserRole.ADMIN);

  const doc = await this.repo.findById(id);
  if (!doc) throw new ConnectError('Not found', Code.NotFound);
  if (doc.moderationStatus !== ModerationStatus.PENDING)
    throw new ConnectError('Document already moderated', Code.FailedPrecondition);

  if (result === ModerationResult.REJECTED && !rejectionReason)
    throw new ConnectError('Rejection reason required', Code.InvalidArgument);

  const actor = requireRole(UserRole.ADMIN);
  const updated = await this.repo.update(id, {
    moderationStatus: result === ModerationResult.ACCEPTED
      ? ModerationStatus.ACCEPTED
      : ModerationStatus.REJECTED,
    rejectionReason: rejectionReason ?? null,
    moderatedBy:  actor.sub,
    moderatedAt:  new Date(),
  });

  // Уведомить загрузившего
  this.eventEmitter.emit('document.moderated', {
    documentId: id,
    uploaderId: doc.uploaderId,
    result,
    rejectionReason,
  });

  return updated;
}

async listDocumentsPending(
  filters: PaginationDto,
): Promise<{ items: ProtoDocument[]; total: number }> {
  requireRole(UserRole.ADMIN);
  return this.repo.findMany({
    ...filters,
    moderationStatus: ModerationStatus.PENDING,
  });
}
```

## Этап 3.D.4 — Frontend: `/admin/files`

```typescript
// admin-files.component.ts
// DataTableComponent: файл | тип | загрузил | дата | статус модерации
// По умолчанию: фильтр moderationStatus = PENDING
// DocumentService.ListDocumentsPending({ page, pageSize })

// DrawerComponent для детального просмотра:
//   FilePreviewComponent (PDF/изображение)
//   Метаданные: имя, тип, размер, загрузила роль, дата
//   Кнопка «Принять» → DocumentService.ModerateDocument({ result: ACCEPTED })
//   Кнопка «Отклонить» → TextareaComponent(причина) → ModerateDocument({ result: REJECTED, rejectionReason })
// После модерации: тост-уведомление + снять строку из списка

// Фильтры закладки: PENDING | ACCEPTED | REJECTED
// Количество на проверке (бедж) в меню /admin должно показывать DocumentService.ListDocumentsPending().total
```

**DoD 3.D:**

- [ ] `document.proto` расширен: `ModerateDocument`, `ListDocumentsPending`, `ModerationStatus` enum
- [ ] Prisma: `moderationStatus` поле в Document модели, migration applied
- [ ] `DocumentService.moderateDocument` реализован, валидация rejection_reason
- [ ] Уведомление загрузившему при принятии/отклонении
- [ ] `document.service.spec.ts` расширен: moderateDocument (success + already moderated + missing reason)
- [ ] Frontend `/admin/files`: двухпанельный layout, превью файла, принять/отклонить

---

---

# ФАЗА 3.E — AssessmentService: отмена заявки + возврат оплаты

> **Закрывает:** US-20 (редактирование заявки), US-24 (отмена + возврат)

## Этап 3.E.1 — Новые методы в `assessment.proto`

```protobuf
// US-24: отмена заявки с запросом на возврат
message RequestCancellationRequest  { string id = 1; string reason = 2; }
message RequestCancellationResponse { Assessment assessment = 1; }

// US-20: редактирование заявки (добавление документов, изменение описания)
// UpdateAssessment уже существует, но нужно ограничить по статусу (DRAFT/PENDING он)

// Добавить в service AssessmentService:
rpc RequestCancellation (RequestCancellationRequest) returns (RequestCancellationResponse);

// Добавить статус CANCELLATION_REQUESTED в AssessmentStatus enum
enum AssessmentStatus {
  ASSESSMENT_STATUS_UNSPECIFIED          = 0;
  ASSESSMENT_STATUS_DRAFT                = 1;
  ASSESSMENT_STATUS_PENDING              = 2;  // на проверке
  ASSESSMENT_STATUS_ACTIVE               = 3;  // активная
  ASSESSMENT_STATUS_PAID                 = 4;  // оплачено
  ASSESSMENT_STATUS_IN_PROGRESS          = 5;  // нотариус взял в работу
  ASSESSMENT_STATUS_COMPLETED            = 6;  // завершено
  ASSESSMENT_STATUS_CANCELLED            = 7;  // отменено
  ASSESSMENT_STATUS_CANCELLATION_REQUESTED = 8; // US-24: запрошен возврат
}
```

## Этап 3.E.2 — assessment.service.ts: новые методы

```typescript
// US-20: редактирование до начала оценки
async updateAssessment(
  id: string,
  dto: UpdateAssessmentDto,
): Promise<ProtoAssessment> {
  const actor = requireAuth();
  const existing = await this.repo.findById(id);
  if (!existing) throw new ConnectError('Not found', Code.NotFound);

  requireSelfOrRole(existing.applicantId, UserRole.ADMIN);

  // US-20: редактирование доступно только в статусах DRAFT или PENDING
  const editableStatuses = [
    AssessmentStatus.DRAFT,
    AssessmentStatus.PENDING,
  ];
  if (!editableStatuses.includes(existing.status))
    throw new ConnectError(
      'Assessment can only be edited in DRAFT or PENDING status',
      Code.FailedPrecondition,
    );

  return this.repo.update(id, dto);
}

// US-24: заявка на отмену
async requestCancellation(
  id: string,
  reason: string,
): Promise<ProtoAssessment> {
  const actor = requireAuth();
  const existing = await this.repo.findById(id);
  if (!existing) throw new ConnectError('Not found', Code.NotFound);

  requireSelfOrRole(existing.applicantId, UserRole.ADMIN);

  // Нельзя отменить уже завершённые
  const nonCancellable = [
    AssessmentStatus.COMPLETED,
    AssessmentStatus.CANCELLED,
  ];
  if (nonCancellable.includes(existing.status))
    throw new ConnectError('Cannot cancel completed or already cancelled assessment', Code.FailedPrecondition);

  // Если уже оплачено → перевести в CANCELLATION_REQUESTED (админ подтверждает)
  const newStatus = existing.status === AssessmentStatus.PAID
    ? AssessmentStatus.CANCELLATION_REQUESTED
    : AssessmentStatus.CANCELLED;

  const updated = await this.repo.update(id, { status: newStatus, cancellationReason: reason });

  // Если сразу отменяется (не PAID) → возврат автоматически
  if (newStatus === AssessmentStatus.CANCELLED && existing.paymentId) {
    this.eventEmitter.emit('assessment.cancelled', {
      assessmentId: id,
      paymentId:    existing.paymentId,
      reason,
    });
  }

  return updated;
}
```

## Этап 3.E.3 — Prisma Schema

```prisma
// Добавить в модель Assessment:
// cancellationReason  String?  @map("cancellation_reason")
// paymentId           String?  @map("payment_id") @db.Uuid

// Добавить статус в enum AssessmentStatus:
// CANCELLATION_REQUESTED
```

## Этап 3.E.4 — Webhook: автоматический возврат при CANCELLATION_REQUESTED

```typescript
// В AuditService или отдельном обработчике:
@OnEvent('assessment.cancelled')
async handleAssessmentCancelled(event: AssessmentCancelledEvent): Promise<void> {
  // Вызвать возврат (если есть paymentId)
  if (event.paymentId) {
    await this.paymentService.refundPayment(event.paymentId, 'Отмена заявки заявителем');
  }
  // Уведомление заявителю
  await this.notificationService.send({
    userId: event.applicantId,
    type:   'ASSESSMENT_CANCELLED',
    title:  'Заявка отменена',
    body:   'Возврат средств будет обработан в течение 3-5 дней',
  });
}
```

## Этап 3.E.5 — Frontend: кнопка «Отменить» в карточке заявки

```typescript
// applicant-order-detail.component.ts

// Кнопка «Отменить» — показывать при статусах DRAFT/PENDING/ACTIVE/PAID
protected readonly canCancel = computed(() => {
  const s = this.order()?.status;
  return [
    'DRAFT', 'PENDING', 'ACTIVE', 'PAID',
  ].includes(s ?? '');
});

// Кнопка «Редактировать» — только DRAFT или PENDING
protected readonly canEdit = computed(() =>
  ['DRAFT', 'PENDING'].includes(this.order()?.status ?? ''),
);

requestCancellation(): void {
  this.dialog.open(ConfirmDialogComponent, {
    data: {
      title: 'Отменить заявку',
      message: 'Укажите причину отмены (Required)',
      withInput: true,
    },
  }).afterClosed().pipe(
    filter(Boolean),
    switchMap(reason => this.assessmentApi.requestCancellation(this.orderId(), reason)),
  ).subscribe(() => this.loadOrder());
}
```

**DoD 3.E:**

- [ ] `assessment.proto` расширен: `RequestCancellation`, `CANCELLATION_REQUESTED` в enum
- [ ] Prisma: `cancellationReason`, `paymentId` поля в Assessment, migration applied
- [ ] `assessment.service.ts`: `requestCancellation` + ограничение редактирования по статусу
- [ ] EventEmitter: при отмене срабатывает `assessment.cancelled`
- [ ] PaymentService: при `entityType=ASSESSMENT` + CANCELLATION_REQUESTED → refund
- [ ] `assessment.service.spec.ts` расширен: requestCancellation (DRAFT, PAID, COMPLETED)
- [ ] Frontend `/applicant/orders/:id`: кнопка «Отменить» + кнопка «Редактировать» (условные)

---

---

# ФАЗА 4.D — Admin: Subscriptions + Settings

> **Закрывает:** `/admin/subscriptions`, `/admin/settings`
> **Ответственный:** Трушин Евгений + Липовцев Родион + Деркач Е.С.

## Этап 4.D.1 — Frontend: `/admin/subscriptions`

```typescript
// admin-subscriptions.component.ts
// Зависимость: PaymentService.ListSubscriptions (фаза 5.A)

@Component({ standalone: true, selector: 'app-admin-subscriptions' })
export class AdminSubscriptionsComponent {
  protected readonly subscriptions = signal<SubscriptionUiModel[]>([]);
  protected readonly total = signal(0);
  protected readonly loading = signal(false);
  protected readonly page = signal(1);
  protected readonly pageSize = 25;

  // DataTableComponent: пользователь | план | дата начала | дата окончания | статус
  // Действия:
  //   Отменить → ConfirmDialogComponent → PaymentService.CancelSubscription
  // Фильтр: по userId (SelectComponent/UserService.ListUsers)
  // Фильтр: по статусу (ACTIVE | CANCELLED | EXPIRED)

  cancelSubscription(id: string): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: { title: 'Отменить подписку', withInput: true },
      })
      .afterClosed()
      .pipe(
        filter(Boolean),
        switchMap((reason) => this.paymentApi.cancelSubscription(id, reason)),
      )
      .subscribe(() => this.loadPage());
  }
}
```

## Этап 4.D.2 — Frontend: `/admin/settings`

```typescript
// admin-settings.component.ts
// Минимальная реализация через REST-эндпоинт (ne ConnectRPC)

// Backend: apps/api/src/settings/settings.controller.ts
// @Get('settings')  → requireRole(ADMIN) → вернуть все настройки
// @Put('settings')  → requireRole(ADMIN) → сохранить настройки

// Таблица system_settings в Prisma:
// model SystemSetting {
//   key       String  @id
//   value     String
//   updatedAt DateTime @updatedAt
//   @@map("system_settings")
// }

// Настройки (пример):
// maintenance_mode:  false          — режим техобслуживания
// max_upload_mb:     20             — максимальный размер загрузки
// allowed_formats:   pdf,jpg,png    — допустимые форматы
// support_email:     support@...    — эмайл поддержки

// Frontend admin-settings.component.ts:
// FormComponent: ToggleComponent(режим техобсл.), InputComponent(макс. размер), SelectComponent(форматы)
// Кнопка «Сохранить» → PUT /api/settings
// Toast: «Настройки сохранены»
```

**DoD 4.D:**

- [ ] Prisma: `SystemSetting` модель создана, migration applied
- [ ] Backend: `SettingsController` GET/PUT `/api/settings` (только ADMIN)
- [ ] Frontend `/admin/subscriptions`: пагинация + фильтры + CancelSubscription
- [ ] Frontend `/admin/settings`: форма + сохранение

---

---

# ФАЗА 4.E — Notary Analytics (новый экран)

> **Закрывает:** US-26 (аналитический модуль нотариуса)
> **Добавить в sitemap.md:** `/notary/analytics`

## Этап 4.E.1 — Добавить маршрут в sitemap.md

```markdown
| `/notary/analytics` | Моя аналитика | Статистика по своим заказам, рейтинг, экспорт данных |
```

## Этап 4.E.2 — Frontend: `/notary/analytics`

```typescript
// notary-analytics.component.ts

@Component({ standalone: true, selector: 'app-notary-analytics' })
export class NotaryAnalyticsComponent {
  private readonly assessmentApi = inject(AssessmentApiService);
  private readonly reportApi = inject(ReportApiService);

  protected readonly period = signal<'week' | 'month' | 'year'>('month');

  // Секция 1: Мои заказы за период
  // AssessmentService.ListAssessments({ notaryId: me.id }) → группировка по статусу
  // График: BarChart (статусы) | LineChart (динамика по дням)

  // Секция 2: Среднее время обработки
  // (Assessment.updatedAt - Assessment.createdAt) для status=COMPLETED
  // Показать: среднее + мин/макс

  // Секция 3: Отчёты
  // ReportService.ListReports({ notaryId: me.id }) → последние 10 отчётов

  // Секция 4: Экспорт
  // Кнопка «Скачать CSV» → генерация файла на клиенте
  exportCsv(): void {
    const rows = this.assessments().map((a) => [a.id, a.status, a.createdAt, a.updatedAt]);
    const csv = [
      ['ИД', 'Статус', 'Создан', 'Обновлен'].join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
```

**DoD 4.E:**

- [ ] Маршрут `/notary/analytics` добавлен в `sitemap.md`
- [ ] `notary-analytics.component.ts` реализован
- [ ] 4 секции: заказы, время, отчёты, экспорт
- [ ] Период-селектор (week/month/year) работает

---

---

# ФАЗА 6.A — SupportModule

> **Закрывает:** US-15
> **Ответственные:** Васорин Иван, Говор Сергей

## Этап 6.A.1 — Proto файл

```protobuf
// libs/shared/api-contracts/proto/support/v1alpha1/support.proto
syntax = "proto3";
package notary.support.v1alpha1;
import "google/protobuf/timestamp.proto";

enum TicketStatus {
  TICKET_STATUS_UNSPECIFIED = 0;
  TICKET_STATUS_OPEN        = 1;
  TICKET_STATUS_IN_PROGRESS = 2;
  TICKET_STATUS_RESOLVED    = 3;
  TICKET_STATUS_CLOSED      = 4;
}

enum TicketPriority {
  TICKET_PRIORITY_UNSPECIFIED = 0;
  TICKET_PRIORITY_LOW         = 1;
  TICKET_PRIORITY_MEDIUM      = 2;
  TICKET_PRIORITY_HIGH        = 3;
  TICKET_PRIORITY_URGENT      = 4;
}

message Ticket {
  string id              = 1;
  string subject         = 2;
  TicketStatus status    = 3;
  TicketPriority priority = 4;
  string author_id       = 5;
  google.protobuf.Timestamp sla_deadline = 6;
  google.protobuf.Timestamp created_at   = 7;
  google.protobuf.Timestamp updated_at   = 8;
}

message TicketMessage {
  string id                     = 1;
  string ticket_id              = 2;
  string author_id              = 3;
  string text                   = 4;
  repeated string attachment_ids = 5;
  google.protobuf.Timestamp created_at = 6;
}

message CreateTicketRequest  { string subject = 1; string text = 2; TicketPriority priority = 3; }
message CreateTicketResponse { Ticket ticket = 1; }
message GetTicketRequest     { string id = 1; }
message GetTicketResponse    { Ticket ticket = 1; }
message ListTicketsRequest   { int32 page = 1; int32 page_size = 2; TicketStatus status_filter = 3; }
message ListTicketsResponse  { repeated Ticket tickets = 1; int32 total = 2; }
message AddMessageRequest    { string ticket_id = 1; string text = 2; repeated string attachment_ids = 3; }
message AddMessageResponse   { TicketMessage message = 1; }
message ListMessagesRequest  { string ticket_id = 1; int32 page = 1; int32 page_size = 2; }
message ListMessagesResponse { repeated TicketMessage messages = 1; int32 total = 2; }
message CloseTicketRequest   { string id = 1; string resolution = 2; }
message CloseTicketResponse  { Ticket ticket = 1; }

service SupportService {
  rpc CreateTicket  (CreateTicketRequest)  returns (CreateTicketResponse);
  rpc GetTicket     (GetTicketRequest)     returns (GetTicketResponse);
  rpc ListTickets   (ListTicketsRequest)   returns (ListTicketsResponse);
  rpc AddMessage    (AddMessageRequest)    returns (AddMessageResponse);
  rpc ListMessages  (ListMessagesRequest)  returns (ListMessagesResponse);
  rpc CloseTicket   (CloseTicketRequest)   returns (CloseTicketResponse);
}
```

## Этап 6.A.2 — Prisma Schema

```prisma
model Ticket {
  id          String         @id @default(uuid()) @db.Uuid
  subject     String
  status      TicketStatus   @default(OPEN)
  priority    TicketPriority @default(MEDIUM)
  authorId    String         @map("author_id") @db.Uuid
  slaDeadline DateTime       @map("sla_deadline") @db.Timestamp()
  resolvedAt  DateTime?      @map("resolved_at") @db.Timestamp()
  resolution  String?        @db.Text
  createdAt   DateTime       @default(now()) @map("created_at") @db.Timestamp()
  updatedAt   DateTime       @updatedAt @map("updated_at") @db.Timestamp()
  messages    TicketMessage[]
  author      User           @relation(fields: [authorId], references: [id])

  @@map("tickets")
  @@index([authorId])
  @@index([status])
  @@index([slaDeadline])
}

model TicketMessage {
  id            String   @id @default(uuid()) @db.Uuid
  ticketId      String   @map("ticket_id") @db.Uuid
  authorId      String   @map("author_id") @db.Uuid
  text          String   @db.Text
  attachmentIds String[] @map("attachment_ids")
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamp()
  ticket        Ticket   @relation(fields: [ticketId], references: [id])
  author        User     @relation("TicketMessageAuthor", fields: [authorId], references: [id])

  @@map("ticket_messages")
  @@index([ticketId])
}

enum TicketStatus   { OPEN IN_PROGRESS RESOLVED CLOSED }
enum TicketPriority { LOW MEDIUM HIGH URGENT }
```

## Этап 6.A.3 — SupportService: бизнес-логика

```typescript
async createTicket(dto: CreateTicketDto): Promise<ProtoTicket> {
  const actor = requireAuth();

  // SLA deadline по приоритету
  const slaHoursMap = {
    LOW: 72, MEDIUM: 24, HIGH: 8, URGENT: 2,
  } as const;
  const hours = slaHoursMap[dto.priority] ?? 24;
  const slaDeadline = new Date(Date.now() + hours * 3_600_000);

  // Создать тикет + первое сообщение
  const ticket = await this.repo.create({
    ...dto,
    authorId:    actor.sub,
    slaDeadline,
  });

  if (dto.text) {
    await this.messageRepo.create({
      ticketId: ticket.id,
      authorId: actor.sub,
      text:     dto.text,
    });
  }

  return ticket;
}

async addMessage(dto: AddMessageDto): Promise<ProtoTicketMessage> {
  const actor  = requireAuth();
  const ticket = await this.repo.findById(dto.ticketId);
  if (!ticket) throw new ConnectError('Ticket not found', Code.NotFound);
  if (ticket.status === TicketStatus.CLOSED)
    throw new ConnectError('Cannot message in closed ticket', Code.FailedPrecondition);

  // Только автор тикета или admin/support
  requireSelfOrRole(ticket.authorId, UserRole.ADMIN);

  return this.messageRepo.create({ ...dto, authorId: actor.sub });
}

async closeTicket(id: string, resolution: string): Promise<ProtoTicket> {
  requireRole(UserRole.ADMIN);
  const ticket = await this.repo.findById(id);
  if (!ticket) throw new ConnectError('Not found', Code.NotFound);
  if (ticket.status === TicketStatus.CLOSED)
    throw new ConnectError('Already closed', Code.FailedPrecondition);
  return this.repo.update(id, {
    status:     TicketStatus.CLOSED,
    resolvedAt: new Date(),
    resolution,
  });
}
```

## Этап 6.A.4 — Frontend: `/applicant/support` и `/notary/support`

```typescript
// support.component.ts
// Layout: две колонки
// Левая (1/3): список тикетов
//   DataTableComponent: subject, status badge, sla-индикатор, дата
//   Фильтр по статусу (chips)
//   Кнопка «Новый тикет» → DrawerComponent с CreateTicketForm

// Правая (2/3): активный тикет
//   Заголовок + статус + SLA-таймер
//   Список сообщений (прокрутка снизу вверх)
//   Форма нового сообщения + FileUploadComponent

// SLA-таймер:
protected readonly slaColor = computed(() => {
  const ms = this.slaRemaining();
  if (ms === null) return 'gray';
  return ms > 14_400_000 ? 'green' : ms > 3_600_000 ? 'yellow' : 'red';
});

// Polling новых сообщений:
private readonly messages$ = timer(0, 10_000).pipe(
  switchMap(() => this.supportApi.listMessages({
    ticketId: this.activeTicketId(),
    page: 1,
    pageSize: 50,
  })),
  takeUntilDestroyed(),
);
```

**DoD 6.A:**

- [ ] `support.proto` написан, `buf lint` проходит, экспортирован
- [ ] `libs/api/support/` реализован: Ticket + TicketMessage Repository, SupportService, SupportRpcService, SupportModule
- [ ] Зарегистрирован в `connect-router.registry.ts`
- [ ] `support.service.spec.ts`: createTicket, addMessage (закрытый тикет), closeTicket
- [ ] Frontend: `/applicant/support` и `/notary/support` реализованы
- [ ] Polling новых сообщений работает (interval 10 сек)
- [ ] SLA-таймер: цвет меняется в зависимости от оставшегося времени

---

---

# ФАЗА 6.B — KnowledgeModule (FAQ)

> **Закрывает:** `/faq`, `/applicant/faq`, `/notary/faq`
> **Ответственные:** Титов Святослав, Рахманов Рахман

## Этап 6.B.1 — Proto файл

```protobuf
// libs/shared/api-contracts/proto/knowledge/v1alpha1/knowledge.proto
syntax = "proto3";
package notary.knowledge.v1alpha1;
import "google/protobuf/timestamp.proto";

message KnowledgeCategory {
  string id            = 1;
  string slug          = 2;
  string name          = 3;
  int32  article_count = 4;
}

message KnowledgeArticle {
  string id          = 1;
  string slug        = 2;
  string title       = 3;
  string content     = 4;   // HTML/Markdown
  string author_id   = 5;
  string category_id = 6;
  int32  view_count  = 7;
  google.protobuf.Timestamp created_at = 8;
  google.protobuf.Timestamp updated_at = 9;
}

message ListCategoriesRequest  {}
message ListCategoriesResponse { repeated KnowledgeCategory categories = 1; }
message GetCategoryRequest     { string slug = 1; }
message GetCategoryResponse    { KnowledgeCategory category = 1; repeated KnowledgeArticle articles = 2; }
message GetArticleRequest      { string slug = 1; }
message GetArticleResponse     { KnowledgeArticle article = 1; }
message SearchArticlesRequest  {
  string query     = 1;
  string logic     = 2;     // AND | OR | CONTAINS | EQUAL | LEFT | RIGHT
  string author_id = 3;
  int32  page      = 4;
  int32  page_size = 5;
}
message SearchArticlesResponse { repeated KnowledgeArticle articles = 1; int32 total = 2; }

service KnowledgeService {
  rpc ListCategories (ListCategoriesRequest)  returns (ListCategoriesResponse);
  rpc GetCategory    (GetCategoryRequest)     returns (GetCategoryResponse);
  rpc GetArticle     (GetArticleRequest)      returns (GetArticleResponse);
  rpc SearchArticles (SearchArticlesRequest)  returns (SearchArticlesResponse);
}
```

## Этап 6.B.2 — Prisma Schema

```prisma
model KnowledgeCategory {
  id       String             @id @default(uuid()) @db.Uuid
  slug     String             @unique
  name     String
  articles KnowledgeArticle[]

  @@map("knowledge_categories")
}

model KnowledgeArticle {
  id         String            @id @default(uuid()) @db.Uuid
  slug       String            @unique
  title      String
  content    String            @db.Text
  authorId   String            @map("author_id") @db.Uuid
  categoryId String            @map("category_id") @db.Uuid
  viewCount  Int               @default(0) @map("view_count")
  createdAt  DateTime          @default(now()) @map("created_at") @db.Timestamp()
  updatedAt  DateTime          @updatedAt @map("updated_at") @db.Timestamp()
  author     User              @relation(fields: [authorId], references: [id])
  category   KnowledgeCategory @relation(fields: [categoryId], references: [id])

  @@map("knowledge_articles")
  @@index([categoryId])
  @@index([authorId])
}
```

## Этап 6.B.3 — KnowledgeService: full-text search

```typescript
async searchArticles(filters: SearchFiltersDto): Promise<{ items: ProtoArticle[]; total: number }> {
  // Full-text search PostgreSQL:
  // Логика AND: join(' & ')  → 'нотариус & наследство'
  // Логика OR:  join(' | ')  → 'нотариус | наследство'
  // CONTAINS:   plainto_tsquery (любое вхождение)
  // LEFT/RIGHT: prefix matching через lexeme:*

  const tsQuery = this.buildTsQuery(filters.query, filters.logic);

  return this.prisma.$queryRaw`
    SELECT *, count(*) OVER() AS total
    FROM knowledge_articles
    WHERE to_tsvector('russian', title || ' ' || content)
          @@ to_tsquery('russian', ${tsQuery})
    AND   (${filters.authorId}::uuid IS NULL OR author_id = ${filters.authorId}::uuid)
    ORDER BY ts_rank(to_tsvector('russian', title || ' ' || content),
                     to_tsquery('russian', ${tsQuery})) DESC
    LIMIT  ${filters.pageSize}
    OFFSET ${(filters.page - 1) * filters.pageSize}
  `;
}

private buildTsQuery(query: string, logic: string): string {
  const words = query.trim().split(/\s+/).filter(Boolean);
  switch (logic) {
    case 'AND':      return words.join(' & ');
    case 'OR':       return words.join(' | ');
    case 'LEFT':     return words.map(w => `${w}:*`).join(' & ');
    case 'RIGHT':    return words.map(w => `*:${w}`).join(' & ');
    case 'CONTAINS': return `%${query}%`;  // используется через ILIKE отдельно
    default:         return words.join(' & ');
  }
}
```

## Этап 6.B.4 — Frontend: `/faq`

```typescript
// faq.component.ts
// Блок 1: Категории — grid карточек → клик → /faq/category/:slug
// Блок 2: Популярные статьи — top 5 по viewCount
// Блок 3: Поиск с расширенными фильтрами
//   - Строка поиска (debounce 300ms)
//   - Логика: выпадающий список (AND/OR/CONTAINS/EQUAL/LEFT/RIGHT)
//   - Автор: поле фильтра
//   - URL параметры: ?q=...&logic=OR&author=...

// faq-search-results.component.ts
// HighlightPipe — подсветка совпадений:
//   transform(text: string, query: string): SafeHtml {
//     const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\# 🚨 Технический долг и риски

| Проблема | Приоритет | Решение |
|---|---|---|
| Refresh token в `sessionStorage` — XSS-уязвим | 🔴 Критический | BFF-прокси с `httpOnly`-cookie или SSR + cookie-proxy |
| Нет rate-limiting на Auth endpoints | 🔴 Критический | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` из `@nestjs/throttler` |
| Proto-сервисы не экспортированы из `api-contracts/index.ts` | 🔴 Высокий | Добавить экспорт + зарегистрировать в `connect-router.registry.ts` + `buf generate` |
| `moduleResolution: "node"` в `tsconfig.base.json` — устаревшее | 🟡 Средний | Мигрировать на `"bundler"` (Angular 17+) |
| Нет `Content-Security-Policy` header | 🟡 Средний | Nginx: `add_header Content-Security-Policy "default-src 'self'"` |
| `prisma.$transaction` не используется в сложных write-операциях | 🟡 Средний | Обернуть все create+update пары |
| Нет E2E-тестов | 🟢 Низкий | Playwright в Фазе 8.4 |
| `docker-compose.yaml` не содержит сервис `api` | 🟡 Средний | Добавить в Этапе 0.1.1 |

---

*Версия: 3.0*
*Стек: NX 22 · Angular 21 · NestJS 11 · Prisma 7 · ConnectRPC 2 · TypeScript 5.9 · PostgreSQL 16 · Docker · GitHub Actions · Netlify*');
//     const highlighted = text.replace(
//       new RegExp(escaped, 'gi'),
//       match => `<mark>${match}</mark>`
//     );
//     return this.sanitizer.bypassSecurityTrustHtml(
//       DOMPurify.sanitize(highlighted)
//     );
//   }
```

**DoD 6.B:**

- [ ] `knowledge.proto` написан, `buf lint` проходит, экспортирован
- [ ] `libs/api/knowledge/` реализован с full-text search
- [ ] Seed: несколько категорий и статей в `seed.ts`
- [ ] Frontend: `/faq` с категориями, поиском и фильтрами
- [ ] Frontend: `/faq/category/:slug` и `/faq/article/:slug`
- [ ] HighlightPipe реализован с DOMPurify санитизацией

---

---

# ФАЗА 5.A — Payment: расширение методов

> **Закрывает:** `/admin/subscriptions`, US-06 (полностью)

## Этап 5.A.1 — Новые методы в payment.proto

```protobuf
// Добавить в payment.proto:

enum PaymentMethod {
  PAYMENT_METHOD_UNSPECIFIED   = 0;
  PAYMENT_METHOD_CARD          = 1;   // банковская карта
  PAYMENT_METHOD_YOOMONEY      = 2;   // ЮMoney
  PAYMENT_METHOD_SBP           = 3;   // Система быстрых платежей
  PAYMENT_METHOD_BANK_TRANSFER = 4;   // банковский перевод
}

// Добавить payment_method в CreatePaymentRequest и Payment message

message ListSubscriptionsRequest  {
  int32  page      = 1;
  int32  page_size = 2;
  string user_id   = 3;   // опционально — фильтр для admin
}
message ListSubscriptionsResponse { repeated Subscription subscriptions = 1; int32 total = 2; }

message CancelSubscriptionRequest  { string id = 1; string reason = 2; }
message CancelSubscriptionResponse { Subscription subscription = 1; }

message RefundPaymentRequest  { string payment_id = 1; string reason = 2; }
message RefundPaymentResponse { Payment payment = 1; }

// Добавить в service PaymentService:
rpc ListSubscriptions    (ListSubscriptionsRequest)  returns (ListSubscriptionsResponse);
rpc CancelSubscription   (CancelSubscriptionRequest) returns (CancelSubscriptionResponse);
rpc RefundPayment        (RefundPaymentRequest)      returns (RefundPaymentResponse);
```

## Этап 5.A.2 — Webhook: Payment → Report/Sale (бизнес-логика)

```typescript
// apps/api/src/payment-webhook.controller.ts
// Обязательно HTTP-контроллер (не ConnectRPC) — платёжный провайдер шлёт обычный POST

@Controller('payments')
export class PaymentWebhookController {
  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-yookassa-signature') signature: string,
  ): Promise<void> {
    // 1. Верифицировать HMAC-SHA256 подпись
    const expected = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('hex');
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      throw new HttpException('Invalid signature', 401);

    const event = JSON.parse(req.rawBody.toString());

    // 2. Идемпотентность: проверить что событие ещё не обработано
    const payment = await this.paymentService.findByExternalId(event.object.id);
    if (!payment || payment.status === 'COMPLETED') return;

    // 3. Обновить статус платежа
    await this.paymentService.updateStatus(payment.id, 'COMPLETED');

    // 4. Роутинг по типу оплачиваемой сущности
    switch (payment.entityType) {
      case 'ASSESSMENT':
        await this.assessmentService.updateStatus(payment.entityId, 'PAID');
        this.eventEmitter.emit('payment.assessment.confirmed', {
          assessmentId: payment.entityId,
          userId: payment.userId,
        });
        break;

      case 'SALE':
        await this.saleService.confirmPayment(payment.entityId);
        break;

      case 'SUBSCRIPTION':
        await this.paymentService.activateSubscription(payment.entityId);
        break;
    }
  }
}
```

**DoD 5.A:**

- [ ] `payment.proto` расширен: PaymentMethod enum, ListSubscriptions, CancelSubscription, RefundPayment
- [ ] Webhook контроллер реализован с HMAC-проверкой
- [ ] Идемпотентность: повторная доставка не дублирует действия
- [ ] Тест: `payment-webhook.controller.spec.ts` — неверная подпись, дублированное событие
- [ ] Frontend `/admin/subscriptions`: DataTableComponent + CancelSubscription

---

---

# ФАЗА 4.A — NotificationModule

> **Закрывает:** US-05 (частично — in-app + email), `/admin/newsletter`

## Этап 4.A.1 — Экспорт proto + расширение

```typescript
export * from './gen/notification/v1alpha1/notification_pb';
export * from './gen/notification/v1alpha1/notification_connect';
```

```protobuf
// Добавить в notification.proto:
message ChannelSettings {
  bool email_enabled = 1;
  bool sms_enabled   = 2;
  bool push_enabled  = 3;
}
message UpdateChannelSettingsRequest  { ChannelSettings settings = 1; }
message UpdateChannelSettingsResponse { ChannelSettings settings = 1; }
message GetChannelSettingsRequest     {}
message GetChannelSettingsResponse    { ChannelSettings settings = 1; }
message SendBroadcastRequest  {
  string          subject    = 1;
  string          body       = 2;
  repeated string role_filter = 3;  // пустой = всем
}
message SendBroadcastResponse { int32 recipients_count = 1; }

rpc UpdateChannelSettings (UpdateChannelSettingsRequest)  returns (UpdateChannelSettingsResponse);
rpc GetChannelSettings    (GetChannelSettingsRequest)     returns (GetChannelSettingsResponse);
rpc SendBroadcast         (SendBroadcastRequest)          returns (SendBroadcastResponse);
```

## Этап 4.A.2 — Backend: NotificationModule

```typescript
// notification.service.ts
async send(dto: SendNotificationDto): Promise<void> {
  // 1. Всегда сохранить in-app уведомление
  const notification = await this.repo.create(dto);

  // 2. Настройки каналов пользователя
  const settings = await this.channelRepo.findByUser(dto.userId)
    ?? { emailEnabled: true, smsEnabled: false, pushEnabled: false };

  // 3. Роутинг по каналам через BullMQ (fire-and-forget)
  if (settings.emailEnabled) this.emailQueue.add('notification', dto);
  if (settings.smsEnabled)   this.smsQueue.add('notification', dto);
  if (settings.pushEnabled)  this.pushQueue.add('notification', dto);
}

async sendBroadcast(dto: SendBroadcastDto): Promise<number> {
  requireRole(UserRole.ADMIN);
  // Получить список пользователей с фильтром по роли
  const users = await this.userRepo.findMany({
    role:            dto.roleFilter.length ? dto.roleFilter : undefined,
    emailVerified:   true,
  });
  // Добавить задачи в очередь (не синхронно!)
  for (const user of users.items) {
    this.emailQueue.add('broadcast', {
      to:      user.email,
      subject: dto.subject,
      body:    dto.body,
    });
  }
  return users.total;
}
```

## Этап 4.A.3 — Frontend

```typescript
// notification-settings.component.ts (на странице /*/notifications)
// Три тоггла: Email / SMS / Push
// NotificationService.GetChannelSettings при инициализации
// NotificationService.UpdateChannelSettings при изменении (debounce 500ms)

// admin-newsletter.component.ts (/admin/newsletter)
// Форма: subject (текст), body (textarea/rich editor), role_filter (multiselect)
// Кнопка «Отправить» → NotificationService.SendBroadcast
// После отправки: toast «Отправлено N получателям»
```

**DoD 4.A:**

- [ ] `NotificationService` экспортирован из `api-contracts/index.ts`
- [ ] `libs/api/notification/` реализован
- [ ] ChannelSettings таблица в Prisma
- [ ] BullMQ очереди: email, sms, push — воркеры реализованы
- [ ] Frontend: настройки каналов уведомлений работают
- [ ] Frontend: `/admin/newsletter` — форма рассылки работает

---

---

# ФАЗА 4.B — AuditModule + AdminStatistics

> **Закрывает:** US-14
> **Ответственные:** Нибылицын Лукьян, Черненко Дмитрий, Васильев Степан, Гущина Мария

## Этап 4.B.1 — Экспорт proto

```typescript
export * from './gen/audit/v1alpha1/audit_pb';
export * from './gen/audit/v1alpha1/audit_connect';
```

## Этап 4.B.2 — Prisma Schema

```prisma
model AuditLog {
  id         String      @id @default(uuid()) @db.Uuid
  actorId    String      @map("actor_id") @db.Uuid
  action     AuditAction
  entityType String      @map("entity_type")
  entityId   String      @map("entity_id")
  changes    Json?       // { before: {}, after: {} }
  ipAddress  String?     @map("ip_address")
  userAgent  String?     @map("user_agent")
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamp()
  actor      User        @relation(fields: [actorId], references: [id])

  @@map("audit_logs")
  @@index([actorId])
  @@index([entityType, entityId])
  @@index([createdAt(sort: Desc)])
}

enum AuditAction { CREATE UPDATE DELETE LOGIN LOGOUT EXPORT STATUS_CHANGE }
```

## Этап 4.B.3 — AuditService: запись и чтение

```typescript
// Запись — слушает события EventEmitter2 из других модулей
@OnEvent('*.created')  async onCreated(event: DomainEvent): Promise<void> {}
@OnEvent('*.updated')  async onUpdated(event: DomainEvent): Promise<void> {}
@OnEvent('*.deleted')  async onDeleted(event: DomainEvent): Promise<void> {}
@OnEvent('auth.login') async onLogin(event: AuthEvent): Promise<void> {}

// Все обработчики вызывают:
private async log(dto: CreateAuditLogDto): Promise<void> {
  await this.repo.create(dto);
}

// Чтение
async listAuditLogs(filters: AuditFiltersDto): Promise<{ items; total }> {
  requireRole(UserRole.ADMIN);
  return this.repo.findMany(filters);
}
```

## Этап 4.B.4 — Frontend

```typescript
// admin-monitoring.component.ts (/admin/monitoring)
// DataTableComponent: актор | действие | тип объекта | ID | дата | IP
// Фильтры: actorId, entityType, action, dateFrom, dateTo
// Экспорт CSV:
//   this.auditApi.listAll(filters).subscribe(items => {
//     const csv = generateCsv(items);
//     downloadBlob(csv, `audit_${Date.now()}.csv`);
//   });

// admin-statistics.component.ts (/admin/statistics)
// Секция 1: Заявки по статусам — BarChart
//   AssessmentService.ListAssessments() → group by status
// Секция 2: Выручка по периодам — LineChart
//   PaymentService.GetPaymentHistory() → group by date
// Секция 3: Топ нотариусов по числу выполненных заявок — BarChart
//   UserService.ListUsers({ role: NOTARY }) +
//   AssessmentService.ListAssessments({ status: COMPLETED })
// Период-селектор: today/week/month/year → пересчёт через effect()
```

**DoD 4.B:**

- [ ] `AuditLogService` экспортирован из `api-contracts/index.ts`
- [ ] `libs/api/audit/` реализован
- [ ] AuditLog Prisma model создана, migration applied
- [ ] EventEmitter2 интеграция: create/update/delete/login логируются
- [ ] Frontend: `/admin/monitoring` с фильтрами и CSV-экспортом
- [ ] Frontend: `/admin/statistics` с 3 графиками и период-селектором

---

---

# ФАЗА 4.C — PromoModule

> **Закрывает:** US-13, `/admin/plans`
> **Ответственный:** Сазонтов Александр

## Этап 4.C.1 — Экспорт proto

```typescript
export * from './gen/promo/v1alpha1/promo_pb';
export * from './gen/promo/v1alpha1/promo_connect';
```

## Этап 4.C.2 — Prisma Schema

```prisma
model Promo {
  id         String    @id @default(uuid()) @db.Uuid
  code       String    @unique
  type       PromoType
  value      Decimal   @db.Decimal(10,2)
  usageLimit Int?      @map("usage_limit")
  usageCount Int       @default(0) @map("usage_count")
  expiresAt  DateTime? @map("expires_at") @db.Timestamp()
  isActive   Boolean   @default(true) @map("is_active")
  createdAt  DateTime  @default(now()) @map("created_at") @db.Timestamp()
  updatedAt  DateTime  @updatedAt @map("updated_at") @db.Timestamp()

  @@map("promos")
  @@index([code])
  @@index([isActive])
}

enum PromoType { PERCENT FIXED }
```

## Этап 4.C.3 — PromoService: бизнес-логика

```typescript
async validatePromo(
  code: string,
  amount: Decimal,
): Promise<{ discount: Decimal; finalAmount: Decimal }> {
  const promo = await this.repo.findByCode(code);
  if (!promo || !promo.isActive)
    throw new ConnectError('Promo code not found', Code.NotFound);
  if (promo.expiresAt && promo.expiresAt < new Date())
    throw new ConnectError('Promo code expired', Code.FailedPrecondition);
  if (promo.usageLimit !== null && promo.usageCount >= promo.usageLimit)
    throw new ConnectError('Promo usage limit reached', Code.FailedPrecondition);

  const discount = promo.type === 'PERCENT'
    ? amount.mul(promo.value).div(100)
    : promo.value;

  return { discount, finalAmount: amount.sub(discount).max(0) };
}

async applyPromo(code: string): Promise<void> {
  // Атомарно увеличить счётчик использований
  await this.prisma.promo.update({
    where: { code },
    data:  { usageCount: { increment: 1 } },
  });
}
```

## Этап 4.C.4 — Frontend: `/admin/plans`

```typescript
// admin-plans.component.ts
// Вкладка 1: «Тарифные планы» — DataTableComponent
//   Колонки: название, цена/мес, возможности, статус
//   Действия: создать, редактировать (DrawerComponent)

// Вкладка 2: «Промокоды» — DataTableComponent
//   Колонки: код, тип (PERCENT/FIXED), значение, использовано/лимит, срок
//   Создать: DrawerComponent с формой
//   Деактивировать: toggle isActive через PromoService.UpdatePromo

// Вкладка 3: «Скидки» — если используется отдельная модель
```

**DoD 4.C:**

- [ ] `PromoService` экспортирован из `api-contracts/index.ts`
- [ ] `libs/api/promo/` реализован
- [ ] Promo Prisma model создана, migration applied
- [ ] `promo.service.spec.ts`: validatePromo (expired, limit reached, success)
- [ ] Frontend: `/admin/plans` с двумя вкладками (планы + промокоды)

---

---

# Обновлённый реестр proto-сервисов

| Сервис               | Proto | Экспорт | Backend | Frontend | Версия плана          |
| -------------------- | ----- | ------- | ------- | -------- | --------------------- |
| AuthService (base)   | ✅    | ✅      | ✅      | ✅       | v1                    |
| AuthService (ext)    | ❌→✅ | ❌→✅   | ❌→✅   | ❌→✅    | **добавить в 3.C**    |
| UserService          | ✅    | ✅      | ✅      | ✅       | v1                    |
| AssessmentService    | ✅    | ✅      | ✅      | ✅       | v1                    |
| DocumentService      | ✅    | ✅      | ✅      | ✅       | v1                    |
| FormsService         | ✅    | ✅      | ✅      | ✅       | v1                    |
| PaymentService       | ✅    | ✅      | ✅      | ✅       | v1                    |
| PaymentService (ext) | ❌→✅ | ❌→✅   | ❌→✅   | ❌→✅    | **добавить в 5.A**    |
| ReportService        | ✅    | ❌→✅   | ❌→✅   | ❌→✅    | **реализовать в 3.A** |
| SaleService          | ✅    | ❌→✅   | ❌→✅   | ❌→✅    | **реализовать в 3.B** |
| NotificationService  | ✅    | ❌→✅   | ❌→✅   | ❌→✅    | **реализовать в 4.A** |
| PromoService         | ✅    | ❌→✅   | ❌→✅   | ❌→✅    | **реализовать в 4.C** |
| AuditLogService      | ✅    | ❌→✅   | ❌→✅   | ❌→✅    | **реализовать в 4.B** |
| SupportService       | ❌→✅ | ❌→✅   | ❌→✅   | ❌→✅    | **создать в 6.A**     |
| KnowledgeService     | ❌→✅ | ❌→✅   | ❌→✅   | ❌→✅    | **создать в 6.B**     |

---

# 🚨 Технический долг и риски (обновлено)

| Проблема                                                                                         | Приоритет      | Решение                                                                       |
| ------------------------------------------------------------------------------------------------ | -------------- | ----------------------------------------------------------------------------- |
| Refresh token в `sessionStorage` — XSS-уязвим                                                    | 🔴 Критический | BFF-прокси с `httpOnly`-cookie или SSR + cookie-proxy                         |
| Нет rate-limiting на Auth endpoints                                                              | 🔴 Критический | `ThrottlerModule.forRoot([{ ttl: 60000, limit: 10 }])` из `@nestjs/throttler` |
| ReportService, SaleService, NotificationService, PromoService, AuditLogService не экспортированы | 🔴 Критический | Фазы 3.A, 3.B, 4.A, 4.B, 4.C — экспорт + реализация                           |
| SupportService и KnowledgeService — proto не написан                                             | 🔴 Критический | Фазы 6.A, 6.B                                                                 |
| Auth: нет ForgotPassword, ResetPassword, VerifyEmail, OAuthLogin                                 | 🔴 Критический | Фаза 3.C                                                                      |
| Нет webhook-контроллера Payment → downstream (Sale/Assessment/Subscription)                      | 🔴 Критический | Фаза 5.A                                                                      |
| `moduleResolution: "node"` в `tsconfig.base.json` — устаревшее                                   | 🟡 Средний     | Мигрировать на `"bundler"`                                                    |
| Нет `Content-Security-Policy` header                                                             | 🟡 Средний     | Nginx: `add_header Content-Security-Policy "default-src 'self'"`              |
| `prisma.$transaction` не используется в сложных write-операциях                                  | 🟡 Средний     | Обернуть все create+update пары                                               |
| Нет E2E-тестов                                                                                   | 🟢 Низкий      | Playwright в Фазе 8.4                                                         |
| `docker-compose.yaml` не содержит сервис `api`                                                   | 🟡 Средний     | Добавить в Этапе 0.1.1                                                        |
| Платёжный провайдер не выбран                                                                    | 🟡 Средний     | ADR-007: ЮKassa рекомендован                                                  |

---

_Версия: 4.0_
_Анализ US: docs/US-coverage-analysis.md_
_Стек: NX 22 · Angular 21 · NestJS 11 · Prisma 7 · ConnectRPC 2 · TypeScript 5.9 · PostgreSQL 16 · Docker · GitHub Actions · Netlify_
