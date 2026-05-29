import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AuditMonitoringApiService, type AuditMonitoringEvent } from '@notary-portal/ui';
import { AuditTimelineComponent } from './audit-timeline';

function buildEvent(overrides: Partial<AuditMonitoringEvent>): AuditMonitoringEvent {
  return {
    id: '',
    occurredAt: '',
    eventType: '',
    actionTitle: '',
    actionContext: '',
    actorUserId: '',
    actorName: '',
    actorEmail: '',
    actorRoleLabel: '',
    targetType: '',
    targetId: '',
    targetTitle: '',
    targetContext: '',
    ip: '',
    userAgent: '',
    beforeJson: '',
    afterJson: '',
    ...overrides,
  };
}

describe('AuditTimelineComponent', () => {
  let fixture: ComponentFixture<AuditTimelineComponent>;
  let component: AuditTimelineComponent;
  let apiMock: { getAuditEvents: jest.Mock };

  // Намеренно не в хронологическом порядке — компонент должен отсортировать по occurredAt.
  const events: AuditMonitoringEvent[] = [
    buildEvent({
      id: '2',
      eventType: 'assessment.completed',
      actionTitle: 'Заявка завершена',
      occurredAt: '2026-05-10T12:00:00.000Z',
      actorName: 'Админ Иванов',
      actorRoleLabel: 'Администратор',
    }),
    buildEvent({
      id: '1',
      eventType: 'assessment.created',
      actionTitle: 'Создана заявка',
      occurredAt: '2026-05-01T09:00:00.000Z',
    }),
  ];

  async function setup(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AuditTimelineComponent],
      providers: [{ provide: AuditMonitoringApiService, useValue: apiMock }],
    }).compileComponents();
    fixture = TestBed.createComponent(AuditTimelineComponent);
    component = fixture.componentInstance;
  }

  async function loadWith(assessmentId: string): Promise<void> {
    fixture.componentRef.setInput('assessmentId', assessmentId);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    apiMock = { getAuditEvents: jest.fn().mockReturnValue(of({ events, meta: null })) };
  });

  it('queries the audit API by targetId = assessmentId and renders events chronologically', async () => {
    await setup();
    await loadWith('assessment-123');

    expect(apiMock.getAuditEvents).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'assessment-123' }),
    );
    expect(component.loading()).toBe(false);
    // Отсортировано по occurredAt по возрастанию.
    expect(component.events().map((e) => e.id)).toEqual(['1', '2']);
    const items = fixture.debugElement.queryAll(By.css('.audit-timeline__item'));
    expect(items.length).toBe(2);
  });

  it('shows the empty state when there are no events', async () => {
    apiMock.getAuditEvents.mockReturnValue(of({ events: [], meta: null }));
    await setup();
    await loadWith('assessment-123');

    expect(component.isEmpty()).toBe(true);
    const state = fixture.debugElement.query(By.css('.audit-timeline__state'));
    expect(state.nativeElement.textContent).toContain('пока нет');
  });

  it('sets the error state when the audit API fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(jest.fn());
    apiMock.getAuditEvents.mockReturnValue(throwError(() => new Error('boom')));
    await setup();
    await loadWith('assessment-123');

    expect(component.error()).toBe('Не удалось загрузить историю заявки');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to load assessment audit events:',
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it('does not call the API for an empty assessmentId', async () => {
    await setup();
    await loadWith('');

    expect(apiMock.getAuditEvents).not.toHaveBeenCalled();
    expect(component.events()).toEqual([]);
  });

  it('falls back to the mapped label and icon when actionTitle is missing', async () => {
    apiMock.getAuditEvents.mockReturnValue(
      of({
        events: [
          buildEvent({
            id: '9',
            eventType: 'assessment.cancelled',
            actionTitle: '',
            occurredAt: '2026-05-02T00:00:00.000Z',
          }),
        ],
        meta: null,
      }),
    );
    await setup();
    await loadWith('a-1');

    expect(component.labelFor(component.events()[0])).toBe('Отменена');
    expect(component.iconFor('assessment.cancelled')).toBe('❌');
    expect(component.colorKey('assessment.unknown')).toBe('default');
  });
});
