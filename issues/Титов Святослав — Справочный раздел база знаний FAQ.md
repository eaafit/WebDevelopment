# Титов Святослав (TandZir0) — Справочный раздел: база знаний и FAQ

## Контекст
- **Разделы:** `/faq`, `/applicant/faq`, `/notary/faq`  
- **Роли:** Все пользователи  
- **Связан с:** Рахманов Рахман (поиск по статьям с расширенными фильтрами)  
- **Связанные файлы:** `libs/web/shared/ui/src/lib/`, `libs/web/guest/src/lib/`

---

## Задача
Реализовать страницу справочного раздела: структура категорий, карточки статей, просмотр статьи.

---

## Маршруты

| Маршрут | Компонент | Описание |
|---|---|---|
| `/faq` | `FaqPageComponent` | Главная справочника (гость) |
| `/applicant/faq` | `FaqPageComponent` | То же в кабинете заявителя |
| `/notary/faq` | `FaqPageComponent` | То же в кабинете нотариуса |
| `/faq/:slug` | `FaqArticleComponent` | Просмотр статьи |

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/faq/faq-page/faq-page --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/faq/faq-article/faq-article --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/faq/faq-category/faq-category --standalone
```

Экспортировать из `libs/web/shared/ui/src/index.ts`.

---

## API-контракты
FAQ-сервис в proto **не реализован**. Работать на **статических mock-данных**.

---

## Mock-структура

```typescript
export interface FaqCategory {
  id: string;
  title: string;
  icon: string;
  description: string;
}

export interface FaqArticle {
  id: string;
  slug: string;
  title: string;
  categoryId: string;
  author: string;
  publishedAt: string;
  content: string;         // markdown или HTML-строка
  tags: string[];
  views: number;
}
```

**Категории (минимум 5):**
- «Начало работы», «Подача заявки», «Оплата», «Документы», «Технические вопросы»

**Статьи (минимум 15):** по 3 в каждой категории. Реалистичный текст (2–4 абзаца).

---

## Ключевые функции

### Главная FAQ (`/faq`)
- **Шапка:** заголовок «Справочный раздел», короткая строка поиска (ведёт к Рахманову)
- **Сетка категорий:** карточки `FaqCategoryComponent` — иконка, название, количество статей
- **Популярные статьи:** блок «Часто просматриваемые» — 5 статей по `views`
- Клик по категории → фильтрует статьи этой категории (inline, без перехода)
- Клик по статье → `/faq/:slug`

### Просмотр статьи (`/faq/:slug`)
- Хлебные крошки: «Справочник → [Категория] → [Название статьи]»
- Заголовок, автор, дата публикации
- Тело статьи (HTML из mock — использовать `[innerHTML]`)
- Теги — кликабельные (фильтрация по тегу в списке)
- Кнопки: «← Назад», «Была ли статья полезна?» (Да/Нет, mock)
- Блок «Читайте также»: 3 рандомных статьи из той же категории

---

## Технические требования
- Данные из `faq.mock.ts` — не хардкодить в шаблонах
- Экспортировать компоненты из `@notary-portal/ui`
- Подключить к маршрутам guest, applicant и notary
- Поиск в шапке передаёт query-param в Рахманов: `router.navigate(['/faq'], { queryParams: { q: query } })`

---

## Критерии готовности
- [ ] Главная FAQ с сетками категорий
- [ ] Популярные статьи отображаются
- [ ] Фильтрация по категории inline работает
- [ ] Страница статьи по slug
- [ ] Хлебные крошки
- [ ] Блок «Читайте также»
- [ ] Responsive layout
