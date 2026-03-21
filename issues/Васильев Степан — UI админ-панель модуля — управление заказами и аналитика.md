# Васильев Степан — Администратор: управление очередью оценок и метрики

## Контекст
- **Раздел:** `/admin/statistics` — аналитика модуля оценки  
- **Роли:** Администратор  
- **Связан с:** Гущина Мария (та же страница, разные части)  
- **Связанные файлы:** `libs/web/admin/src/lib/`

---

## Задача
Реализовать страницу управления очередью оценок и метрик: очередь ожидающих, ручная модерация, дашборд конверсии/времени обработки.

---

## Маршрут

| Маршрут | Компонент | Описание |
|---|---|---|
| `/admin/statistics` | `AdminStatisticsComponent` | Аналитика и очередь |

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/admin/src/lib/features/statistics/admin-statistics/admin-statistics --standalone
pnpm nx g @nx/angular:component libs/web/admin/src/lib/features/statistics/assessment-queue/assessment-queue --standalone
pnpm nx g @nx/angular:component libs/web/admin/src/lib/features/statistics/metrics-dashboard/metrics-dashboard --standalone
```

---

## API-контракты (`@notary-portal/api-contracts`)

| Метод | Запрос | Ответ | Где |
|---|---|---|---|
| `AssessmentService.listAssessments` | `{ filters: { status: 'New' }, pagination }` | `{ assessments[], meta }` | Очередь ожидающих |
| `AssessmentService.listAssessments` | `{ pagination: { limit: 200 } }` | `{ assessments[], meta: { totalItems } }` | Метрики |
| `AssessmentService.verifyAssessment` | `{ id, notaryId }` | `{ assessment }` | Ручное назначение |
| `UserService.listUsers` | `{ roleFilter: 'Notary' }` | `{ users[] }` | Список нотариусов для назначения |

---

## Ключевые функции

### `AssessmentQueueComponent` — очередь ожидающих

- Таблица заявок со статусом `New`:
  - Адрес, тип имущества, дата подачи, «ожидает [N] часов»
  - Колонка «Время ожидания» → окрасить красным если > 24ч, жёлтым > 12ч
- Кнопка **«Назначить нотариуса»**:
  - Открывает диалог — select из `UserService.listUsers(roleFilter: Notary)` 
  - После выбора → `verifyAssessment({ id, notaryId: selectedNotaryId })`
- Кнопка **«Отклонить»** → `cancelAssessment` с полем «Причина»
- Пагинация

### `MetricsDashboardComponent` — метрики

**Плитки KPI** (верхний ряд):
- Всего заявок
- Конверсия в завершённые: `(completed / total * 100).toFixed(1)%`
- Среднее время обработки (mock: 3.5 дня)
- Активных нотариусов (из `listUsers`)

**График «Заявки по статусам»** (горизонтальные bar'ы):
- Реализовать без библиотек: `div` с `width: ${percent}%` + inline цвета по статусу
- Данные: подсчёт из `listAssessments` по полю `status`

**Таблица «Топ нотариусов»** (mock):
| Нотариус | Заявок завершено | Среднее время | Рейтинг |
|---|---|---|---|
| ... | ... | ... | ... |

---

## Технические требования
- Вычисление метрик: `computed()` сигналы из загруженных данных
- Mock среднего времени и рейтингов нотариусов — реалистичные числа
- Обновить `admin.routes.ts`

---

## Критерии готовности
- [ ] Очередь новых заявок загружается из API
- [ ] Цветовая индикация по времени ожидания работает
- [ ] Назначение нотариуса через API
- [ ] Плитки KPI с реальными данными
- [ ] Bar-график статусов
- [ ] Таблица топ-нотариусов с mock-данными
