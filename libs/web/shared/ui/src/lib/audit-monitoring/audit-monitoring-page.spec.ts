import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import type {
  AuditMonitoringEvent,
  AuditMonitoringMode,
  AuditMonitoringPageResult,
} from './audit-monitoring.models';
import { AuditMonitoringApiService } from './audit-monitoring-api.service';
import { AuditMonitoringPage } from './audit-monitoring-page';

describe('AuditMonitoringPage', () => {
  let component: AuditMonitoringPage;
  let fixture: ComponentFixture<AuditMonitoringPage>;
  let getAuditEvents: jest.Mock;
  let exportAuditEvents: jest.Mock;
  let createObjectUrlMock: jest.Mock;
  let revokeObjectUrlMock: jest.Mock;
  let clickSpy: jest.SpyInstance;
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(async () => {
    getAuditEvents = jest
      .fn()
      .mockImplementation((query: { page: number }) => of(buildPageResult(query.page)));
    exportAuditEvents = jest.fn().mockReturnValue(of([buildEvent('audit-export')]));

    createObjectUrlMock = jest.fn().mockReturnValue('blob:mock-audit-export');
    revokeObjectUrlMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock,
    });
    clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    await TestBed.configureTestingModule({
      imports: [AuditMonitoringPage],
      providers: [
        {
          provide: AuditMonitoringApiService,
          useValue: {
            getAuditEvents,
            exportAuditEvents,
          },
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    if (originalRequestAnimationFrame) {
      Object.defineProperty(globalThis, 'requestAnimationFrame', {
        configurable: true,
        writable: true,
        value: originalRequestAnimationFrame,
      });
    } else {
      delete (globalThis as Partial<typeof globalThis>).requestAnimationFrame;
    }

    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      });
    } else {
      delete (URL as Partial<typeof URL>).createObjectURL;
    }

    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      });
    } else {
      delete (URL as Partial<typeof URL>).revokeObjectURL;
    }

    clickSpy.mockRestore();
  });

  it('should load the first page on init', async () => {
    await createComponent();

    expect(getAuditEvents).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      eventType: '',
      actorQuery: '',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
    expect(component.events()).toHaveLength(2);
    expect(component.meta()?.currentPage).toBe(1);
  });

  it('should debounce filters and avoid redundant requests', async () => {
    await createComponent();
    getAuditEvents.mockClear();

    component.updateFilter('actorQuery', 'a');
    component.updateFilter('actorQuery', 'ab');
    component.updateFilter('actorQuery', 'admin');

    await wait(150);
    expect(getAuditEvents).not.toHaveBeenCalled();

    await wait(220);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAuditEvents).toHaveBeenCalledTimes(1);
    expect(getAuditEvents).toHaveBeenLastCalledWith({
      page: 1,
      limit: 20,
      eventType: '',
      actorQuery: 'admin',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('should preserve filters when moving to the next page', async () => {
    await createComponent();

    component.appliedFilters.set({
      eventType: 'assessment.created',
      actorQuery: '',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
    await wait(0);
    fixture.detectChanges();
    await fixture.whenStable();

    getAuditEvents.mockClear();
    component.goToNextPage();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAuditEvents).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      eventType: 'assessment.created',
      actorQuery: '',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('should expose notary mode on the rendered page', async () => {
    await createComponent({ mode: 'notary' });

    const root = fixture.nativeElement.querySelector('.audit-page');
    expect(root?.getAttribute('data-mode')).toBe('notary');
    expect(fixture.nativeElement.textContent).toContain('История действий по вашим заказам');
  });

  it('should show action context, target context, ip, user-agent and before/after for the selected event', async () => {
    await createComponent();

    component.selectEvent('audit-2');
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Контекст действия');
    expect(content).toContain('Взятие заявки в работу');
    expect(content).toContain('Контекст объекта');
    expect(content).toContain('Заявка второго нотариуса');
    expect(content).toContain('10.10.0.2');
    expect(content).toContain('Mozilla/5.0 (Notary)');
    expect(content).toContain('"status": "new"');
    expect(content).toContain('"status": "verified"');
  });

  it('should keep rendered rows visible while refresh is pending', async () => {
    const firstLoad$ = new Subject<AuditMonitoringPageResult>();
    const refreshLoad$ = new Subject<AuditMonitoringPageResult>();
    getAuditEvents.mockReset();
    getAuditEvents.mockReturnValueOnce(firstLoad$).mockReturnValueOnce(refreshLoad$);

    await createComponent({ waitForStable: false });
    firstLoad$.next(buildPageResult(1));
    firstLoad$.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.audit-row')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.audit-page__progress')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.audit-status-chip')).toHaveLength(0);

    component.refresh();
    fixture.detectChanges();

    expect(component.isRefreshing()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.audit-row')).toHaveLength(2);
    expect(fixture.nativeElement.querySelector('.audit-feed__overlay')).toBeNull();
    expect(fixture.nativeElement.querySelector('.audit-page__progress')).toBeNull();
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLElement>(
          '.audit-page__actions .audit-btn__label',
        ),
      ).map((element) => element.textContent?.trim()),
    ).toEqual(['Сбросить фильтры', 'Обновить', 'Экспорт CSV']);
    expect(
      fixture.nativeElement.querySelectorAll('.audit-page__actions .audit-btn__marker'),
    ).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('.audit-btn--secondary .audit-btn__spinner--visible'),
    ).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Получаем записи аудита с backend.');

    refreshLoad$.next(buildPageResult(1));
    refreshLoad$.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBe(false);
    expect(fixture.nativeElement.querySelector('.audit-page__progress')).toBeNull();
  });

  it('should keep selection during pagination request and pick the first event from the new page', async () => {
    const firstLoad$ = new Subject<AuditMonitoringPageResult>();
    const secondPage$ = new Subject<AuditMonitoringPageResult>();
    getAuditEvents.mockReset();
    getAuditEvents.mockReturnValueOnce(firstLoad$).mockReturnValueOnce(secondPage$);

    await createComponent({ waitForStable: false });
    firstLoad$.next(buildPageResult(1));
    firstLoad$.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectEvent('audit-2');
    fixture.detectChanges();

    component.goToNextPage();
    fixture.detectChanges();

    const paginationButtons = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.audit-pagination .audit-btn',
    );
    expect(component.selectedEvent()?.id).toBe('audit-2');
    expect(component.isRefreshing()).toBe(true);
    expect(paginationButtons[0]?.disabled).toBe(true);
    expect(paginationButtons[1]?.disabled).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.audit-row')).toHaveLength(2);

    secondPage$.next(buildPageResult(2, { preserveSelectedEvent: false }));
    secondPage$.complete();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.selectedEvent()?.id).toBe('audit-3');
    expect(component.meta()?.currentPage).toBe(2);
  });

  it('should issue a single reload when resetting filters', async () => {
    await createComponent();

    component.draftFilters.set({
      eventType: 'assessment.created',
      actorQuery: 'admin',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      targetId: '11111111-1111-4111-8111-111111111111',
      assessmentId: '33333333-3333-4333-8333-333333333333',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });
    component.appliedFilters.set({
      eventType: 'assessment.created',
      actorQuery: 'admin',
      actorUserId: '22222222-2222-4222-8222-222222222222',
      targetId: '11111111-1111-4111-8111-111111111111',
      assessmentId: '33333333-3333-4333-8333-333333333333',
      dateFrom: '2026-03-01',
      dateTo: '2026-03-07',
    });
    component.currentPage.set(2);
    fixture.detectChanges();
    await fixture.whenStable();

    getAuditEvents.mockClear();

    component.resetFilters();
    fixture.detectChanges();
    await wait(360);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(getAuditEvents).toHaveBeenCalledTimes(1);
    expect(getAuditEvents).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
      eventType: '',
      actorQuery: '',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
  });

  it('should export csv using export rpc and trigger browser download', async () => {
    await createComponent();
    await component.exportCsv();

    expect(exportAuditEvents).toHaveBeenCalledWith({
      eventType: '',
      actorQuery: '',
      actorUserId: '',
      targetId: '',
      assessmentId: '',
      dateFrom: '',
      dateTo: '',
    });
    expect(createObjectUrlMock).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(revokeObjectUrlMock).toHaveBeenCalledWith('blob:mock-audit-export');
  });

  it('should keep export button label stable while export is pending', async () => {
    const export$ = new Subject<AuditMonitoringEvent[]>();
    exportAuditEvents.mockReset();
    exportAuditEvents.mockReturnValueOnce(export$);

    await createComponent();

    const exportPromise = component.exportCsv();
    fixture.detectChanges();

    const exportButton = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.audit-page__actions .audit-btn',
    )[2];
    expect(component.exporting()).toBe(true);
    expect(fixture.nativeElement.querySelector('.audit-page__progress')).toBeNull();
    expect(exportButton?.textContent).toContain('Экспорт CSV');
    expect(exportButton?.textContent).not.toContain('Экспорт...');
    expect(exportButton?.querySelector('.audit-btn__spinner--visible')).not.toBeNull();
    expect(exportButton?.querySelector('.audit-btn__marker')).not.toBeNull();

    export$.next([buildEvent('audit-export')]);
    export$.complete();
    await exportPromise;
  });

  it('should yield to the browser while building large csv exports', async () => {
    const requestAnimationFrameMock = jest.fn((callback: FrameRequestCallback) => {
      setTimeout(() => callback(0), 0);
      return 1;
    });
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      writable: true,
      value: requestAnimationFrameMock,
    });

    exportAuditEvents.mockReset();
    exportAuditEvents.mockReturnValue(
      of(Array.from({ length: 240 }, (_, index) => buildEvent(`audit-export-${index}`))),
    );

    await createComponent();
    await component.exportCsv();

    expect(requestAnimationFrameMock).toHaveBeenCalled();
  });

  async function createComponent(options?: {
    mode?: AuditMonitoringMode;
    waitForStable?: boolean;
  }): Promise<void> {
    fixture = TestBed.createComponent(AuditMonitoringPage);
    component = fixture.componentInstance;
    component.mode = options?.mode ?? 'admin';
    fixture.detectChanges();

    if (options?.waitForStable ?? true) {
      await fixture.whenStable();
      fixture.detectChanges();
    }
  }
});

function buildPageResult(
  page: number,
  options?: { preserveSelectedEvent?: boolean },
): AuditMonitoringPageResult {
  const preserveSelectedEvent = options?.preserveSelectedEvent ?? true;

  return {
    events:
      page === 1 || preserveSelectedEvent
        ? [buildEvent(`audit-${page === 1 ? '1' : '3'}`), buildEvent('audit-2')]
        : [buildEvent('audit-3'), buildEvent('audit-4')],
    meta: {
      totalItems: 6,
      totalPages: 3,
      currentPage: page,
      perPage: 20,
    },
  };
}

function buildEvent(id: string): AuditMonitoringEvent {
  if (id === 'audit-2') {
    return {
      id,
      occurredAt: '2026-03-06T08:45:00.000Z',
      eventType: 'assessment.verified',
      actionTitle: 'Заявка взята в работу',
      actionContext: 'Взятие заявки в работу',
      actorUserId: 'notary-2',
      actorName: 'Нотариус 2',
      actorEmail: 'seed-user-011@seed.local',
      actorRoleLabel: 'Нотариус',
      targetType: 'Assessment',
      targetId: '22222222-2222-4222-8222-222222222222',
      targetTitle: 'Заявка #22222222',
      targetContext: 'Заявка второго нотариуса',
      ip: '10.10.0.2',
      userAgent: 'Mozilla/5.0 (Notary)',
      beforeJson: '{\n  "status": "new"\n}',
      afterJson: '{\n  "status": "verified"\n}',
    };
  }

  return {
    id,
    occurredAt: '2026-03-05T08:45:00.000Z',
    eventType: 'assessment.created',
    actionTitle: 'Создана заявка',
    actionContext: 'Создание заявки',
    actorUserId: 'admin-1',
    actorName: 'Администратор 1',
    actorEmail: 'seed-user-020@seed.local',
    actorRoleLabel: 'Администратор',
    targetType: 'Assessment',
    targetId: pageSpecificTargetId(id),
    targetTitle: `Заявка #${pageSpecificTargetId(id).slice(0, 8)}`,
    targetContext:
      id === 'audit-3' || id === 'audit-4' ? 'Следующая страница ленты' : 'Первая заявка',
    ip: '10.10.0.1',
    userAgent: 'Mozilla/5.0 (Admin)',
    beforeJson: '',
    afterJson: '{\n  "status": "new"\n}',
  };
}

function pageSpecificTargetId(id: string): string {
  if (id === 'audit-3') {
    return '33333333-3333-4333-8333-333333333333';
  }

  if (id === 'audit-export') {
    return '44444444-4444-4444-8444-444444444444';
  }

  if (id === 'audit-4') {
    return '55555555-5555-4555-8555-555555555555';
  }

  return '11111111-1111-4111-8111-111111111111';
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
