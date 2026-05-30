## Skill: Создать Angular standalone компонент в нужной web‑lib

### Когда использовать

- Нужно добавить новый UI/feature компонент в `libs/web/*`.

### Шаги

1. **Определи библиотеку‑назначение**:
   - `guest`, `applicant`, `notary`, `admin` или `shared`
2. **Сгенерируй компонент** (standalone):
   - `pnpm nx g @nx/angular:component libs/web/<lib>/src/lib/features/<name>/<name> --standalone`
3. **Проверь структуру**:
   - компонент лежит в `libs/web/<lib>/src/lib/features/<name>/…`
   - стиль `scss` (по генераторам NX workspace)

### Готово когда

- Компонент сгенерирован генератором, а не вручную.
- Путь соответствует соглашению `libs/web/<lib>/src/lib/features/…`.

### Источник в репозитории

- `docs/developer-setup.md`
- `nx.json` (workspace generators)
