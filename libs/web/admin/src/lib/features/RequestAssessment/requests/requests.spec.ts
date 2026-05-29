import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AdminAssessmentApiService,
  type AdminAssessmentRow,
  type AdminAssessmentListPage,
} from '../services/assessment-api.service';
import { AdminUserApiService, type AdminUserRef } from '../services/user-api.service';
import { AdminOrderActivityLogger } from '../services/admin-order-activity-logger.service';
import { RequestsComponent } from './requests';

const NOTARY_ACTIVE_ID = 'notary-active-1';
const NOTARY_INACTIVE_ID = 'notary-inactive-1';
const APPLICANT_ID = 'applicant-1';

const ADMIN_NOTARY_ASSIGNMENTS_KEY = 'admin_notary_assignments';
const ADMIN_STATUS_OVERRIDES_KEY = 'admin_status_overrides';

describe('RequestsComponent', () => {
  let component: RequestsComponent;
  let fixture: ComponentFixture<RequestsComponent>;
  let apiMock: ReturnType<typeof createApiMock>;
  let userMock: ReturnType<typeof createUserMock>;
  let loggerMock: ReturnType<typeof createLoggerMock>;

  beforeEach(async () => {
    localStorage.clear();
    apiMock = createApiMock();
    userMock = createUserMock();
    loggerMock = createLoggerMock();

    await TestBed.configureTestingModule({
      imports: [RequestsComponent],
      providers: [
        { provide: AdminAssessmentApiService, useValue: apiMock },
        { provide: AdminUserApiService, useValue: userMock },
        { provide: AdminOrderActivityLogger, useValue: loggerMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RequestsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls listAssessments on init and renders applicant names from user-api', () => {
    expect(apiMock.listAssessments).toHaveBeenCalledTimes(1);
    expect(apiMock.listAssessments).toHaveBeenCalledWith({ page: 1, limit: 200 });
    expect(component.assessments.length).toBe(3);
    const a1 = component.assessments.find((a) => a.id === 'a-1');
    expect(a1?.applicantName).toBe('Иванов И.И.');
    expect(a1?.status).toBe('New');
  });

  it('populates notary options from AdminUserApiService.usersById (active only)', () => {
    expect(component.notaryOptions.length).toBe(1);
    expect(component.notaryOptions[0].id).toBe(NOTARY_ACTIVE_ID);
    expect(component.notaryOptions[0].label).toContain('Петрова М.С.');
    expect(component.notaryOptions.every((opt) => opt.id !== NOTARY_INACTIVE_ID)).toBe(true);
  });

  it('overlays notaryId from the localStorage workaround onto loaded rows', async () => {
    localStorage.setItem(ADMIN_NOTARY_ASSIGNMENTS_KEY, JSON.stringify({ 'a-2': NOTARY_ACTIVE_ID }));
    component.reload();
    await fixture.whenStable();
    fixture.detectChanges();
    const a2 = component.assessments.find((a) => a.id === 'a-2');
    expect(a2?.notaryId).toBe(NOTARY_ACTIVE_ID);
    const a1 = component.assessments.find((a) => a.id === 'a-1');
    expect(a1?.notaryId).toBeUndefined();
  });

  it('blocks confirmVerify when no notary is selected', async () => {
    const newAssessment = component.assessments.find((a) => a.status === 'New');
    if (!newAssessment) {
      throw new Error('Expected at least one assessment in "New" status from the api mock');
    }
    component.openVerifyModal(newAssessment);
    component.notaryId = '';

    await component.confirmVerify();

    expect(component.notaryIdError).toBe('Выберите нотариуса');
    expect(apiMock.verifyAssessment).not.toHaveBeenCalled();
    const refreshed = component.assessments.find((a) => a.id === newAssessment.id);
    expect(refreshed?.status).toBe('New');
  });

  it('confirmVerify saves the notary assignment and calls verifyAssessment', async () => {
    const newAssessment = component.assessments.find((a) => a.status === 'New');
    if (!newAssessment) {
      throw new Error('Expected at least one assessment in "New" status from the api mock');
    }
    component.openVerifyModal(newAssessment);
    component.notaryId = NOTARY_ACTIVE_ID;

    await component.confirmVerify();

    expect(apiMock.verifyAssessment).toHaveBeenCalledTimes(1);
    expect(apiMock.verifyAssessment).toHaveBeenCalledWith(newAssessment.id);
    const stored = JSON.parse(localStorage.getItem(ADMIN_NOTARY_ASSIGNMENTS_KEY) ?? '{}');
    expect(stored[newAssessment.id]).toBe(NOTARY_ACTIVE_ID);
    // refresh — listAssessments вызывался ещё раз после mutation
    expect(apiMock.listAssessments).toHaveBeenCalledTimes(2);
  });

  it('confirmStartWork persists the override and skips the API entirely', () => {
    const verified = component.assessments.find((a) => a.status === 'Verified');
    if (!verified) {
      throw new Error('Expected at least one Verified assessment from the api mock');
    }
    component.openStartWorkModal(verified);

    component.confirmStartWork();

    const stored = JSON.parse(localStorage.getItem(ADMIN_STATUS_OVERRIDES_KEY) ?? '{}');
    expect(stored[verified.id]).toBe('InProgress');
    expect(apiMock.verifyAssessment).not.toHaveBeenCalled();
    expect(apiMock.completeAssessment).not.toHaveBeenCalled();
    const updated = component.assessments.find((a) => a.id === verified.id);
    expect(updated?.status).toBe('InProgress');
  });

  it('confirmComplete validates the final estimated value before calling the API', async () => {
    const verified = component.assessments.find((a) => a.status === 'Verified');
    if (!verified) {
      throw new Error('Expected at least one Verified assessment from the api mock');
    }
    component.openCompleteModal(verified);
    component.finalEstimatedValue = '';

    await component.confirmComplete();
    expect(component.finalEstimatedValueError).toBe('Укажите итоговую стоимость');
    expect(apiMock.completeAssessment).not.toHaveBeenCalled();

    component.finalEstimatedValue = 'не-число';
    await component.confirmComplete();
    expect(component.finalEstimatedValueError).toContain('положительное');
    expect(apiMock.completeAssessment).not.toHaveBeenCalled();
  });

  it('confirmComplete clears the status override after a successful call', async () => {
    localStorage.setItem(ADMIN_STATUS_OVERRIDES_KEY, JSON.stringify({ 'a-2': 'InProgress' }));
    const verified = component.assessments.find((a) => a.id === 'a-2');
    if (!verified) {
      throw new Error('Expected a-2 in the seed data');
    }
    component.openCompleteModal(verified);
    component.finalEstimatedValue = '4500000';

    await component.confirmComplete();

    expect(apiMock.completeAssessment).toHaveBeenCalledTimes(1);
    expect(apiMock.completeAssessment).toHaveBeenCalledWith('a-2', '4500000');
    const stored = JSON.parse(localStorage.getItem(ADMIN_STATUS_OVERRIDES_KEY) ?? '{}');
    expect(stored['a-2']).toBeUndefined();
  });

  it('only applies the InProgress override when the server still reports Verified', async () => {
    // Сервер ушёл вперёд (Completed), но локальный override от прежней сессии остался.
    localStorage.setItem(ADMIN_STATUS_OVERRIDES_KEY, JSON.stringify({ 'a-3': 'InProgress' }));
    component.reload();
    await fixture.whenStable();
    fixture.detectChanges();
    const a3 = component.assessments.find((a) => a.id === 'a-3');
    expect(a3?.status).toBe('Completed');
  });

  it('narrows filteredAssessments by createdAt range', () => {
    const total = component.assessments.length;
    component.dateFrom = '2024-03-01';
    component.dateTo = '2024-03-31';

    component.applyFilters();

    expect(component.filteredAssessments.length).toBeLessThanOrEqual(total);
    expect(component.filteredAssessments.length).toBeGreaterThan(0);
    for (const assessment of component.filteredAssessments) {
      const day = assessment.createdAt.slice(0, 10);
      expect(day >= '2024-03-01').toBe(true);
      expect(day <= '2024-03-31').toBe(true);
    }
  });

  it('narrows filteredAssessments by the selected notaryId', async () => {
    localStorage.setItem(ADMIN_NOTARY_ASSIGNMENTS_KEY, JSON.stringify({ 'a-2': NOTARY_ACTIVE_ID }));
    component.reload();
    await fixture.whenStable();
    fixture.detectChanges();

    component.notaryFilter = NOTARY_ACTIVE_ID;
    component.applyFilters();

    expect(component.filteredAssessments.length).toBe(1);
    expect(component.filteredAssessments[0].id).toBe('a-2');
    expect(component.filteredAssessments[0].notaryId).toBe(NOTARY_ACTIVE_ID);
  });

  it('clears date range and notary filter on resetTopFilters', () => {
    component.dateFrom = '2024-03-01';
    component.dateTo = '2024-03-31';
    component.notaryFilter = component.notaryOptions[0]?.id ?? '';

    component.resetTopFilters();

    expect(component.dateFrom).toBe('');
    expect(component.dateTo).toBe('');
    expect(component.notaryFilter).toBe('');
    expect(component.filteredAssessments.length).toBe(component.assessments.length);
  });

  it('anchors the column filter dropdown to the trigger rect when opened', () => {
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({
        top: 60,
        bottom: 82,
        left: 200,
        right: 222,
        width: 22,
        height: 22,
        x: 200,
        y: 60,
      }) as DOMRect;
    const event = {
      stopPropagation: () => undefined,
      currentTarget: trigger,
    } as unknown as MouseEvent;

    component.toggleColumnFilter('status', event);

    expect(component.activeFilterColumn).toBe('status');
    expect(component.filterDropdownStyle).not.toBeNull();
    expect(component.filterDropdownStyle?.top).toBe(86);
    expect(component.filterDropdownStyle?.left).toBe(200);
  });

  it('clears filterDropdownStyle when closeColumnFilter runs', () => {
    component.activeFilterColumn = 'status';
    component.filterDropdownStyle = { top: 50, left: 100 };

    component.closeColumnFilter();

    expect(component.activeFilterColumn).toBeNull();
    expect(component.filterDropdownStyle).toBeNull();
  });

  // ─── Лаба №8: логирование админ-действий ──────────────────────────────────

  it('logs card open with assessment id and status', () => {
    const target = component.assessments[0];

    component.viewAssessment(target);

    expect(loggerMock.logCardOpened).toHaveBeenCalledWith(target.id, target.status);
  });

  it('logs the top-filter apply action via onApplyTopFilters', () => {
    component.dateFrom = '2024-03-01';
    component.dateTo = '2024-03-31';
    component.notaryFilter = NOTARY_ACTIVE_ID;

    component.onApplyTopFilters();

    expect(loggerMock.logFilterChanged).toHaveBeenCalledWith({
      filter: 'top',
      dateFrom: '2024-03-01',
      dateTo: '2024-03-31',
      notaryFilter: NOTARY_ACTIVE_ID,
    });
  });

  it('logs the filter reset action', () => {
    component.resetTopFilters();

    expect(loggerMock.logFilterChanged).toHaveBeenCalledWith({ filter: 'reset' });
  });

  it('logs column filter and sort when a column filter is applied with a sort draft', () => {
    component.toggleColumnFilter('status', {
      stopPropagation: () => undefined,
      currentTarget: null,
    } as unknown as MouseEvent);
    component.setDraftSort('asc');

    component.applyColumnFilter();

    expect(loggerMock.logFilterChanged).toHaveBeenCalledWith(
      expect.objectContaining({ filter: 'column', column: 'status' }),
    );
    expect(loggerMock.logSortChanged).toHaveBeenCalledWith('status', 'asc');
  });

  it('logs search input once on the debounced commit', () => {
    // Проект zoneless — fakeAsync недоступен; используем фейковые таймеры jest
    // для прокрутки debounceTime(300).
    jest.useFakeTimers();
    try {
      component.onSearchChange('Москва');
      jest.advanceTimersByTime(300);

      expect(loggerMock.logFilterChanged).toHaveBeenCalledWith({
        filter: 'search',
        value: 'Москва',
      });
    } finally {
      jest.useRealTimers();
    }
  });

  // ─── Лаба №8: экспорт CSV ─────────────────────────────────────────────────

  it('builds CSV with a header and a row per filtered assessment', () => {
    const csv = component.buildOrdersCsv();
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('ID,Адрес,Заявитель,Статус,Стоимость,Дата создания');
    expect(lines.length).toBe(component.filteredAssessments.length + 1);
    expect(lines[1]).toContain(component.filteredAssessments[0].id);
  });

  it('exports a CSV download and logs the export action', () => {
    const createObjectURL = jest.fn(() => 'blob:mock');
    const revokeObjectURL = jest.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revokeObjectURL;
    const clickSpy = jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    component.onExportCsv();

    expect(createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(loggerMock.logExport).toHaveBeenCalledWith('csv', component.filteredAssessments.length);

    clickSpy.mockRestore();
  });

  it('does not export or log when the filtered list is empty', () => {
    component.filteredAssessments = [];
    const createObjectURL = jest.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = createObjectURL;

    component.onExportCsv();

    expect(createObjectURL).not.toHaveBeenCalled();
    expect(loggerMock.logExport).not.toHaveBeenCalled();
  });
});

// ─── helpers ──────────────────────────────────────────────────────────────

function buildRow(overrides: Partial<AdminAssessmentRow>): AdminAssessmentRow {
  return {
    id: '',
    userId: APPLICANT_ID,
    status: 'New',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function createApiMock() {
  const seed: AdminAssessmentRow[] = [
    buildRow({
      id: 'a-1',
      status: 'New',
      address: 'Москва',
      createdAt: '2024-03-01T10:00:00.000Z',
      updatedAt: '2024-03-01T10:00:00.000Z',
    }),
    buildRow({
      id: 'a-2',
      status: 'Verified',
      address: 'Петербург',
      createdAt: '2024-03-15T10:00:00.000Z',
      updatedAt: '2024-03-15T11:00:00.000Z',
    }),
    buildRow({
      id: 'a-3',
      status: 'Completed',
      address: 'Казань',
      estimatedValue: '4500000',
      createdAt: '2024-02-20T10:00:00.000Z',
      updatedAt: '2024-03-10T10:00:00.000Z',
    }),
  ];
  const page: AdminAssessmentListPage = {
    items: seed,
    meta: { page: 1, limit: 200, totalItems: seed.length, totalPages: 1 },
  };
  return {
    listAssessments: jest.fn(async () => page),
    getAssessment: jest.fn(async (id: string) => seed.find((row) => row.id === id) ?? seed[0]),
    verifyAssessment: jest.fn(async (id: string) =>
      buildRow({ ...(seed.find((row) => row.id === id) ?? seed[0]), status: 'Verified' }),
    ),
    completeAssessment: jest.fn(async (id: string, finalEstimatedValue: string) =>
      buildRow({
        ...(seed.find((row) => row.id === id) ?? seed[0]),
        status: 'Completed',
        estimatedValue: finalEstimatedValue,
      }),
    ),
    cancelAssessment: jest.fn(async (id: string) =>
      buildRow({ ...(seed.find((row) => row.id === id) ?? seed[0]), status: 'Cancelled' }),
    ),
  };
}

function createUserMock() {
  const users = new Map<string, AdminUserRef>([
    [
      NOTARY_ACTIVE_ID,
      {
        id: NOTARY_ACTIVE_ID,
        fullName: 'Петрова М.С.',
        email: 'petrova@example.com',
        role: 'Notary',
        isActive: true,
      },
    ],
    [
      NOTARY_INACTIVE_ID,
      {
        id: NOTARY_INACTIVE_ID,
        fullName: 'Морозов С.В.',
        email: 'morozov@example.com',
        role: 'Notary',
        isActive: false,
      },
    ],
    [
      APPLICANT_ID,
      {
        id: APPLICANT_ID,
        fullName: 'Иванов И.И.',
        email: 'ivanov@example.com',
        role: 'Applicant',
        isActive: true,
      },
    ],
  ]);
  return {
    loadUsers: jest.fn(async () => undefined),
    invalidateCache: jest.fn(),
    getUserName: jest.fn((id: string) => users.get(id)?.fullName ?? id.slice(0, 8)),
    get usersById(): ReadonlyMap<string, AdminUserRef> {
      return users;
    },
  };
}

function createLoggerMock() {
  return {
    logCardOpened: jest.fn(),
    logFilterChanged: jest.fn(),
    logSortChanged: jest.fn(),
    logExport: jest.fn(),
    getRecentEntries: jest.fn(() => []),
  };
}
