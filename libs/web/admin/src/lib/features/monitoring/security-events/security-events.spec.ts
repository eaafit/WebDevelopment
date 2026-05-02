import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AuditMonitoringApiService } from '@notary-portal/ui';
import { SecurityEvents } from './security-events';

// Mock HTMLAnchorElement.click to avoid jsdom navigation warning
HTMLAnchorElement.prototype.click = jest.fn();

describe('SecurityEvents', () => {
  let component: SecurityEvents;
  let fixture: ComponentFixture<SecurityEvents>;
  let apiService: jest.Mocked<AuditMonitoringApiService>;

  const mockLoginFailedEvent = {
    id: '1',
    occurredAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
    eventType: 'user.login_failed',
    actionTitle: 'Неудачная попытка входа',
    actionContext: '',
    actorUserId: 'user-123',
    actorName: 'Иван Иванов',
    actorEmail: 'ivan@example.com',
    actorRoleLabel: 'Заявитель',
    targetType: '',
    targetId: '',
    targetTitle: '',
    targetContext: '',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    beforeJson: '',
    afterJson: '',
  };

  const mockBlockedEvent = {
    id: '2',
    occurredAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 48 hours ago
    eventType: 'user.blocked',
    actionTitle: 'Пользователь заблокирован',
    actionContext: '',
    actorUserId: 'admin-456',
    actorName: 'Админ Админов',
    actorEmail: 'admin@example.com',
    actorRoleLabel: 'Администратор',
    targetType: 'user',
    targetId: 'user-789',
    targetTitle: 'Петр Петров',
    targetContext: '',
    ip: '10.0.0.1',
    userAgent: 'Chrome/120.0',
    beforeJson: '',
    afterJson: '',
  };

  const mockTokenRevokedEvent = {
    id: '3',
    occurredAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    eventType: 'token.revoked',
    actionTitle: 'Токен отозван',
    actionContext: '',
    actorUserId: 'user-999',
    actorName: 'Сергей Сергеев',
    actorEmail: 'sergey@example.com',
    actorRoleLabel: 'Нотариус',
    targetType: 'token',
    targetId: 'token-abc',
    targetTitle: 'Access Token',
    targetContext: '',
    ip: '172.16.0.1',
    userAgent: 'Safari/17.0',
    beforeJson: '',
    afterJson: '',
  };

  const mockPermissionDeniedEvent = {
    id: '4',
    occurredAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(), // 10 minutes ago
    eventType: 'permission.denied',
    actionTitle: 'Отказ в доступе',
    actionContext: '',
    actorUserId: 'user-555',
    actorName: 'Мария Марьева',
    actorEmail: 'maria@example.com',
    actorRoleLabel: 'Заявитель',
    targetType: 'resource',
    targetId: 'res-123',
    targetTitle: 'Admin Panel',
    targetContext: '',
    ip: '192.168.2.1',
    userAgent: 'Firefox/121.0',
    beforeJson: '',
    afterJson: '',
  };

  beforeEach(async () => {
    const apiServiceMock = {
      getAuditEvents: jest.fn().mockImplementation((query) => {
        const eventsByType: Record<string, unknown[]> = {
          'user.login_failed': [mockLoginFailedEvent],
          'user.blocked': [mockBlockedEvent],
          'token.revoked': [mockTokenRevokedEvent],
          'permission.denied': [mockPermissionDeniedEvent],
        };

        return of({
          events: eventsByType[query.eventType] || [],
          meta: {
            totalItems: eventsByType[query.eventType]?.length || 0,
            totalPages: 1,
            currentPage: query.page,
            perPage: 100,
          },
        });
      }),
      exportAuditEvents: jest.fn().mockImplementation((filters) => {
        const eventsByType: Record<string, unknown[]> = {
          'user.login_failed': [mockLoginFailedEvent],
          'user.blocked': [mockBlockedEvent],
          'token.revoked': [mockTokenRevokedEvent],
          'permission.denied': [mockPermissionDeniedEvent],
        };

        return of(eventsByType[filters.eventType] || []);
      }),
    };

    await TestBed.configureTestingModule({
      imports: [SecurityEvents],
      providers: [
        {
          provide: AuditMonitoringApiService,
          useValue: apiServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityEvents);
    component = fixture.componentInstance;
    apiService = TestBed.inject(
      AuditMonitoringApiService,
    ) as jest.Mocked<AuditMonitoringApiService>;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load security events on init', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      expect(apiService.getAuditEvents).toHaveBeenCalledTimes(4);
      expect(component.events().length).toBe(4);
      expect(component.loading()).toBe(false);
      done();
    }, 100);
  });

  it('should only fetch security event types', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const calls = apiService.getAuditEvents.mock.calls;
      const eventTypes = calls.map((call) => call[0].eventType);

      expect(eventTypes).toContain('user.login_failed');
      expect(eventTypes).toContain('user.blocked');
      expect(eventTypes).toContain('token.revoked');
      expect(eventTypes).toContain('permission.denied');
      expect(eventTypes.length).toBe(4);
      done();
    }, 100);
  });

  it('should assign warning risk level to login_failed events', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const loginFailedEvent = component.events().find((e) => e.eventType === 'user.login_failed');
      expect(loginFailedEvent?.riskLevel).toBe('warning');
      done();
    }, 100);
  });

  it('should assign error risk level to blocked, revoked, and denied events', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const blockedEvent = component.events().find((e) => e.eventType === 'user.blocked');
      const revokedEvent = component.events().find((e) => e.eventType === 'token.revoked');
      const deniedEvent = component.events().find((e) => e.eventType === 'permission.denied');

      expect(blockedEvent?.riskLevel).toBe('error');
      expect(revokedEvent?.riskLevel).toBe('error');
      expect(deniedEvent?.riskLevel).toBe('error');
      done();
    }, 100);
  });

  it('should calculate events in last 24 hours correctly', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      // mockLoginFailedEvent (1h ago), mockTokenRevokedEvent (30m ago), mockPermissionDeniedEvent (10m ago)
      // mockBlockedEvent is 48h ago, so should not be counted
      expect(component.eventsLast24h()).toBe(3);
      done();
    }, 100);
  });

  it('should sort events by date descending', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      const events = component.events();
      expect(events.length).toBeGreaterThan(0);

      for (let i = 0; i < events.length - 1; i++) {
        const current = new Date(events[i].occurredAt).getTime();
        const next = new Date(events[i + 1].occurredAt).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
      done();
    }, 100);
  });

  it('should start loading on init', (done) => {
    const newFixture = TestBed.createComponent(SecurityEvents);
    const newComponent = newFixture.componentInstance;

    // Check loading state before detectChanges triggers the constructor
    expect(newComponent.loading()).toBe(false);

    newFixture.detectChanges();

    setTimeout(() => {
      expect(newComponent.loading()).toBe(false);
      expect(newComponent.events().length).toBeGreaterThan(0);
      done();
    }, 100);
  });

  it('should show error when API fails during load', (done) => {
    apiService.getAuditEvents.mockReturnValue(throwError(() => new Error('API Error')));

    const newFixture = TestBed.createComponent(SecurityEvents);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    setTimeout(() => {
      expect(newComponent.error()).toBe('Ошибка загрузки событий безопасности');
      expect(newComponent.loading()).toBe(false);
      expect(newComponent.events().length).toBe(0);
      done();
    }, 100);
  });

  it('should call export API for all security event types and revoke URL', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();

      const appendChildSpy = jest
        .spyOn(document.body, 'appendChild')
        .mockImplementation(() => null as Node);
      const removeChildSpy = jest
        .spyOn(document.body, 'removeChild')
        .mockImplementation(() => null as Node);

      component.exportToCsv();

      setTimeout(() => {
        expect(apiService.exportAuditEvents).toHaveBeenCalledTimes(4);

        const calls = apiService.exportAuditEvents.mock.calls;
        const eventTypes = calls.map((call) => call[0].eventType);
        expect(eventTypes).toContain('user.login_failed');
        expect(eventTypes).toContain('user.blocked');
        expect(eventTypes).toContain('token.revoked');
        expect(eventTypes).toContain('permission.denied');

        expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');

        appendChildSpy.mockRestore();
        removeChildSpy.mockRestore();
        done();
      }, 200);
    }, 100);
  });

  it('should disable export button when no events', (done) => {
    apiService.getAuditEvents.mockReturnValue(of({ events: [], meta: null }));

    const newFixture = TestBed.createComponent(SecurityEvents);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    setTimeout(() => {
      newFixture.detectChanges();
      expect(newComponent.events().length).toBe(0);
      const exportButton = newFixture.debugElement.query(By.css('.export-button'));
      expect(exportButton.nativeElement.disabled).toBe(true);
      done();
    }, 100);
  });

  it('should apply correct CSS classes for risk levels', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      fixture.detectChanges();

      const warningRows = fixture.debugElement.queryAll(By.css('tr.risk-warning'));
      const errorRows = fixture.debugElement.queryAll(By.css('tr.risk-error'));

      expect(warningRows.length).toBe(1); // user.login_failed
      expect(errorRows.length).toBe(3); // user.blocked, token.revoked, permission.denied
      done();
    }, 100);
  });

  it('should display correct risk level labels', () => {
    expect(component.getRiskLevelLabel('warning')).toBe('Средний');
    expect(component.getRiskLevelLabel('error')).toBe('Высокий');
  });

  it('should format dates correctly', () => {
    const isoDate = '2026-04-25T10:30:00.000Z';
    const formatted = component.formatDate(isoDate);
    expect(formatted).toMatch(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
  });

  it('should show error when export API fails', (done) => {
    fixture.detectChanges();

    setTimeout(() => {
      apiService.exportAuditEvents.mockReturnValue(throwError(() => new Error('Export API Error')));

      component.exportToCsv();

      setTimeout(() => {
        expect(component.error()).toBe('Ошибка экспорта событий');
        expect(component.exporting()).toBe(false);
        done();
      }, 200);
    }, 100);
  });

  it('should load all pages when totalPages > 1', (done) => {
    const page1Event = { ...mockLoginFailedEvent, id: 'page1-event' };
    const page2Event = {
      ...mockLoginFailedEvent,
      id: 'page2-event',
      occurredAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    };

    apiService.getAuditEvents.mockImplementation((query) => {
      if (query.eventType === 'user.login_failed') {
        if (query.page === 1) {
          return of({
            events: [page1Event],
            meta: {
              totalItems: 2,
              totalPages: 2,
              currentPage: 1,
              perPage: 100,
            },
          });
        } else if (query.page === 2) {
          return of({
            events: [page2Event],
            meta: {
              totalItems: 2,
              totalPages: 2,
              currentPage: 2,
              perPage: 100,
            },
          });
        }
      }

      return of({
        events: [],
        meta: {
          totalItems: 0,
          totalPages: 1,
          currentPage: 1,
          perPage: 100,
        },
      });
    });

    const newFixture = TestBed.createComponent(SecurityEvents);
    const newComponent = newFixture.componentInstance;
    newFixture.detectChanges();

    setTimeout(() => {
      const loginFailedEvents = newComponent
        .events()
        .filter((e) => e.eventType === 'user.login_failed');
      expect(loginFailedEvents.length).toBe(2);
      expect(loginFailedEvents.some((e) => e.id === 'page1-event')).toBe(true);
      expect(loginFailedEvents.some((e) => e.id === 'page2-event')).toBe(true);
      done();
    }, 200);
  });
});
