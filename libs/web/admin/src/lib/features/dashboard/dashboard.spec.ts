import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminDashboard } from './dashboard';
import { AssessmentItem } from '../RequestAssessment/requests/requests';
import { ASSESSMENTS_STORAGE_KEY } from './dashboard.data';

const MOCK: AssessmentItem[] = [
  {
    id: 't-1',
    userId: 'u',
    applicantName: 'A',
    status: 'New',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-10T10:00:00',
    updatedAt: '2024-03-10T10:00:00',
  },
  {
    id: 't-2',
    userId: 'u',
    applicantName: 'B',
    status: 'InProgress',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-12T10:00:00',
    updatedAt: '2024-03-12T10:00:00',
  },
  {
    id: 't-3',
    userId: 'u',
    applicantName: 'C',
    status: 'InProgress',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-08T10:00:00',
    updatedAt: '2024-03-08T10:00:00',
  },
  {
    id: 't-4',
    userId: 'u',
    applicantName: 'D',
    status: 'Completed',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-05T10:00:00',
    updatedAt: '2024-03-05T10:00:00',
  },
  {
    id: 't-5',
    userId: 'u',
    applicantName: 'E',
    status: 'Cancelled',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-02T10:00:00',
    updatedAt: '2024-03-02T10:00:00',
  },
  {
    id: 't-6',
    userId: 'u',
    applicantName: 'F',
    status: 'Verified',
    address: '',
    description: '',
    estimatedValue: '',
    createdAt: '2024-03-11T10:00:00',
    updatedAt: '2024-03-11T10:00:00',
  },
];

describe('AdminDashboard', () => {
  let component: AdminDashboard;
  let fixture: ComponentFixture<AdminDashboard>;

  beforeEach(async () => {
    localStorage.setItem(ASSESSMENTS_STORAGE_KEY, JSON.stringify(MOCK));

    await TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboard);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.removeItem(ASSESSMENTS_STORAGE_KEY);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes metric counts from localStorage', () => {
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

  it('seeds localStorage when the key is missing', () => {
    localStorage.removeItem(ASSESSMENTS_STORAGE_KEY);

    const fresh = TestBed.createComponent(AdminDashboard);
    fresh.detectChanges();

    const raw = localStorage.getItem(ASSESSMENTS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw ?? '[]').length).toBeGreaterThan(0);
  });
});
