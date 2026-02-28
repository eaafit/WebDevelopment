# Инструкция для разработчика

## Подготовка к запуску

1. Установите `pnpm` (если ещё не установлен):
   ```bash
   npm install -g pnpm
   ```

2. В корне проекта установите зависимости:
   ```bash
   pnpm install
   ```

## Запуск приложения

Используйте команды **строго в указанном порядке**:

1. Установите Docker Desktop

Проверьте доступность docker командой:
   ```bash
   docker info
   ```


2. Поднимите инфраструктуру (PostgreSQL):
   ```bash
   docker-compose up
   ```

3В отдельном терминале запустите Front-end:
   ```bash
   pnpm nx serve web
   ```

## Примечание

Если порт `5432` занят (например, установлен PostgreSQL вне Docker), измените порт в `docker-compose.yaml` на свободный.

## Создание компонента

Новый компонент создаётся командой:

```bash
pnpm nx generate @nx/angular:component libs/web/<guest|applicant|notary|admin|shared>/src/lib/features/<component_name>/<component_name> --standalone
```

Примеры:
Компонент в guest:

```bash
pnpm nx generate @nx/angular:component libs/web/guest/src/lib/features/login-form/login-form --standalone
```

Компонент в shared:

```bash
pnpm nx generate @nx/angular:component libs/web/shared/src/lib/features/button/button --standalone
```

Компонент в applicant:

```bash
pnpm nx generate @nx/angular:component libs/web/applicant/src/lib/features/dashboard/dashboard --standalone
```

Параметры:
guest, applicant, notary, admin, shared — целевая библиотека
<component_name> — имя компонента (дважды: путь и имя файла)
--standalone — standalone-компонент
Краткая форма:

```bash
pnpm nx g @nx/angular:component libs/web/guest/src/lib/features/my-component/my-component --standalone
```
