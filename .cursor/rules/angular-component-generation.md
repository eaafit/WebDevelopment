## Angular компоненты: генерация через NX и правильные пути

### Правило

- **Создавай новые компоненты только через NX generator**, не вручную.
- **Компоненты должны жить в правильной lib**:
  - `libs/web/guest/...` (публичная часть)
  - `libs/web/applicant/...` (кабинет заявителя)
  - `libs/web/notary/...` (кабинет нотариуса)
  - `libs/web/admin/...` (админка)
  - `libs/web/shared/...` (переиспользуемое)
- **По умолчанию — standalone компоненты** (`--standalone`).

### Почему

- Генератор соблюдает соглашения репозитория (scss, eslint, структура), снижает ручные расхождения.

### Команда (шаблон)

- `pnpm nx g @nx/angular:component libs/web/<guest|applicant|notary|admin|shared>/src/lib/features/<name>/<name> --standalone`

### Источник в репозитории

- `docs/developer-setup.md`
