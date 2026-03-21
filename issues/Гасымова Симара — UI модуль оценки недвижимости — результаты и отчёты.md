# Гасымова Симара — Модуль оценки: результаты, итоговая стоимость, отчёты

## Контекст
- **Разделы:** `/applicant/assessment/results/:assessmentId`, `/notary/assessment` (просмотр результата)  
- **Роли:** Заявитель / Нотариус  
- **Связан с:** Золотухин Артём (скачивание копий), Боховодинова (история)  
- **Связанные файлы:** `libs/web/shared/ui/src/lib/`

---

## Задача
Реализовать страницу результатов оценки: итоговая стоимость с диапазоном/уверенностью, сравнение с рынком, блок отчётов, скачивание, комментарии.

---

## Маршрут

| Маршрут | Компонент | Описание |
|---|---|---|
| `/applicant/assessment/results/:id` | `AssessmentResultPageComponent` | Страница результата (заявитель) |

> Нотариус видит результат через `/notary/orders/:id` — там переиспользовать этот же компонент.

---

## Генерация компонентов

```bash
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/assessment/result-page/result-page --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/assessment/result-value-card/result-value-card --standalone
pnpm nx g @nx/angular:component libs/web/shared/ui/src/lib/assessment/market-comparison/market-comparison --standalone
```

Экспортировать из `@notary-portal/ui`.

---

## API-контракты (`@notary-portal/api-contracts`)

| Метод | Запрос | Ответ | Где |
|---|---|---|---|
| `AssessmentService.getAssessment` | `{ id }` | `{ assessment }` | Итоговая стоимость, данные объекта |
| `ReportService.listReports` | `{ assessmentId }` | `{ reports[] }` | Список отчётов |
| `ReportService.getReport` | `{ id }` | `{ report }` | Детали отчёта |

> **Важно:** `ReportService` **не экспортируется** из `@notary-portal/api-contracts`.  
> Использовать **mock-данные** для блока отчётов с TODO-комментарием.

---

## Ключевые функции

### `ResultValueCardComponent` — главный блок с итогом

- **Итоговая рыночная стоимость** — крупный шрифт, `finalEstimatedValue` из `Assessment`
  - Форматировать: `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`
- **Диапазон стоимости** (mock: ±10% от итогового значения):
  - «от [min] до [max]»
- **Уровень уверенности** (mock: 85%) — прогресс-бар + процент
- Адрес, тип объекта, площадь, дата оценки

### `MarketComparisonComponent` — сравнение с рынком

Mock-данные (простая таблица):
| Показатель | Ваш объект | Средний по рынку |
|---|---|---|
| Цена за кв. м | [рассчитать] | [mock] |
| Стоимость | [итог] | [±5%] |

- Дополнительно: горизонтальный bar-chart через inline CSS (без библиотек) или через SVG
- Подпись «Данные рыночного анализа носят информационный характер»

### Блок «Детализация расчёта»

Mock-таблица факторов (разворачивается по кнопке):
| Фактор | Значение | Весовой коэффициент | Вклад |
|---|---|---|---|
| Площадь | 75 кв. м | 0.35 | +XX XXX ₽ |
| Состояние | Хорошее | 0.20 | +XX XXX ₽ |
| Этаж | 5/9 | 0.10 | -X XXX ₽ |
| … | … | … | … |

- «Итого: [finalEstimatedValue]»
- Пометка «Детализация является приблизительной»

### Блок «Отчёты»
- Список mock-отчётов (см. mock-структуру из задания Золотухина)
- Статус `Signed` → кнопка «Скачать PDF» (href mock)
- Статус `Draft` → «Ожидает подписания нотариусом»
- Кнопка «Запросить официальную копию» → `/applicant/copies` (Имамов)

### Блок «Комментарии»
- Список mock-комментариев (3–4 записи с датами)
- Форма добавления комментария: textarea + кнопка «Добавить» (mock)

---

## Технические требования
- `@Input() assessmentId: string` или загружать из маршрута через `ActivatedRoute`
- Форматирование суммы через `Intl.NumberFormat`
- Bar-chart: `div` с `width: ${percent}%` в inline style

---

## Критерии готовности
- [ ] Итоговая стоимость загружается из API
- [ ] Диапазон и уровень уверенности (mock)
- [ ] Сравнение с рынком — таблица + bar-chart
- [ ] Детализация расчёта разворачивается
- [ ] Блок отчётов с mock-данными
- [ ] Блок комментариев с mock-добавлением
- [ ] Responsive layout
