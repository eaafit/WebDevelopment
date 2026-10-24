import { TestBed } from '@angular/core/testing';
import type { WorkspaceAssessment } from '@notary-portal/api-contracts';
import { AssessmentRequest } from './assessment-request';
import { AssessmentReadApiService } from './assessment-read-api.service';

const item: WorkspaceAssessment = {
  id: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  applicantName: 'Заявитель',
  address: 'Москва, Тверская, 10',
  description: '',
  status: 'New',
  createdAt: '2026-10-17T08:00:00Z',
  updatedAt: '2026-10-17T08:00:00Z',
  estimatedValue: null,
  cancelReason: null,
  documents: [],
  order: null,
  property: {
    cityId: '33333333-3333-4333-8333-333333333333',
    cityName: 'Москва',
    address: 'Москва, Тверская, 10',
    area: 54,
    objectType: 'Apartment',
    cadastralNumber: '',
    floor: 2,
    floorsTotal: 9,
    roomsCount: 2,
    yearBuilt: 2000,
  },
};

describe('Assessment request', () => {
  const api = { submit: jest.fn() };
  beforeEach(() => {
    jest.resetAllMocks();
    TestBed.configureTestingModule({
      imports: [AssessmentRequest],
      providers: [{ provide: AssessmentReadApiService, useValue: api }],
    });
  });
  const create = () => {
    const fixture = TestBed.createComponent(AssessmentRequest);
    fixture.componentRef.setInput('item', item);
    return fixture;
  };
  it('calculates all model and urgency combinations', () => {
    const c = create().componentInstance;
    expect(c.price).toBe(3000);
    expect(c.days).toBe(5);
    c.parameters.model = 'extended';
    expect(c.price).toBe(5000);
    c.parameters.urgency = 'urgent';
    expect(c.price).toBe(7500);
    expect(c.days).toBe(2);
    c.parameters.model = 'comprehensive';
    expect(c.price).toBe(12000);
    expect(c.days).toBe(2);
    c.parameters.urgency = 'express';
    expect(c.price).toBe(16000);
    expect(c.days).toBe(1);
  });
  it('requires explicit confirmation and prevents duplicate submission', async () => {
    const c = create().componentInstance;
    await c.submit();
    expect(api.submit).not.toHaveBeenCalled();
    c.confirm();
    await c.submit();
    expect(api.submit).not.toHaveBeenCalled();
    let resolve!: (value: WorkspaceAssessment) => void;
    api.submit.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    c.confirmed = true;
    const pending = c.submit();
    await c.submit();
    expect(api.submit).toHaveBeenCalledTimes(1);
    resolve(item);
    await pending;
  });
  it('sends parameters with the assessment ID and emits server result', async () => {
    const c = create().componentInstance;
    c.parameters.comment = 'Для сделки';
    c.confirm();
    c.confirmed = true;
    api.submit.mockResolvedValue(item);
    const saved = jest.fn();
    c.saved.subscribe(saved);
    await c.submit();
    expect(api.submit).toHaveBeenCalledWith(item.id, {
      model: 'standard',
      urgency: 'standard',
      comment: 'Для сделки',
    });
    expect(saved).toHaveBeenCalledWith(item);
  });
  it('retains parameters on failure and permits retry', async () => {
    const c = create().componentInstance;
    c.parameters.model = 'extended';
    c.confirm();
    c.confirmed = true;
    api.submit.mockRejectedValue(new Error('Нет связи'));
    await c.submit();
    expect(c.error()).toBe('Нет связи');
    expect(c.busy()).toBe(false);
    expect(c.parameters.model).toBe('extended');
  });
  it('resets approval when returning to parameters', () => {
    const c = create().componentInstance;
    c.confirm();
    c.confirmed = true;
    c.back();
    expect(c.confirmed).toBe(false);
    expect(c.confirmation()).toBe(false);
  });
});
