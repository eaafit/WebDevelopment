## Frontend RPC: фасад‑сервис и явный маппинг DTO → UI

### Правило

- **RPC вызовы и маппинг DTO → UI делай в сервисе**, а не в компонентах.
- **Компоненты не должны импортировать Request/Response типы** из `@notary-portal/api-contracts`.
- **Enum маппь явно** (через `switch/case` или таблицу), не через “магические” числа/строки.
- **Timestamp обрабатывай через** `timestampDate` / `timestampFromDate` из `@bufbuild/protobuf/wkt`.
- **Строки из proto нормализуй**, если UI ожидает опциональность: пустые/пробельные строки → `null` (или проектная конвенция).

### Почему

- Это снижает связность UI со схемой RPC и упрощает тестирование/рефакторинг.

### Эталон в репозитории

- `libs/web/notary/src/lib/features/dashboard/transactions/transactions-api.service.ts`

### Источник требований

- `docs/frontend-api-contracts-guide.md`
