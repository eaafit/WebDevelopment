## Skill: Реализовать фронтовый RPC фасад‑сервис (ConnectRPC)

### Когда использовать

- Нужно вызвать RPC методы с фронта и отдать UI удобную модель, не “протаскивая” proto‑типы в компоненты.

### Шаги

1. **Выбери место**: в нужной web‑lib под `src/lib/features/<feature>/…` (согласно роли/области).
2. **Создай сервис‑фасад** (Angular `@Injectable({ providedIn: 'root' })`).
3. **Создай RPC‑клиент один раз** как поле класса:
   - `createClient(SomeService, inject(RPC_TRANSPORT))`
4. **Сделай публичные методы сервиса**:
   - вызывай метод клиента,
   - оборачивай в RxJS (`from(...)`),
   - возвращай **UI‑типы**, а не DTO из контрактов.
5. **Сделай приватные мапперы**:
   - DTO → UI маппинг должен быть явным,
   - enum: `switch/case` (или `Record<UI, API>`),
   - Timestamp: `timestampDate` / `timestampFromDate`,
   - опциональные строки: нормализация пустых (`trim()` → `null`).
6. **Ошибки**:
   - если обрабатываешь на уровне сервиса, используй `catchError` и нормализуй “пользовательскую” ошибку (без утечек токенов/PII).

### Готово когда

- Компоненты используют только фасад‑сервис и UI‑типы.
- В компонентах нет импортов `Get*Request`/`Get*Response` из `@notary-portal/api-contracts`.
- Все маппинги enum/Timestamp/строк явно определены.

### Эталон в репозитории

- `libs/web/notary/src/lib/features/dashboard/transactions/transactions-api.service.ts`

### Источник требований

- `docs/frontend-api-contracts-guide.md`
