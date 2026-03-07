# Дятлова Анна — Модуль оценки: таблица запросов на оценку (список и редактирование)

## Контекст
- **Разделы:** `/applicant/assessment/history`, `/notary/assessment`  
- **Роли:** Заявитель / Нотариус  
- **Связан с:** Бурцева Мария (форма создания), Боховодинова (таймлайн истории)  
- **Связанные файлы:** `libs/web/applicant/src/lib/`, `libs/web/notary/src/lib/`

---

## Задача
Реализовать таблицу со списком запросов на оценку (_RUD — Read, Update, Delete): просмотр, редактирование параметров, удаление черновиков.

---

## Маршруты

| Маршрут | Компонент | Описание |
|---|---|---|
| `/applicant/assessment` | Переиспользует `AssessmentWizardComponent` | Визард содержит таблицу как вкладку |
| `/applicant/assessment/:id/edit` | `AssessmentEditFormComponent` | Редактирование существующего запроса |

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/assessment/assessment-table/assessment-table --standalone
pnpm nx g @nx/angular:component libs/web/applicant/src/lib/features/assessment/assessment-edit/assessment-edit --standalone
```

---

## API-контракты (`@notary-portal/api-contracts`)

| Метод | Запрос | Ответ | Где |
|---|---|---|---|
| `AssessmentService.listAssessments` | `{ filters: { userId или notaryId }, pagination }` | `{ assessments[], meta }` | Таблица запросов |
| `AssessmentService.getAssessment` | `{ id }` | `{ assessment }` | Редактирование |
| `AssessmentService.updateAssessment` | `UpdateAssessmentRequest { id, address?, description?, ... }` | `{ assessment }` | Сохранение изменений |

---

## Ключевые функции

### `AssessmentTableComponent` (shared)

**Входные параметры:**
- `@Input() userId?: string` — для кабинета заявителя
- `@Input() notaryId?: string` — для кабинета нотариуса
- `@Input() showEditActions: boolean = false` — для заявителя показывать кнопки редактирования

**Таблица:**
- Колонки: Адрес, Тип объекта, Площадь (кв. м), Статус, Дата создания, Дата обновления
- Статусы с цветными бейджами
- Сортировка по колонкам (клиентская)
- Фильтр по статусу (select над таблицей)
- Пагинация

**Действия в строке:**
- «Просмотр» → `/applicant/orders/:id` или `/notary/orders/:id`
- «Редактировать» (только для Заявителя, только для статусов `New`, `Draft`) → `/applicant/assessment/:id/edit`
- «Удалить» (только для Заявителя, только статус `New` / `Draft`) → диалог подтверждения → TODO (метод удаления не реализован в proto)

**Пустой стейт:**
- «Запросов на оценку пока нет» + кнопка «Создать первый запрос»

### `AssessmentEditFormComponent`
- Загружает данные через `AssessmentService.getAssessment`
- Форма с теми же полями что у Бурцевой (переиспользовать `AssessmentParamsFormComponent`)
- Дополнительно: поле «Причина изменения» (textarea, необязательно)
- Кнопки: «Сохранить изменения» → `updateAssessment`, «Отмена» → back

---

## Технические требования
- `AssessmentTableComponent` экспортировать из `@notary-portal/ui`
- Сортировка: `signal<{ column: string; direction: 'asc' | 'desc' } | null>`
- Клик по заголовку колонки → меняет сортировку
- Обновить `applicant.routes.ts`:
  ```typescript
  { path: 'assessment/:id/edit', component: AssessmentEditFormComponent }
  ```

---

## Критерии готовности
- [ ] Таблица загружается из API с пагинацией
- [ ] Сортировка по колонкам работает
- [ ] Фильтр по статусу работает
- [ ] Форма редактирования заполняется данными запроса
- [ ] `updateAssessment` вызывается при сохранении
- [ ] Mock-удаление с диалогом подтверждения
- [ ] Пустой стейт с кнопкой создания
