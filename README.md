# WebDevelopment

## Документация

- [Инструкция для разработчика](docs/developer-setup.md)

> [!IMPORTANT]
> **Необходимо выполнить при первом запуске проекта:**
>
> - `npm install -g pnpm` - установить pnpm
> - `pnpm install` - установить все зависимости (Выполнять в корне проекта)

## Команды

### Создание библиотек/компонентов

- `pnpm nx g @nx/angular:lib libs/web/<guest|applicant|notary|admin|shared/<ui|utils>> --standalone [--routing: необходим для всех библиотек, кроме общих]` - создать Front-end библиотеку (Необходимо в редких случаях)
- `pnpm nx generate @nx/angular:component libs/web/<guest|applicant|notary|admin|shared>/src/lib/features/<component_name>/<component_name> --standalone` - создать Front-end компонент

---

### Запуск проекта

- `docker-compose up` - запустить PostgreSQL
- `pnpm nx serve api` - запустить Back-end
- `pnpm nx serve web` - запустить Front-end

---

### Prisma

- `pnpm nx run prisma:status` - проверяет текущее состояние базы данных и выводит информацию о уже примененных и ожидающих выполнения миграциях.
- `pnpm nx run prisma:migrate [-n migration_name]` - создает новые миграции на основе изменений в Prisma-схеме и автоматически применяет их к базе данных (используется только в среде разработки).
- `pnpm nx run prisma:studio` - запускает локальный веб-интерфейс (Prisma Studio) для удобного визуального просмотра и редактирования данных в базе.
- `pnpm nx run prisma:deploy` - применяет все ранее созданные, но еще не выполненные миграции к базе данных (предназначено для production-окружения и CI/CD пайплайнов).
- `pnpm nx run prisma:migrate` - обновляет Prisma Client на основе текущей схемы, генерируя актуальные TypeScript-типы для безопасного взаимодействия с базой данных из кода.
- `pnpm nx run prisma:migrate` - автоматически заполняет базу данных начальными или тестовыми данными в соответствии с заранее настроенным seed-скриптом.

> [!WARNING]
> Если у вас установлен PostgreSQL вне Docker, порт 5432 может быть занят, и появится необходимость поменять его на любой другой свободный порт.
