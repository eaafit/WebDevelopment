# Skill: Angular E2E-тесты (Playwright)

## Когда использовать

- Нужно добавить, изменить или починить **автоматизированный E2E-тест** для Angular-приложения `apps/web`.
- Нужно добавить `data-testid` в UI для стабильных локаторов.
- Нужно настроить фикстуры авторизации, mock внешних сервисов или CI-запуск E2E.

**Не использовать** для unit/integration-тестов компонентов и сервисов — они живут в `*.spec.ts` рядом с кодом (Jest).

---

## Архитектура в репозитории

| Что | Где |
|-----|-----|
| Angular app | `apps/web` |
| E2E-проект Playwright | `apps/web-e2e` |
| Конфиг Playwright | `apps/web-e2e/playwright.config.ts` |
| Spec-файлы | `apps/web-e2e/src/specs/<domain>/` |
| Page Objects | `apps/web-e2e/src/pages/` |
| Seed-данные, константы | `apps/web-e2e/src/fixtures/` |
| Файлы для upload | `apps/web-e2e/fixtures/files/` |
| План всех тестов | `docs/e2e-playwright-plan.md` |
| Маршруты UI | `docs/sitemap.md` |

**Стек:** Playwright + TypeScript. Cypress/Protractor **не используются**.

**baseURL:** `http://localhost:4200` (переопределяется `BASE_URL`).

---

## Порядок работы агента

### 1. Определи scope теста

1. Найди сценарий в `docs/e2e-playwright-plan.md` (ID вида `E2E-0xx`) или пользовательскую историю в `docs/US*.md`.
2. Сверь маршрут с `docs/sitemap.md`.
3. Прочитай Angular-комponent в `libs/web/<guest|applicant|notary|admin|shared>/` — пойми реальные локаторы, lazy routes, guard'ы.

### 2. Выбери тип теста

| Тип | Когда | Зависимости |
|-----|-------|-------------|
| **Smoke** (`@smoke`) | Страница открывается, форма видна | Только `web` |
| **UI flow** | Действия пользователя без backend side-effects | `web` + mock API через `page.route()` |
| **Full E2E** | Сквозной сценарий с реальным API | `docker compose`, `pnpm db:seed`, `api` + `web` |

### 3. Создай или расширь Page Object

- Один Page Object = одна страница или логический экран.
- Файл: `apps/web-e2e/src/pages/<name>.page.ts`.
- Класс экспортирует `Locator` и методы (`goto`, `fillForm`, `expectLoaded`).
- **Не дублируй** локаторы в spec — только в Page Object.

Пример (существующий):

```typescript
// apps/web-e2e/src/pages/auth.page.ts
export class AuthPage {
  constructor(private readonly page: Page) { /* locators */ }
  async goto(): Promise<void> { /* ... */ }
}
```

### 4. Напиши spec

- Путь: `apps/web-e2e/src/specs/<domain>/<feature>.spec.ts`
- Группировка: `test.describe('Feature @tag', () => { ... })`
- Обязательные теги: домен (`@auth`, `@applicant`, …), приоритет (`@P0`–`@P3`), при необходимости `@smoke`, `@negative`
- Используй `test.step()` для длинных сценариев.
- Имена тестов — **на русском**, как в плане.

Шаблон:

```typescript
import { test, expect } from '@playwright/test';
import { AuthPage } from '../../pages/auth.page';
import { SEED_USERS } from '../../fixtures/test-data';

test.describe('Заявки заявителя @applicant @orders @P1', () => {
  test('создание заявки на оценку', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto();
    await authPage.login(SEED_USERS.applicant.email, SEED_USERS.applicant.password);
    await expect(page).toHaveURL(/\/applicant/);
    // ...
  });
});
```

### 5. Добавь `data-testid` в Angular (если локатор нестабилен)

Приоритет локаторов Playwright:

1. `getByRole` (button, link, heading, textbox)
2. `getByLabel` / `#id` (если label уникален)
3. `getByTestId('...')`
4. CSS — **только в крайнем случае**

Если `getByLabel` даёт strict mode violation (как у поля «Пароль» + кнопка «Показать пароль») — используй `#id` или добавь `data-testid`.

В Angular-шаблоне:

```html
<span data-testid="assessment-status">{{ statusLabel }}</span>
```

Именование testid: `kebab-case`, домен + элемент (`assessment-status`, `notification-unread`).

Список рекомендуемых testid — в конце `docs/e2e-playwright-plan.md`.

### 6. Запусти и почини тест

```powershell
# Smoke (автоподнимает web)
pnpm nx e2e web-e2e -- --grep "@smoke"

# Конкретный файл
pnpm nx e2e web-e2e -- src/specs/applicant/orders/create-order.spec.ts

# UI mode для отладки
pnpm nx e2e web-e2e --configuration=ui

# HTML-отчёт
pnpm nx e2e web-e2e --configuration=report
```

Если web уже запущен локально — Playwright переиспользует его (`reuseExistingServer: true` вне CI).

Для тестов с API:

```powershell
docker compose up -d
pnpm db:seed
pnpm nx serve api   # отдельный терминал
pnpm nx e2e web-e2e -- --grep "@P0"
```

---

## Авторизация

### Seed-аккаунты (`apps/web-e2e/src/fixtures/test-data.ts`)

| Роль | Email | Пароль |
|------|-------|--------|
| Заявитель | `seed-user-000@seed.local` | `SeedPass123!` |
| Нотариус | `seed-user-010@seed.local` | `SeedPass123!` |
| Админ | `seed-user-020@seed.local` | `SeedPass123!` |

Переопределение через env: `E2E_APPLICANT_EMAIL`, `E2E_SEED_PASSWORD`, …

### storageState (рекомендуется для P0/P1)

1. В `global-setup.ts` — логин трёх ролей, сохранение в `apps/web-e2e/.auth/{applicant,notary,admin}.json`.
2. Фикстура `auth.fixture.ts`:

```typescript
import { test as base } from '@playwright/test';

export const test = base.extend({
  applicantPage: async ({ browser }, use) => {
    const ctx = await browser.newContext({
      storageState: 'apps/web-e2e/.auth/applicant.json',
    });
    await use(await ctx.newPage());
    await ctx.close();
  },
});
```

3. В spec: `import { test } from '../../fixtures/auth.fixture'`.

### UI-хинты на `/auth`

При dev-сборке web (`NG_APP_SHOW_TEST_ACCOUNTS=true`) на странице входа есть блок «Тестовые аккаунты». Можно кликать `.login__test-account`, но для CI надёжнее явный `AuthPage.login()`.

---

## Mock внешних зависимостей

| Сервис | Подход |
|--------|--------|
| OAuth (Google/VK/…) | `page.route()` — перехват redirect и callback |
| Email/SMS | Не парсить почту; токен через API-helper или mock `VerifyEmail` |
| Платёжный шлюз | Mock `CreatePayment` + simulate webhook / success redirect |
| FIAS / Росреестр | Mock Connect-RPC endpoint через `page.route('**/GetPropertyInfo**')` |
| Polling статусов | `apiHelper.updateStatus()` + `expect(..., { timeout: 35_000 })` |

Пример mock:

```typescript
await page.route('**/CreatePayment**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ paymentUrl: '/applicant/payments/success?mock=1' }),
  }),
);
```

---

## Ожидания и стабильность (Angular)

- После клика с навигацией: `await page.waitForURL('**/applicant/orders/**')`.
- После RPC: `await page.waitForResponse(r => r.url().includes('ListAssessments') && r.ok())`.
- Не используй `page.waitForTimeout()` без крайней необходимости — предпочитай `expect`, `waitForURL`, `waitForResponse`, `expect.poll`.
- Lazy-loaded routes: дождись появления ключевого элемента, не фиксированной задержки.
- Upload: `locator.setInputFiles('fixtures/files/sample.pdf')`.
- Download: `const [download] = await Promise.all([page.waitForEvent('download'), btn.click()])`.

---

## Структура каталогов spec

```
apps/web-e2e/src/specs/
├── smoke/           # @smoke — быстрые проверки
├── auth/
├── applicant/
│   ├── orders/
│   ├── documents/
│   ├── assessment/
│   └── payments/
├── notary/
├── admin/
├── support/
├── faq/
├── share/
├── integration/
└── security/
```

Именование файлов: `<feature>.spec.ts` (kebab-case).

---

## Переменные окружения

| Переменная | Назначение | По умолчанию |
|------------|------------|--------------|
| `BASE_URL` | URL фронтенда | `http://localhost:4200` |
| `E2E_SKIP_WEB_SERVER` | Не поднимать web (уже запущен) | — |
| `CI` | retries=2, workers=1, forbidOnly | — |
| `E2E_SEED_PASSWORD` | Пароль seed-пользователей | `SeedPass123!` |

---

## CI (рекомендуемый pipeline)

```bash
docker compose up -d
pnpm db:seed
pnpm nx e2e web-e2e -- --grep "@P0" --reporter=html
```

Артефакты: `apps/web-e2e/playwright-report/`, `apps/web-e2e/test-results/`.

В `playwright.config.ts` уже настроены: `trace: 'on-first-retry'`, screenshot/video on failure.

---

## Чек-лист перед завершением задачи

- [ ] Spec лежит в правильной папке `apps/web-e2e/src/specs/…`
- [ ] Локаторы в Page Object, не размазаны по spec
- [ ] Теги `@domain` и `@P0`–`P3` проставлены
- [ ] Тест **запущен локально** и проходит
- [ ] Нет хардкода секретов; используются seed/env
- [ ] Teardown: тестовые данные удалены через API (если создавались)
- [ ] При добавлении testid — минимальный diff в Angular-шаблоне
- [ ] Обновлён `docs/e2e-playwright-plan.md` только если менялся scope плана (не обязательно для каждого теста)

---

## Антипаттерны (не делать)

- ❌ Создавать E2E в `apps/web/` или `libs/web/**` — только `apps/web-e2e`
- ❌ Использовать Protractor/Cypress
- ❌ Селекторы по классам Angular (`.ng-valid`, `_ngcontent-*`)
- ❌ `sleep(5000)` вместо явных ожиданий
- ❌ Один гигантский spec на весь кабинет — дробить по feature
- ❌ Зависеть от реального OAuth/SMTP/платежей в CI
- ❌ Коммитить `.auth/`, `playwright-report/`, `test-results/` (уже в `.gitignore`)

---

## Связанные документы

- `.cursor/skills/gitea-mcp-issues/SKILL.md` — создание/синхронизация issues в Gitea из плана
- `docs/e2e-playwright-plan.md` — реестр всех E2E-сценариев
- `docs/sitemap.md` — маршруты и роли
- `docs/developer-setup.md` — запуск dev-стека
- `apps/web-e2e/playwright.config.ts` — конфигурация
- `apps/web/env.portal.example` — seed-credentials и `NG_APP_SHOW_TEST_ACCOUNTS`
