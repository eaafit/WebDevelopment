import { TestBed } from '@angular/core/testing';
import { TokenStore, UserRole } from '@notary-portal/ui';
import type { WorkspaceAssessment } from '@notary-portal/api-contracts';
import { RequestPrice } from './assessment';
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

describe('Assessment workspace', () => {
  const api = {
    list: jest.fn(),
    get: jest.fn(),
    catalogs: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    status: jest.fn(),
  };
  beforeEach(() => {
    jest.resetAllMocks();
    api.list.mockResolvedValue({ items: [item], page: 1, totalPages: 1, total: 1 });
    api.get.mockResolvedValue(JSON.parse(JSON.stringify(item)));
    api.catalogs.mockResolvedValue({
      cities: [{ id: item.property!.cityId, name: 'Москва' }],
      applicants: [{ id: item.userId, name: 'Заявитель' }],
    });
    TestBed.configureTestingModule({
      imports: [RequestPrice],
      providers: [
        { provide: AssessmentReadApiService, useValue: api },
        {
          provide: TokenStore,
          useValue: { role: () => UserRole.Notary, user: () => ({ id: 'notary' }) },
        },
      ],
    });
  });
  const create = () => TestBed.createComponent(RequestPrice);
  it('renders city, operations and no demo switch', async () => {
    const fixture = create();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Москва');
    expect(text).toContain('Создать заказ');
    expect(text).toContain('Изменить');
    expect(text).not.toContain('Деморежим');
    fixture.destroy();
  });
  it('sends search and filters to server with requested page', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.search = 'Тверская';
    c.status = 'Verified';
    c.cityId = 'city';
    c.type = 'Apartment';
    await c.load(2);
    expect(api.list).toHaveBeenCalledWith(2, {
      search: 'Тверская',
      status: 'Verified',
      cityId: 'city',
      type: 'Apartment',
    });
    fixture.destroy();
  });
  it('ignores stale list responses', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    let resolve!: (value: unknown) => void;
    api.list.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    const old = c.load(1);
    await c.load(2);
    resolve({ items: [], total: 0, page: 1, totalPages: 1 });
    await old;
    expect(c.items()).toHaveLength(1);
    fixture.destroy();
  });
  it('loads full detail before opening and populates editor', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    await c.open(item, 'edit');
    expect(api.get).toHaveBeenCalledWith(item.id);
    expect(c.draft.property.cityId).toBe(item.property!.cityId);
    expect(c.dialog()).toBe('edit');
    fixture.destroy();
  });
  it('updates same assessment and reloads list after save', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    await c.open(item, 'edit');
    c.draft.address = 'Новый адрес';
    api.update.mockResolvedValue({ ...item, address: 'Новый адрес' });
    await c.save();
    expect(api.update).toHaveBeenCalledWith(
      item.id,
      expect.objectContaining({ address: 'Новый адрес' }),
    );
    expect(c.selected()?.address).toBe('Новый адрес');
    expect(api.list).toHaveBeenCalled();
    fixture.destroy();
  });
  it('creates an assessment with structured property', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.create();
    c.draft = {
      userId: item.userId,
      address: item.address,
      description: '',
      property: item.property!,
    };
    api.create.mockResolvedValue(item);
    await c.save();
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({
        property: expect.objectContaining({ cityId: item.property!.cityId }),
      }),
    );
    expect(c.dialog()).toBe('view');
    fixture.destroy();
  });
  it('keeps editor data after API error', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    await c.open(item, 'edit');
    api.update.mockRejectedValue(new Error('Ошибка сохранения'));
    await c.save();
    expect(c.dialog()).toBe('edit');
    expect(c.dialogError()).toBe('Ошибка сохранения');
    expect(c.draft.address).toBe(item.address);
    expect(c.busy()).toBe(false);
    fixture.destroy();
  });
  it('deletes only on confirmation and reloads list', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    await c.open(item);
    c.deleteSelected();
    expect(api.remove).not.toHaveBeenCalled();
    api.remove.mockResolvedValue({ deleted: true });
    await c.remove();
    expect(api.remove).toHaveBeenCalledWith(item.id);
    expect(c.dialog()).toBeNull();
    fixture.destroy();
  });
  it('provides valid status actions and no edits on terminal state', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    expect(c.statusOptions(item)).toEqual(['Cancelled']);
    expect(c.canRequest(item)).toBe(true);
    expect(c.statusOptions({ ...item, status: 'Completed' })).toEqual([]);
    expect(c.editable({ ...item, status: 'Completed' })).toBe(false);
    fixture.destroy();
  });
  it('polls persisted status instead of advancing a timer locally', async () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const ordered = {
      ...item,
      status: 'Verified' as const,
      order: {
        id: 'order',
        model: 'standard' as const,
        urgency: 'standard' as const,
        comment: '',
        submittedAt: item.createdAt,
        plannedCompletionDate: item.createdAt,
        actualCompletionDate: null,
        servicePrice: 3000,
        history: [],
      },
    };
    c.selected.set(ordered);
    c.dialog.set('view');
    api.get.mockResolvedValue({ ...ordered, status: 'InProgress' });
    await c.poll();
    expect(c.selected()?.status).toBe('InProgress');
    expect(c.notice()).toContain('В работе');
    fixture.destroy();
  });
});
