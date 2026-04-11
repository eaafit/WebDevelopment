## ConnectRPC + `@notary-portal/api-contracts` (единственный источник типов)

### Правило

- **Не описывай вручную DTO для RPC** (Request/Response/enum/message).
- **Импортируй сервисы и типы только из** `@notary-portal/api-contracts`.
- **После изменений proto** всегда обеспечь, что:
  - сгенерированные файлы обновлены,
  - нужные сервисы экспортируются в `libs/shared/api-contracts/src/index.ts`,
  - сервис зарегистрирован в API router (см. `apps/api/src/app/connect-router.registry.ts`).

### Почему

- Контракты — “single source of truth”; ручные типы расходятся с proto и ломают клиент/сервер неявно.

### Быстрые команды (ориентиры)

- Генерация контрактов: `pnpm nx run api-contracts:generate-proto`
- Lint proto: `pnpm nx run api-contracts:lint-proto`
- Breaking check (если меняли публичный контракт): `pnpm nx run api-contracts:breaking-proto`

### Источники в репозитории

- `docs/frontend-api-contracts-guide.md`
- `docs/DEVELOPMENT_PLAN.md` (buf lint/generate/breaking)
- `libs/shared/api-contracts/src/index.ts`
- `apps/api/src/app/connect-router.registry.ts`
