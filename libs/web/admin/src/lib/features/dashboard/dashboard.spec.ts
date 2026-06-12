import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboard } from './dashboard';
import {
  AdminAssessmentApiService,
  type AdminAssessmentListPage,
  type AdminAssessmentRow,
} from '../RequestAssessment/services/assessment-api.service';
import {
  AdminUserApiService,
  type AdminUserRef,
} from '../RequestAssessment/services/user-api.service';
import type { AssessmentItem } from './dashboard';

const APPLICANT_ID = 'u-1';

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;
  let apiMock: ReturnType<typeof createApiMock>;
  let userMock: ReturnType<typeof createUserMock>;

  beforeEach(async () => {
    apiMock = createApiMock();
    userMock = createUserMock();

    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [
        provideRouter([]),
        { provide: AdminAssessmentApiService, useValue: apiMock },
        { provide: AdminUserApiService, useValue: userMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('calls listAssessments and userApi.loadUsers on init', () => {
    expect(apiMock.listAssessments).toHaveBeenCalledTimes(1);
    expect(apiMock.listAssessments).toHaveBeenCalledWith({ page: 1, limit: 200 });
    expect(userMock.loadUsers).toHaveBeenCalledTimes(1);
  });

  it('computes metric counts from the api response', () => {
    const metrics = (
      component as unknown as { metrics: () => { key: string; value: number }[] }
    ).metrics();
    const byKey = Object.fromEntries(metrics.map((m) => [m.key, m.value]));

    expect(byKey['total']).toBe(6);
    expect(byKey['inProgress']).toBe(2);
    expect(byKey['completed']).toBe(1);
    expect(byKey['cancelled']).toBe(1);
  });

  it('returns up to 5 latest items sorted by createdAt desc', () => {
    const latest = (component as unknown as { latestFive: () => AssessmentItem[] }).latestFive();

    expect(latest.length).toBe(5);
    expect(latest.map((a) => a.id)).toEqual(['t-2', 't-6', 't-1', 't-3', 't-4']);
  });

  it('renders applicantName from AdminUserApiService.getUserName for every latest item', () => {
    const latest = (component as unknown as { latestFive: () => AssessmentItem[] }).latestFive();
    expect(latest.length).toBeGreaterThan(0);
    for (const item of latest) {
      expect(item.applicantName).toBe('Иванов И.И.');
    }
    expect(userMock.getUserName).toHaveBeenCalledWith(APPLICANT_ID);
  });

  it('refresh re-fetches assessments and reloads users', async () => {
    component.refresh();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(apiMock.listAssessments).toHaveBeenCalledTimes(2);
    expect(userMock.loadUsers).toHaveBeenCalledTimes(2);
  });

  it('keeps dashboard data when user lookup fails', async () => {
    userMock.loadUsers.mockRejectedValueOnce(new Error('User lookup failed'));

    component.refresh();
    await fixture.whenStable();
    fixture.detectChanges();

    const loadError = (component as unknown as { loadError: () => string | null }).loadError();
    const warning = (
      component as unknown as { userLookupWarning: () => string | null }
    ).userLookupWarning();
    const total = (component as unknown as { total: () => number }).total();

    expect(loadError).toBeNull();
    expect(warning).toBe('User lookup failed');
    expect(total).toBe(6);
    expect(apiMock.listAssessments).toHaveBeenCalledTimes(2);
  });

  it('hides raw internal dashboard errors and clears assessments when the api throws', async () => {
    apiMock.listAssessments.mockRejectedValueOnce(new Error('internal error'));

    component.refresh();
    await fixture.whenStable();
    fixture.detectChanges();

    const loadError = (component as unknown as { loadError: () => string | null }).loadError();
    const warning = (
      component as unknown as { userLookupWarning: () => string | null }
    ).userLookupWarning();
    expect(loadError).toBeNull();
    expect(warning).toBeNull();
    const total = (component as unknown as { total: () => number }).total();
    expect(total).toBe(0);
    const loading = (component as unknown as { loading: () => boolean }).loading();
    expect(loading).toBe(false);
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
    buildRow({ id: 't-1', status: 'New', createdAt: '2024-03-10T10:00:00.000Z' }),
    buildRow({ id: 't-2', status: 'InProgress', createdAt: '2024-03-12T10:00:00.000Z' }),
    buildRow({ id: 't-3', status: 'InProgress', createdAt: '2024-03-08T10:00:00.000Z' }),
    buildRow({ id: 't-4', status: 'Completed', createdAt: '2024-03-05T10:00:00.000Z' }),
    buildRow({ id: 't-5', status: 'Cancelled', createdAt: '2024-03-02T10:00:00.000Z' }),
    buildRow({ id: 't-6', status: 'Verified', createdAt: '2024-03-11T10:00:00.000Z' }),
  ];
  const page: AdminAssessmentListPage = {
    items: seed,
    meta: { page: 1, limit: 200, totalItems: seed.length, totalPages: 1 },
  };
  return {
    listAssessments: jest.fn(async () => page),
    getAssessment: jest.fn(),
    verifyAssessment: jest.fn(),
    completeAssessment: jest.fn(),
    cancelAssessment: jest.fn(),
  };
}

function createUserMock() {
  const users = new Map<string, AdminUserRef>([
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
