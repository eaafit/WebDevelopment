## Skill: Добавить/обновить API контракт (proto → TypeScript)

### Когда использовать

- Добавляешь новый RPC метод/сообщение/enum или новый сервис в `libs/shared/api-contracts/proto/…`.

### Входные данные

- Домен и версия: `libs/shared/api-contracts/proto/<domain>/v1alpha1/<domain>.proto` (по принятой структуре).

### Шаги

1. **Измени proto** в `libs/shared/api-contracts/proto/…`.
2. **Проверь линт proto**:
   - `pnpm nx run api-contracts:lint-proto`
3. **Сгенерируй TypeScript**:
   - `pnpm nx run api-contracts:generate-proto`
4. **Экспортируй типы/сервис** из пакета контрактов:
   - обнови `libs/shared/api-contracts/src/index.ts` (добавь `export * from './generated/…'` при необходимости).
5. **Если это серверный сервис**: зарегистрируй его в Connect router:
   - `apps/api/src/app/connect-router.registry.ts` (добавь `router.service(YourService, …)` и подключи соответствующий `*RpcService`).
6. **Проверь breaking changes** (если контракт публичный и изменялся не обратно‑совместимо):
   - `pnpm nx run api-contracts:breaking-proto`

### Готово когда

- `pnpm nx run api-contracts:lint-proto` проходит.
- `pnpm nx run api-contracts:generate-proto` проходит.
- Нужные сервисы/типы доступны через импорт из `@notary-portal/api-contracts`.
- (Для backend) сервис зарегистрирован в `apps/api/src/app/connect-router.registry.ts`.

### Ссылки в репозитории

- `libs/shared/api-contracts/project.json` (targets)
- `libs/shared/api-contracts/src/index.ts`
- `apps/api/src/app/connect-router.registry.ts`
- `docs/DEVELOPMENT_PLAN.md` (buf lint/generate/breaking)
