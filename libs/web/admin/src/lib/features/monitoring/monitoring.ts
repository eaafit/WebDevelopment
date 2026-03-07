import { Component, computed, signal } from '@angular/core';

type MonitoringSeverity = 'critical' | 'warning' | 'info' | 'success';
type MonitoringChip = 'all' | 'role' | 'export' | 'access';

interface MonitoringFilters {
  query: string;
  dateFrom: string;
  dateTo: string;
  role: string;
  type: string;
  object: string;
  severity: string;
  securityOnly: boolean;
}

interface MonitoringEvent {
  id: string;
  dateIso: string;
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
  chip: MonitoringChip;
  location: string;
  ip: string;
  reason: string;
  before: string[];
  after: string[];
}

const DEFAULT_FILTERS: MonitoringFilters = {
  query: '',
  dateFrom: '2026-02-01',
  dateTo: '2026-02-28',
  role: 'all',
  type: 'all',
  object: 'all',
  severity: 'all',
  securityOnly: false,
};

const AUDIT_EVENTS: MonitoringEvent[] = [
  {
    id: 'evt-1001',
    dateIso: '2026-02-28',
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
    chip: 'role',
    location: 'Раздел "Пользователи и заказы"',
    ip: '10.14.7.18',
    reason: 'Ручная корректировка доступа',
    before: ['role: applicant', 'access_scope: base'],
    after: ['role: notary', 'access_scope: documents, orders'],
  },
  {
    id: 'evt-1002',
    dateIso: '2026-02-28',
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
    chip: 'export',
    location: 'Мониторинг и логи',
    ip: '10.14.7.18',
    reason: 'Служебная выгрузка для проверки инцидента',
    before: ['filters.security_only: false', 'filters.date_from: 2026-02-01'],
    after: ['filters.security_only: true', 'export.format: csv'],
  },
  {
    id: 'evt-1003',
    dateIso: '2026-02-28',
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
    chip: 'all',
    location: 'Личный кабинет нотариуса',
    ip: '10.15.2.91',
    reason: 'Изменение статуса при начале обработки',
    before: ['status: new', 'assignee: null'],
    after: ['status: in_progress', 'assignee: notary_118'],
  },
  {
    id: 'evt-1004',
    dateIso: '2026-02-28',
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
    chip: 'access',
    location: 'Шлюз авторизации',
    ip: '91.214.44.18',
    reason: 'Автоматическое правило antifraud',
    before: ['login_attempts: 3', 'status: active'],
    after: ['login_attempts: 4', 'status: temporarily_blocked'],
  },
  {
    id: 'evt-1005',
    dateIso: '2026-02-27',
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
    chip: 'all',
    location: 'Платежный модуль',
    ip: '10.14.7.31',
    reason: 'Исправление реквизитов и перевыпуск счета',
    before: ['payment.status: pending', 'payment.amount: 0'],
    after: ['payment.status: created', 'payment.amount: 2500'],
  },
  {
    id: 'evt-1006',
    dateIso: '2026-02-27',
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
    chip: 'access',
    location: 'Настройки безопасности',
    ip: '10.14.7.55',
    reason: 'Актуализация политики доступа',
    before: ['session.ttl_hours: 12', 'revoke_on_password_change: false'],
    after: ['session.ttl_hours: 8', 'revoke_on_password_change: true'],
  },
];

const CHIP_OPTIONS: Array<{ id: MonitoringChip; label: string }> = [
  { id: 'all', label: 'Все события' },
  { id: 'role', label: 'Изменения ролей' },
  { id: 'export', label: 'Экспорт' },
  { id: 'access', label: 'Ошибки доступа' },
];

@Component({
  selector: 'lib-monitoring',
  imports: [],
  templateUrl: './monitoring.html',
  styleUrl: './monitoring.scss',
})
export class Monitoring {
  protected readonly chipOptions = CHIP_OPTIONS;
  protected readonly filters = signal<MonitoringFilters>({ ...DEFAULT_FILTERS });
  protected readonly activeChip = signal<MonitoringChip>('all');
  protected readonly selectedEventId = signal<string>(AUDIT_EVENTS[0].id);
  protected readonly lastUpdated = signal<string>('сегодня, 14:20');
  protected readonly statusMessage = signal<string>(
    'Фильтры применяются сразу, кнопка "Применить" подтверждает выбор.',
  );

  protected readonly filteredEvents = computed(() => {
    const filters = this.filters();
    const activeChip = this.activeChip();
    const query = filters.query.trim().toLowerCase();

    return AUDIT_EVENTS.filter((event) => {
      if (activeChip !== 'all' && event.chip !== activeChip) {
        return false;
      }

      if (filters.role !== 'all' && event.role !== filters.role) {
        return false;
      }

      if (filters.type !== 'all' && event.type !== filters.type) {
        return false;
      }

      if (filters.object !== 'all' && event.object !== filters.object) {
        return false;
      }

      if (filters.severity !== 'all' && event.severityLabel !== filters.severity) {
        return false;
      }

      if (filters.securityOnly && !event.security) {
        return false;
      }

      if (filters.dateFrom && event.dateIso < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && event.dateIso > filters.dateTo) {
        return false;
      }

      if (!query) {
        return true;
      }

      const haystack = [
        event.actor,
        event.actorEmail,
        event.actionTitle,
        event.actionSubtitle,
        event.entityTitle,
        event.entitySubtitle,
        event.source,
        event.type,
        event.object,
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  });

  protected readonly selectedEvent = computed(() => {
    const events = this.filteredEvents();
    if (!events.length) return null;
    return events.find((event) => event.id === this.selectedEventId()) ?? events[0];
  });

  protected readonly stats = computed(() => {
    const events = this.filteredEvents();

    return {
      total: events.length,
      critical: events.filter((event) => event.severity === 'critical').length,
      security: events.filter((event) => event.security).length,
      exports: events.filter((event) => event.type === 'Экспорт').length,
    };
  });

  protected readonly securityHighlights = computed(() =>
    this.filteredEvents()
      .filter((event) => event.security)
      .slice(0, 3),
  );

  protected updateFilter<K extends keyof MonitoringFilters>(
    key: K,
    value: MonitoringFilters[K],
  ): void {
    this.filters.update((filters) => ({ ...filters, [key]: value }));
  }

  protected setChip(chip: MonitoringChip): void {
    this.activeChip.set(chip);
    this.statusMessage.set(
      `Быстрый фильтр: ${this.chipOptions.find((item) => item.id === chip)?.label ?? 'Все события'}.`,
    );
  }

  protected selectEvent(eventId: string): void {
    this.selectedEventId.set(eventId);
  }

  protected applyFilters(): void {
    this.statusMessage.set(`Найдено событий: ${this.filteredEvents().length}.`);
  }

  protected resetFilters(): void {
    this.filters.set({ ...DEFAULT_FILTERS });
    this.activeChip.set('all');
    this.selectedEventId.set(AUDIT_EVENTS[0].id);
    this.statusMessage.set('Фильтры сброшены.');
  }

  protected refresh(): void {
    this.lastUpdated.set(this.formatLastUpdated());
    this.statusMessage.set(
      'Данные обновлены. Сейчас используются локальные демонстрационные записи.',
    );
  }

  protected saveView(): void {
    this.statusMessage.set('Сохранение представления пока работает как UI-стаб.');
  }

  protected exportCsv(): void {
    const rows = this.filteredEvents();
    const header = [
      'Дата',
      'Время',
      'Пользователь',
      'Email',
      'Роль',
      'Действие',
      'Объект',
      'Источник',
      'Уровень',
      'Событие безопасности',
    ];

    const csvRows = rows.map((event) => [
      event.dateLabel,
      event.timeLabel,
      event.actor,
      event.actorEmail,
      event.role,
      event.actionTitle,
      event.entityTitle,
      event.source,
      event.severityLabel,
      event.security ? 'Да' : 'Нет',
    ]);

    const csv = [header, ...csvRows]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';'))
      .join('\n');

    if (typeof document !== 'undefined') {
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-log-${this.formatFileDate()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }

    this.statusMessage.set(`CSV сформирован: ${rows.length} строк.`);
  }

  private formatLastUpdated(now = new Date()): string {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(now);
  }

  private formatFileDate(now = new Date()): string {
    return now.toISOString().slice(0, 10);
  }
}
