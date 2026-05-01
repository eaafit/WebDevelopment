#!/usr/bin/env python3
"""
Скрипт для автоматического обновления всех курсовых заданий
на основе шаблона и примеров.
"""

import os
import re
from pathlib import Path

# Пути
BASE_DIR = Path(__file__).parent
TEMPLATE_FILE = BASE_DIR / "ШАБЛОН_курсового_задания_с_детализацией.md"
INSTRUCTION_FILE = BASE_DIR / "ИНСТРУКЦИЯ_по_обновлению_заданий.md"

# Примеры обновленных заданий (для reference)
UPDATED_EXAMPLES = [
    "Игорь Васильев — Регистрация Вход Восстановление пароля.md",
    "Иванова София — Личный кабинет заявителя.md",
    "Боховодинова Р.А. — UI оценка история заказов и статусов.md"
]

# Категории заданий и соответствующие сущности/API
ASSIGNMENT_CATEGORIES = {
    # UI модуль оценки недвижимости
    "UI оценка": {
        "entities": ["Assessment", "RealEstateObject", "Document", "User"],
        "api_prefix": "/api/assessments",
        "code_refs": ["libs/web/applicant/src/lib/features/", "libs/web/notary/src/lib/features/"],
        "external_services": ["Геокодирование", "Платежный шлюз"]
    },
    # Админ-панель
    "админ": {
        "entities": ["User", "Assessment", "Payment", "AuditLog", "TariffPlan"],
        "api_prefix": "/api/admin",
        "code_refs": ["libs/web/admin/src/lib/features/"],
        "external_services": ["SMTP", "Платежный шлюз"]
    },
    # Личные кабинеты
    "Личный кабинет": {
        "entities": ["User", "Assessment", "Document", "Subscription"],
        "api_prefix": "/api",
        "code_refs": ["libs/web/applicant/src/lib/features/", "libs/web/notary/src/lib/features/"],
        "external_services": ["Уведомления", "Платежи"]
    },
    # Платежи
    "Платежи": {
        "entities": ["Payment", "TariffPlan", "Subscription", "User", "Promo"],
        "api_prefix": "/api/payments",
        "code_refs": ["libs/web/applicant/src/lib/features/payments/"],
        "external_services": ["ЮKassa", "Сбербанк Онлайн", "Тинькофф"]
    },
    # Уведомления
    "Уведомления": {
        "entities": ["Notification", "User", "AuditLog"],
        "api_prefix": "/api/notifications",
        "code_refs": ["libs/api/notification/src/lib/"],
        "external_services": ["SMTP", "WebPush", "SMS-шлюз"]
    },
    # Чат поддержки
    "Чат": {
        "entities": ["User"],  # Концептуальные: Ticket, Message
        "api_prefix": "/api/support",
        "code_refs": ["libs/api/support/src/lib/"],
        "external_services": ["WebSocket", "Файловое хранилище"]
    },
    # Справочный раздел
    "справочный": {
        "entities": ["User"],  # Концептуальные: Article, Category
        "api_prefix": "/api/knowledge-base",
        "code_refs": ["libs/web/shared/src/lib/features/knowledge-base/"],
        "external_services": ["Поисковый индекс"]
    },
    # Landing page
    "Landing": {
        "entities": ["User"],  # Минимальная модель
        "api_prefix": "/api/landing",
        "code_refs": ["libs/web/guest/src/lib/features/"],
        "external_services": ["Аналитика", "CRM"]
    },
    # OAuth
    "OAuth": {
        "entities": ["User"],
        "api_prefix": "/api/auth",
        "code_refs": ["libs/api/auth/src/lib/"],
        "external_services": ["VK API", "Google OAuth", "Apple Sign-in", "Yandex ID"]
    }
}

def detect_assignment_category(filename):
    """Определяет категорию задания по названию файла."""
    filename_lower = filename.lower()

    for category, data in ASSIGNMENT_CATEGORIES.items():
        if category.lower() in filename_lower:
            return category, data

    # Определение по ключевым словам
    if any(word in filename_lower for word in ["оценк", "assessment", "недвижим"]):
        return "UI оценка", ASSIGNMENT_CATEGORIES["UI оценка"]
    elif any(word in filename_lower for word in ["админ", "admin"]):
        return "админ", ASSIGNMENT_CATEGORIES["админ"]
    elif any(word in filename_lower for word in ["личный кабинет", "кабинет"]):
        return "Личный кабинет", ASSIGNMENT_CATEGORIES["Личный кабинет"]
    elif any(word in filename_lower for word in ["платеж", "payment", "оплат"]):
        return "Платежи", ASSIGNMENT_CATEGORIES["Платежи"]
    elif any(word in filename_lower for word in ["уведомлен", "notification"]):
        return "Уведомления", ASSIGNMENT_CATEGORIES["Уведомления"]
    elif any(word in filename_lower for word in ["чат", "support", "поддержк"]):
        return "Чат", ASSIGNMENT_CATEGORIES["Чат"]
    elif any(word in filename_lower for word in ["справочн", "faq", "knowledge"]):
        return "справочный", ASSIGNMENT_CATEGORIES["справочный"]
    elif any(word in filename_lower for word in ["landing", "лендинг"]):
        return "Landing", ASSIGNMENT_CATEGORIES["Landing"]
    elif "oauth" in filename_lower:
        return "OAuth", ASSIGNMENT_CATEGORIES["OAuth"]

    return "Общее", {
        "entities": ["User", "Assessment"],
        "api_prefix": "/api",
        "code_refs": ["libs/web/shared/src/lib/features/"],
        "external_services": []
    }

def extract_student_info(filename):
    """Извлекает информацию о студенте из названия файла."""
    # Формат: "Фамилия И.О. — Описание задания.md"
    match = re.match(r"^(.+?) — (.+)\.md$", filename)
    if match:
        student_name = match.group(1).strip()
        assignment_title = match.group(2).strip()
        return student_name, assignment_title
    return "Студент", filename.replace(".md", "")

def read_template():
    """Читает шаблон задания."""
    with open(TEMPLATE_FILE, 'r', encoding='utf-8') as f:
        return f.read()

def generate_api_methods(category_data, assignment_title):
    """Генерирует примеры API-методов для категории."""
    api_prefix = category_data["api_prefix"]

    base_methods = [
        {
            "method": "GET",
            "endpoint": f"{api_prefix}/",
            "description": "Получить список",
            "params": "page, limit, filters",
            "response": "Item[]"
        },
        {
            "method": "POST",
            "endpoint": f"{api_prefix}/",
            "description": "Создать новый",
            "params": "CreateDto",
            "response": "Item"
        },
        {
            "method": "GET",
            "endpoint": f"{api_prefix}/{{id}}",
            "description": "Получить по ID",
            "params": "id",
            "response": "Item"
        },
        {
            "method": "PUT",
            "endpoint": f"{api_prefix}/{{id}}",
            "description": "Обновить",
            "params": "id, UpdateDto",
            "response": "Item"
        },
        {
            "method": "DELETE",
            "endpoint": f"{api_prefix}/{{id}}",
            "description": "Удалить",
            "params": "id",
            "response": "{success: boolean}"
        }
    ]

    # Специфичные методы для категорий
    if category_data.get("category") == "UI оценка":
        base_methods.extend([
            {
                "method": "POST",
                "endpoint": f"{api_prefix}/{{id}}/documents",
                "description": "Загрузить документ",
                "params": "id, file, category",
                "response": "Document"
            },
            {
                "method": "GET",
                "endpoint": f"{api_prefix}/{{id}}/status",
                "description": "Получить статус",
                "params": "id",
                "response": "StatusInfo"
            }
        ])
    elif category_data.get("category") == "Платежи":
        base_methods.extend([
            {
                "method": "POST",
                "endpoint": f"{api_prefix}/{{id}}/confirm",
                "description": "Подтвердить платеж",
                "params": "id, confirmationData",
                "response": "Payment"
            },
            {
                "method": "GET",
                "endpoint": f"{api_prefix}/history",
                "description": "История платежей",
                "params": "userId, dateFrom, dateTo",
                "response": "Payment[]"
            }
        ])

    return base_methods

def generate_updated_content(filename, student_name, assignment_title, category, category_data):
    """Генерирует обновленное содержание задания."""

    # Читаем оригинальный файл
    original_file = BASE_DIR / filename
    original_content = ""
    if original_file.exists():
        with open(original_file, 'r', encoding='utf-8') as f:
            original_content = f.read()

    # Извлекаем зону ответственности из оригинального контента
    responsibility_match = re.search(r"Зона ответственности.*?`docs/Responsobility\.md`\s*\(([^)]+)\)", original_content)
    responsibility = responsibility_match.group(1) if responsibility_match else "описание из матрицы ответственности"

    # Генерируем API методы
    api_methods = generate_api_methods(category_data, assignment_title)

    # Формируем обновленное содержание
    updated_content = f"""# Курсовое задание: {student_name} — {assignment_title}

## Основная информация
- **Студент:** {student_name}
- **Репозиторий проекта:** https://github.com/eaafit/WebDevelopment
- **Ветка для работы:** feature/{category.lower().replace(' ', '-')} (или указать свою)
- **Зона ответственности:** `docs/Responsobility.md` ({responsibility})
- **Ссылки на код:**
  - Frontend: {category_data['code_refs'][0] if category_data['code_refs'] else 'указать путь'}
  - API: libs/api/{category.lower().replace(' ', '-')}/src/lib/ (если существует)
  - Контракты: `libs/shared/api-contracts/proto/notary/{category.lower().replace(' ', '-')}/`

---

## Раздел 1. Модель развертывания системы (≈2 стр.)

### 1.1. Диаграмма развертывания UML
**Требования к диаграмме:**
- Отобразить все компоненты системы: клиент Angular, API-сервер, PostgreSQL, файловое хранилище
- Показать внешние сервисы: {', '.join(category_data['external_services']) if category_data['external_services'] else 'платежный шлюз, SMTP-сервер'}
- Указать порты и протоколы взаимодействия
- Выделить компонент, за который отвечает студент

**Пример компонентов для отображения:**
- Клиентское приложение (Angular) на порту 4200
- API-сервер (NestJS) на порту 3000
- PostgreSQL на порту 5432
- Файловое хранилище (S3/MinIO)
- Внешние сервисы: {', '.join(category_data['external_services'][:2]) if category_data['external_services'] else 'ЮKassa, SendGrid'}

### 1.2. Описание развертывания на виртуальном сервере
**Что описать:**
1. **Контейнеризация:** использование Docker Compose (`docker-compose.yaml`)
2. **Переменные окружения:** ключевые переменные из `.env.example`
3. **Порты и сеть:** схема взаимодействия между контейнерами
4. **Хранение данных:** volumes для БД и файлов
5. **Резервное копирование:** подход к бэкапам БД
6. **Мониторинг:** использование Grafana/Prometheus (если настроено)

**Ссылки на материалы:**
- `README.md` — общее описание проекта
- `apps/web/Dockerfile` — сборка фронтенда
- `apps/web/DOCKER.md` — инструкции по развертыванию
- `docker-compose.yaml` — конфигурация окружения

---

## Раздел 2. Ваш компонент (≈4 стр.)

### 2.1. Диаграмма классов UML
**Требования:**
- Использовать сущности из `docs/entities.md`: {', '.join(category_data['entities'][:3])}
- Показать все поля сущностей, относящиеся к компоненту
- Указать типы данных, ограничения (unique, not null)
- Показать связи между сущностями (1:1, 1:N, N:M)
- Включить enum-типы с допустимыми значениями

**Пример для сущности:**
```plaintext
{category_data['entities'][0] if category_data['entities'] else 'User'}
---
- Id: UUID (PK)
- Name: string (not null)
- CreatedAt: timestamp
- UpdatedAt: timestamp
```

### 2.2. Диаграмма компонентов UML
**Требования:**
- Показать взаимодействие фронтенд-компонента с бэкенд-сервисами
- Указать API-методы (REST или gRPC)
- Показать внешние зависимости: {', '.join(category_data['external_services'][:2]) if category_data['external_services'] else 'сторонние API'}
- Отобразить поток данных между компонентами

### 2.3. API-методы и endpoints
**Список обязательных API-методов для реализации:**

| Метод | Endpoint | Описание | Параметры | Ответ |
|-------|----------|----------|-----------|--------|
"""

    # Добавляем API методы в таблицу
    for method in api_methods[:7]:  # Ограничиваем 7 методами
        updated_content += f"| {method['method']} | `{method['endpoint']}` | {method['description']} | `{method['params']}` | `{method['response']}` |\n"

    updated_content += f"""
**Ссылки на существующий код:**
- Контракты API: `libs/shared/api-contracts/proto/notary/{category.lower().replace(' ', '-')}/`
- Сервисы: `libs/api/{category.lower().replace(' ', '-')}/src/lib/` (если существует)
- DTO-модели: [указать путь]

---

## Раздел 3. UI компонента (≈5 стр.)

### 3.1. Требования к интерфейсу
**Обязательные экраны/компоненты:**
1. [Название экрана 1] — [краткое описание]
2. [Название экрана 2] — [краткое описание]
3. [Название экрана 3] — [краткое описание]

**Функциональные требования:**
- Валидация форм: [описать правила валидации]
- Фильтрация данных: [по каким полям]
- Сортировка: [по каким полям]
- Поиск: [тип поиска]
- Пагинация: [требования]

### 3.2. Бизнес-правила
**Для роли [Роль]:**
1. [Правило 1]
2. [Правило 2]
3. [Правило 3]

**Ограничения доступа:**
- Кто может просматривать: [роли]
- Кто может редактировать: [роли]
- Кто может удалять: [роли]

### 3.3. Скриншоты UI
**Требования к скриншотам:**
- Минимум 3 скриншота ключевых экранов
- Аннотации к элементам интерфейса
- Показать различные состояния (пустой список, с данными, загрузка, ошибка)

### 3.4. Руководство пользователя
**Пошаговая инструкция:**
1. **Шаг 1:** [Описание действия]
   - Что делает пользователь
   - Что происходит в системе
   - Ожидаемый результат

2. **Шаг 2:** [Описание действия]
   - Что делает пользователь
   - Что происходит в системе
   - Ожидаемый результат

**Типичные сценарии использования:**
- Сценарий 1: [Название]
- Сценарий 2: [Название]
- Сценарий 3: [Название]

---

## Раздел 4. Критерии оценки

### 4.1. Технические критерии
- [ ] Диаграмма развертывания соответствует архитектуре проекта
- [ ] Диаграмма классов использует сущности из `entities.md`
- [ ] Диаграмма компонентов отражает реальные зависимости
- [ ] Реализованы все указанные API-методы
- [ ] Код соответствует code style проекта
- [ ] Написаны unit-теты (минимум 70% coverage)

### 4.2. Функциональные критерии
- [ ] Реализованы все обязательные экраны
- [ ] Работает валидация форм
- [ ] Реализована фильтрация и сортировка
- [ ] Корректная обработка ошибок
- [ ] Адаптивный дизайн (mobile/desktop)

### 4.3. Документационные критерии
- [ ] Скриншоты соответствуют реализации
- [ ] Руководство пользователя понятное и полное
- [ ] Описаны бизнес-правила и ограничения доступа
- [ ] Указаны ссылки на существующий код

---

## Полезные ссылки

### Документация проекта
- `docs/entities.md` — описание сущностей БД
- `docs/Responsobility.md` — матрица ответственности
- `docs/US.md` — пользовательские истории
- `docs/developer-setup.md` — настройка окружения

### Существующий код
- **Frontend компоненты:** `libs/web/[роль]/src/lib/features/`
- **API сервисы:** `libs/api/[модуль]/src/lib/`
- **Контракты:** `libs/shared/api-contracts/proto/`
- **Схема БД:** `libs/api/shared/prisma/schema.prisma`

### Инструменты разработки
- **Запуск проекта:** `pnpm start`
- **Тестирование:** `pnpm test`
- **Линтинг:** `pnpm lint`
- **Сборка:** `pnpm build`

---

*Задание обновлено с детализацией требований. Используйте шаблон `ШАБЛОН_курсового_задания_с_детализацией.md` для заполнения.*
    """

    return updated_content

def main():
    """Основная функция скрипта."""
    print("Скрипт обновления курсовых заданий")
    print("=" * 50)

    # Получаем список всех файлов заданий
    assignment_files = []
    for file in BASE_DIR.glob("*.md"):
        if file.name not in ["ШАБЛОН_курсового_задания_с_детализацией.md",
                           "ИНСТРУКЦИЯ_по_обновлению_заданий.md",
                           "update_all_assignments.py"]:
            if file.name not in UPDATED_EXAMPLES:  # Пропускаем уже обновленные
                assignment_files.append(file.name)

    print(f"Найдено заданий для обновления: {len(assignment_files)}")

    for i, filename in enumerate(assignment_files, 1):
        print(f"\n[{i}/{len(assignment_files)}] Обработка: {filename}")

        # Определяем категорию
        category, category_data = detect_assignment_category(filename)
        student_name, assignment_title = extract_student_info(filename)

        print(f"  Категория: {category}")
        print(f"  Студент: {student_name}")
        print(f"  Задание: {assignment_title}")

        # Генерируем обновленное содержание
        updated_content = generate_updated_content(
            filename, student_name, assignment_title, category, category_data
        )

        # Сохраняем обновленный файл
        output_file = BASE_DIR / filename
        backup_file = BASE_DIR / f"{filename}.backup"

        # Создаем backup оригинального файла
        if output_file.exists():
            import shutil
            shutil.copy2(output_file, backup_file)
            print(f"  Создан backup: {backup_file.name}")

        # Сохраняем обновленный файл
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(updated_content)

        print(f"  Файл обновлен: {output_file.name}")

    print("\n" + "=" * 50)
    print("Обновление завершено!")
    print(f"Обновлено заданий: {len(assignment_files)}")
    print(f"Всего обновленных заданий (включая примеры): {len(assignment_files) + len(UPDATED_EXAMPLES)}")
    print("\nСтуденты могут использовать инструкцию в файле:")
    print("ИНСТРУКЦИЯ_по_обновлению_заданий.md")

if __name__ == "__main__":
    main()
