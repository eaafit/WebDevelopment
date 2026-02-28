import { Component } from '@angular/core';

type MonitoringSeverity = 'critical' | 'warning' | 'info' | 'success';

interface MonitoringEvent {
  id: string;
  dateLabel: string;
  timeLabel: string;
  actor: string;
  actorEmail: string;
  role: string;
  type: string;
  object: string;
  actionTitle: string;
  actionSubtitle: string;
  entityTitle: string;
  entitySubtitle: string;
  source: string;
  severity: MonitoringSeverity;
  severityLabel: string;
  security: boolean;
  location: string;
  ip: string;
  reason: string;
  before: string[];
  after: string[];
}

const AUDIT_EVENTS: MonitoringEvent[] = [
  {
    id: 'evt-1001',
    dateLabel: '28 фев 2026',
    timeLabel: '14:18',
    actor: 'Е.С. Деркач',
    actorEmail: 'admin@notary.local',
    role: 'Администратор',
    type: 'Изменение ролей',
    object: 'Пользователи',
    actionTitle: 'Изменение роли пользователя',
    actionSubtitle: 'Applicant -> Notary',
    entityTitle: 'Пользователь #U-1942',
    entitySubtitle: 'Раздел "Пользователи"',
    source: 'Web admin panel',
    severity: 'critical',
    severityLabel: 'Критично',
    security: true,
    location: 'Раздел "Пользователи и заказы"',
    ip: '10.14.7.18',
    reason: 'Ручная корректировка доступа',
    before: ['role: applicant', 'access_scope: base'],
    after: ['role: notary', 'access_scope: documents, orders'],
  },
  {
    id: 'evt-1002',
    dateLabel: '28 фев 2026',
    timeLabel: '13:42',
    actor: 'SuperLuchito',
    actorEmail: 'admin@notary.local',
    role: 'Администратор',
    type: 'Экспорт',
    object: 'Система',
    actionTitle: 'Экспорт журнала',
    actionSubtitle: 'CSV по фильтру "Безопасность"',
    entityTitle: 'Audit log export',
    entitySubtitle: '18 452 записи',
    source: 'Web admin panel',
    severity: 'warning',
    severityLabel: 'Предупреждение',
    security: true,
    location: 'Мониторинг и логи',
    ip: '10.14.7.18',
    reason: 'Служебная выгрузка для проверки инцидента',
    before: ['filters.security_only: false', 'filters.date_from: 2026-02-01'],
    after: ['filters.security_only: true', 'export.format: csv'],
  },
  {
    id: 'evt-1003',
    dateLabel: '28 фев 2026',
    timeLabel: '12:57',
    actor: 'Анастасия Е.',
    actorEmail: 'notary@notary.local',
    role: 'Нотариус',
    type: 'Операции с заказами',
    object: 'Заказы',
    actionTitle: 'Принят заказ в работу',
    actionSubtitle: 'Статус: New -> In Progress',
    entityTitle: 'Заказ #A-88349',
    entitySubtitle: 'Оценка недвижимости',
    source: 'Notary cabinet',
    severity: 'info',
    severityLabel: 'Инфо',
    security: false,
    location: 'Личный кабинет нотариуса',
    ip: '10.15.2.91',
    reason: 'Изменение статуса при начале обработки',
    before: ['status: new', 'assignee: null'],
    after: ['status: in_progress', 'assignee: notary_118'],
  },
  {
    id: 'evt-1004',
    dateLabel: '28 фев 2026',
    timeLabel: '11:06',
    actor: 'system',
    actorEmail: 'security-bot',
    role: 'Система',
    type: 'Безопасность',
    object: 'Пользователи',
    actionTitle: 'Блокировка подозрительного входа',
    actionSubtitle: '4 ошибки авторизации подряд',
    entityTitle: 'Пользователь #U-2011',
    entitySubtitle: 'IP: 91.214.44.18',
    source: 'Auth gateway',
    severity: 'critical',
    severityLabel: 'Критично',
    security: true,
    location: 'Шлюз авторизации',
    ip: '91.214.44.18',
    reason: 'Автоматическое правило antifraud',
    before: ['login_attempts: 3', 'status: active'],
    after: ['login_attempts: 4', 'status: temporarily_blocked'],
  },
  {
    id: 'evt-1005',
    dateLabel: '27 фев 2026',
    timeLabel: '19:24',
    actor: 'Евгений Т.',
    actorEmail: 'payments@notary.local',
    role: 'Администратор',
    type: 'Платежи',
    object: 'Платежи',
    actionTitle: 'Создание платежа',
    actionSubtitle: 'Ручная корректировка счета',
    entityTitle: 'Платеж #P-5104',
    entitySubtitle: '2 500 ₽',
    source: 'Admin / Payments',
    severity: 'success',
    severityLabel: 'Успешно',
    security: false,
    location: 'Платежный модуль',
    ip: '10.14.7.31',
    reason: 'Исправление реквизитов и перевыпуск счета',
    before: ['payment.status: pending', 'payment.amount: 0'],
    after: ['payment.status: created', 'payment.amount: 2500'],
  },
  {
    id: 'evt-1006',
    dateLabel: '27 фев 2026',
    timeLabel: '17:40',
    actor: 'Дмитрий Ч.',
    actorEmail: 'security@notary.local',
    role: 'Администратор',
    type: 'Безопасность',
    object: 'Система',
    actionTitle: 'Изменение политики сессий',
    actionSubtitle: 'TTL сессии сокращён с 12 до 8 часов',
    entityTitle: 'Security policy',
    entitySubtitle: 'Config / session',
    source: 'Admin / Settings',
    severity: 'warning',
    severityLabel: 'Предупреждение',
    security: true,
    location: 'Настройки безопасности',
    ip: '10.14.7.55',
    reason: 'Актуализация политики доступа',
    before: ['session.ttl_hours: 12', 'revoke_on_password_change: false'],
    after: ['session.ttl_hours: 8', 'revoke_on_password_change: true'],
  },
];

@Component({
  selector: 'lib-monitoring',
  imports: [],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.scss',
})
export class Monitoring {
  protected readonly chipOptions = ['Все события', 'Изменения ролей', 'Экспорт', 'Ошибки доступа'];
  protected readonly lastUpdated = 'сегодня, 14:20';
  protected readonly statusMessage = 'Демонстрационный макет журнала действий.';
  protected readonly summary = {
    total: AUDIT_EVENTS.length,
    critical: AUDIT_EVENTS.filter((event) => event.severity === 'critical').length,
    security: AUDIT_EVENTS.filter((event) => event.security).length,
    exports: AUDIT_EVENTS.filter((event) => event.type === 'Экспорт').length,
  };
  protected readonly events = AUDIT_EVENTS;
  protected readonly selectedEvent = AUDIT_EVENTS[0];
  protected readonly securityHighlights = AUDIT_EVENTS.filter((event) => event.security).slice(
    0,
    3,
  );
}
