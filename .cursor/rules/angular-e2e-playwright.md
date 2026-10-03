## Angular E2E: Playwright в apps/web-e2e

### Правило

- **E2E-тесты пиши только в `apps/web-e2e`** (Playwright + TypeScript). Не добавляй Cypress/Protractor.
- **Структура:** spec → `src/specs/<domain>/`, Page Objects → `src/pages/`, данные → `src/fixtures/`.
- **Локаторы:** `getByRole` → `getByLabel` / `#id` → `getByTestId` → CSS (избегать). При нестабильности добавляй `data-testid` в Angular-шаблон.
- **Авторизация:** seed из `src/fixtures/test-data.ts`; для частых тестов — `storageState` через `global-setup.ts`.
- **Внешние сервисы** (OAuth, email, платежи, госAPI) — mock через `page.route()`, не реальные интеграции в CI.
- **Запуск:** `pnpm nx e2e web-e2e -- --grep "@smoke"`; полные сценарии требуют `docker compose`, `pnpm db:seed`, API.
- **Перед сдачей** — прогони затронутые spec локально.

### Когда нужна полная инструкция

Прочитай skill: `.cursor/skills/angular-e2e-playwright.md`

### Источники в репозитории

- `docs/e2e-playwright-plan.md`
- `docs/sitemap.md`
- `apps/web-e2e/playwright.config.ts`
