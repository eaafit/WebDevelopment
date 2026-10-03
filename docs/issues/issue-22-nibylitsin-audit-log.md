---
title: '[ADMIN] История действий и аудит — лента событий, фильтры, экспорт'
labels: ['frontend', 'admin', 'audit', 'logs']
assignees: ['SuperLuchito']
---

## Описание

Интерфейс аудита действий в панели администратора: хронологическая лента событий (кто/что/когда), фильтрация, экспорт.

> **Разработчики:** Нибылицын Лукьян (SuperLuchito) — лента аудита, фильтры, экспорт.  
> Черненко Дмитрий (getpaintoo) (issue-23) — просмотр логов по пользователю/заказу, события безопасности.

## Затронутые роли

- Администратор
- Нотариус (частично — только свои заказы)

## Экраны / компоненты

- [ ] **Страница аудита** (`/admin/monitoring`) — таблица событий: иконка типа, описание действия, исполнитель (ФИО/email), целевой объект (пользователь/заказ), дата/время
- [ ] **Панель фильтров** — по типу события, исполнителю, дате (диапазон), целевому объекту (ID)
- [ ] **Точные фильтры** — по `actor_user_id` и `target_id`; для заявки `target_id` равен `assessment.id`
- [ ] **Детали события** — раскрываемая строка или боковая панель: diff значений до/после, IP-адрес, user-agent
- [ ] **Экспорт** — кнопка «Выгрузить CSV» по текущим фильтрам
- [ ] **Вид для нотариуса** — лента событий только по заказам данного нотариуса

## Технические требования

- Маршруты: `/admin/monitoring`, `/notary/monitoring` (ограниченный вид)
- Защита: `roleGuard(UserRole.Admin)` / `roleGuard(UserRole.Notary)`
- RPC: `AuditService` (согласовать с бэкендом — proto существует: `audit_pb.ts`)
- Методы RPC: `ListAuditEvents`, `ExportAuditEvents`
- Серверная пагинация, debounced-фильтры
- Экспорт CSV: данные запрашиваются через backend `ExportAuditEvents`, клиент формирует CSV (`Blob`)
- AuditLog использует универсальные `entity_name` + `entity_id`; для событий заявки: `entity_name = Assessment`, `entity_id = id заявки`
- `/notary/monitoring` ограничивает выборку заявками текущего нотариуса через список его assessments и `entity_id`; события с `entity_name = Payment` остаются admin-only
- Payment audit по заявке пишет target `Assessment`, а настоящий `paymentId` хранит в `details`
- `audit.exported` по конкретной заявке пишет target `Assessment`/`target_id`; общий notary-wide export остаётся admin-visible global event, потому что лента нотариуса намеренно ограничена владением заявками
- Issue 22 не включает security events, страницу безопасности, техническое JSON-логирование, Pino, request-id, Loki/Grafana

## Acceptance criteria

- [ ] Таблица показывает все события с пагинацией
- [ ] Фильтры по типу, исполнителю, `actor_user_id`, `target_id` и дате корректно ограничивают выборку
- [ ] Детали события раскрываются inline без перехода на другую страницу
- [ ] CSV-экспорт скачивается с текущими фильтрами
- [ ] Экспорт ограничен backend cap и сам записывается в audit trail как `audit.exported`
- [ ] Нотариус видит только события своих заказов

## Связанные файлы

- `libs/web/admin/src/lib/features/monitoring/`
- `libs/web/notary/src/lib/features/monitoring/`
- `libs/web/shared/ui/src/lib/audit-monitoring/`
- `libs/api/audit/`
- Proto: `libs/shared/api-contracts/proto/notary/audit/v1alpha1/audit.proto`

## Не входит в issue 22

- Issue 23: security events, отдельная security page, просмотр логов по пользователю/заказу вне audit trail.
- Issue 32/33: технические process logs, Pino, request-id, Loki/Grafana.
