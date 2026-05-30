## NX module boundaries (обязательные зависимости между libs)

### Правило

- **Соблюдай `@nx/enforce-module-boundaries`**: импортируй код только из библиотек, разрешённых тегами `scope:*`.
- **Не обходи границы “удобными” относительными путями** и не копируй код между libs вместо зависимости.

### Почему

- Это удерживает NX-монорепо в состоянии, где сборка/тесты предсказуемы, а зависимости не превращаются в спагетти.

### Быстрые проверки

- Посмотри ограничения в корневом ESLint: `eslint.config.mjs`.
- Если не уверен(а), какой тег у библиотеки — смотри её `project.json` (`tags`).

### Разрешённые зависимости (фактическая конфигурация)

- **`scope:backend`** → только `scope:shared`, `scope:backend-shared`
- **`scope:frontend`** → только `scope:shared`, `scope:frontend-shared`
- **`scope:shared`** → только `scope:shared`

### Источники в репозитории

- `eslint.config.mjs`
- `docs/DEVELOPMENT_PLAN.md` (раздел про карту libs и depConstraints)
