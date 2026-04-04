---
title: '[ASSESSMENT] Просмотр результатов оценки'
labels: ['frontend', 'assessment', 'results', 'applicant', 'notary']
assignees: []
---

## Описание

Экраны просмотра результатов оценки: карточка с итоговой стоимостью, детализация расчёта, отчёты в PDF, скачивание копий.

## Затронутые роли

- Заявитель
- Нотариус

## Экраны / компоненты

- [ ] **Карточка результата оценки** (`/applicant/assessment/results/:id` и `/notary/assessment/results/:id`) — итоговая стоимость объекта, дата оценки, нотариус, статус отчёта
- [ ] **Детализация расчёта** — раскрываемая секция: методология, аналоги, поправочные коэффициенты
- [ ] **Список отчётов** — прикреплённые отчёты (AssessmentReport): название, дата, статус подписи; кнопка скачать PDF
- [ ] **Скачивание PDF** — скачивание отчёта по ссылке/потоку с прогресс-индикатором
- [ ] **Пустое состояние** — если оценка ещё не завершена, показать статус и ожидаемые сроки

## Технические требования

- Маршруты: `/applicant/assessment/results/:id`, `/notary/assessment/results/:id`
- Защита: `roleGuard(UserRole.Applicant)` / `roleGuard(UserRole.Notary)` соответственно
- RPC: `AssessmentService.Get`, `ReportService.List`, `ReportService.Get`
- PDF скачивание: через ссылку (`<a href="..." download>`) или `Blob` из API
- Модель: `AssessmentReport` (status: Draft | Signed)

## Acceptance criteria

- [ ] Карточка отображает итоговую стоимость и все ключевые поля
- [ ] Детализация расчёта раскрывается/скрывается по клику
- [ ] Список отчётов показывает статус подписи каждого отчёта
- [ ] Кнопка «Скачать PDF» инициирует загрузку файла
- [ ] Если оценка ещё в процессе — видно статус и ориентировочные сроки

## Связанные файлы

- `libs/web/applicant/src/lib/features/assessment/results/`
- `libs/web/notary/src/lib/features/assessment/results/`
- Proto-контракты: `AssessmentService`, `ReportService`
