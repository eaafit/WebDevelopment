import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

export type ViewMode = 'list' | 'edit' | 'pdf';
export type AssessmentStatus = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';
export type ObjectType =
  | 'Apartment'
  | 'House'
  | 'Room'
  | 'Apartments'
  | 'LandPlot'
  | 'CommercialProperty';
export type SortField =
  | 'address'
  | 'objectType'
  | 'area'
  | 'status'
  | 'createdAt'
  | 'estimatedValue';
export type SortDir = 'asc' | 'desc';

export interface Assessment {
  id: string;
  status: AssessmentStatus;
  createdAt: string;
  updatedAt: string;
  address: string;
  description?: string;
  estimatedValue?: number;
}
export interface RealEstateObject {
  id: string;
  city: string;
  district?: string;
  address: string;
  area: number;
  objectType: ObjectType;
  roomsCount?: number;
  floorsTotal: number;
  floor?: number;
  condition: 'NewBuilding' | 'Good' | 'NeedsRepair' | 'Emergency';
  yearBuilt?: number;
  wallMaterial?: string;
  elevatorType?: string;
  description?: string;
}
export interface AssessmentItem {
  assessment: Assessment;
  realEstate: RealEstateObject;
}
interface Notary {
  city: string;
  fio: string;
  officeNumber: string;
  officeAddress: string;
}
interface Company {
  name: string;
  address: string;
}

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  New: 'Новая',
  Verified: 'Проверена',
  InProgress: 'В работе',
  Completed: 'Завершена',
  Cancelled: 'Отменена',
};
export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  Apartment: 'Квартира',
  House: 'Жилой дом',
  Room: 'Комната',
  Apartments: 'Апартаменты',
  LandPlot: 'Земельный участок',
  CommercialProperty: 'Нежилое помещение',
};
export const CONDITION_LABELS: Record<string, string> = {
  NewBuilding: 'Новостройка',
  Good: 'Хорошее',
  NeedsRepair: 'Требует ремонта',
  Emergency: 'Аварийное',
};
export const WALL_LABELS: Record<string, string> = {
  Brick: 'Кирпич',
  Panel: 'Панель',
  Block: 'Блок',
  Monolithic: 'Монолит',
  MonolithicBrick: 'Монолит-кирпич',
  Wooden: 'Деревянный',
  AeratedConcrete: 'Газобетон',
};
export const ELEVATOR_LABELS: Record<string, string> = {
  None: 'Нет',
  Cargo: 'Грузовой',
  Passenger: 'Пассажирский',
  PassengerAndCargo: 'Пассажирский и грузовой',
};

const MOCK_ITEMS: AssessmentItem[] = [
  {
    assessment: {
      id: '1',
      status: 'New',
      createdAt: '2026-03-01T10:00:00Z',
      updatedAt: '2026-03-01T10:00:00Z',
      address: 'Москва, Тверская ул., д. 10, кв. 5',
      description: 'Двухкомнатная квартира в центре',
      estimatedValue: 8500000,
    },
    realEstate: {
      id: 're1',
      city: 'Москва',
      district: 'Центральный',
      address: 'Москва, Тверская ул., д. 10, кв. 5',
      area: 54.6,
      objectType: 'Apartment',
      roomsCount: 2,
      floorsTotal: 9,
      floor: 5,
      condition: 'Good',
      yearBuilt: 1985,
      wallMaterial: 'Brick',
      elevatorType: 'Passenger',
    },
  },
  {
    assessment: {
      id: '2',
      status: 'InProgress',
      createdAt: '2026-03-05T14:30:00Z',
      updatedAt: '2026-03-06T09:00:00Z',
      address: 'Санкт-Петербург, Невский пр-т, д. 28, кв. 12',
      estimatedValue: 12300000,
    },
    realEstate: {
      id: 're2',
      city: 'Санкт-Петербург',
      district: 'Центральный',
      address: 'Санкт-Петербург, Невский пр-т, д. 28, кв. 12',
      area: 78.2,
      objectType: 'Apartment',
      roomsCount: 3,
      floorsTotal: 6,
      floor: 3,
      condition: 'Good',
      yearBuilt: 1972,
      wallMaterial: 'Brick',
      elevatorType: 'None',
    },
  },
  {
    assessment: {
      id: '3',
      status: 'Verified',
      createdAt: '2026-03-08T11:00:00Z',
      updatedAt: '2026-03-09T10:00:00Z',
      address: 'Казань, ул. Баумана, д. 5',
    },
    realEstate: {
      id: 're3',
      city: 'Казань',
      address: 'Казань, ул. Баумана, д. 5',
      area: 120.0,
      objectType: 'House',
      roomsCount: 5,
      floorsTotal: 2,
      floor: 0,
      condition: 'NeedsRepair',
      yearBuilt: 1960,
      wallMaterial: 'Wooden',
      elevatorType: 'None',
    },
  },
  {
    assessment: {
      id: '4',
      status: 'Completed',
      createdAt: '2026-02-20T09:00:00Z',
      updatedAt: '2026-03-01T15:00:00Z',
      address: 'Екатеринбург, ул. Малышева, д. 16, кв. 88',
      estimatedValue: 4200000,
    },
    realEstate: {
      id: 're4',
      city: 'Екатеринбург',
      district: 'Центральный',
      address: 'Екатеринбург, ул. Малышева, д. 16, кв. 88',
      area: 32.4,
      objectType: 'Room',
      floorsTotal: 12,
      floor: 8,
      condition: 'Good',
      yearBuilt: 1995,
      wallMaterial: 'Panel',
      elevatorType: 'PassengerAndCargo',
    },
  },
  {
    assessment: {
      id: '5',
      status: 'New',
      createdAt: '2026-03-15T08:00:00Z',
      updatedAt: '2026-03-15T08:00:00Z',
      address: 'Новосибирск, ул. Ленина, д. 32, кв. 7',
    },
    realEstate: {
      id: 're5',
      city: 'Новосибирск',
      address: 'Новосибирск, ул. Ленина, д. 32, кв. 7',
      area: 45.0,
      objectType: 'Apartment',
      roomsCount: 1,
      floorsTotal: 5,
      floor: 2,
      condition: 'NewBuilding',
      yearBuilt: 2022,
      wallMaterial: 'Monolithic',
      elevatorType: 'Passenger',
    },
  },
  {
    assessment: {
      id: '6',
      status: 'Cancelled',
      createdAt: '2026-01-10T12:00:00Z',
      updatedAt: '2026-01-15T12:00:00Z',
      address: 'Москва, ул. Арбат, д. 20, офис 5',
    },
    realEstate: {
      id: 're6',
      city: 'Москва',
      district: 'Центральный',
      address: 'Москва, ул. Арбат, д. 20, офис 5',
      area: 95.0,
      objectType: 'CommercialProperty',
      floorsTotal: 7,
      floor: 3,
      condition: 'Good',
      yearBuilt: 2005,
      wallMaterial: 'Monolithic',
    },
  },
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function fmtDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}
function randomOutgoing(): string {
  return `NR-${new Date().getFullYear()}-${Math.floor(Math.random() * 900000) + 100000}`;
}
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

@Component({
  selector: 'lib-request-price',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequestPrice implements OnInit {
  private readonly fb = inject(FormBuilder);

  readonly view = signal<ViewMode>('list');
  readonly assessments = signal<AssessmentItem[]>([]);
  readonly isLoadingAssessments = signal(true);
  readonly searchQuery = signal('');
  readonly statusFilter = signal<AssessmentStatus | ''>('');
  readonly typeFilter = signal<ObjectType | ''>('');
  readonly sortField = signal<SortField>('createdAt');
  readonly sortDir = signal<SortDir>('desc');
  readonly deleteTarget = signal<AssessmentItem | null>(null);
  readonly isDeleting = signal(false);

  readonly filteredAssessments = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const st = this.statusFilter();
    const tp = this.typeFilter();
    const sf = this.sortField();
    const sd = this.sortDir();
    const list = this.assessments().filter((item) => {
      const mQ =
        !q ||
        item.assessment.address.toLowerCase().includes(q) ||
        item.realEstate.city.toLowerCase().includes(q) ||
        (item.realEstate.district ?? '').toLowerCase().includes(q);
      return (
        mQ && (!st || item.assessment.status === st) && (!tp || item.realEstate.objectType === tp)
      );
    });
    return [...list].sort((a, b) => {
      let vA: string | number = '',
        vB: string | number = '';
      switch (sf) {
        case 'address':
          vA = a.assessment.address;
          vB = b.assessment.address;
          break;
        case 'objectType':
          vA = a.realEstate.objectType;
          vB = b.realEstate.objectType;
          break;
        case 'area':
          vA = a.realEstate.area;
          vB = b.realEstate.area;
          break;
        case 'status':
          vA = a.assessment.status;
          vB = b.assessment.status;
          break;
        case 'createdAt':
          vA = a.assessment.createdAt;
          vB = b.assessment.createdAt;
          break;
        case 'estimatedValue':
          vA = a.assessment.estimatedValue ?? 0;
          vB = b.assessment.estimatedValue ?? 0;
          break;
      }
      if (vA < vB) return sd === 'asc' ? -1 : 1;
      if (vA > vB) return sd === 'asc' ? 1 : -1;
      return 0;
    });
  });

  readonly statusKeys = Object.keys(STATUS_LABELS) as AssessmentStatus[];
  readonly typeKeys = Object.keys(OBJECT_TYPE_LABELS) as ObjectType[];
  readonly conditionKeys = Object.keys(CONDITION_LABELS);
  readonly wallKeys = Object.keys(WALL_LABELS);
  readonly elevatorKeys = Object.keys(ELEVATOR_LABELS);
  readonly statusLabels = STATUS_LABELS;
  readonly typeLabels = OBJECT_TYPE_LABELS;
  readonly conditionLabels = CONDITION_LABELS;
  readonly wallLabels = WALL_LABELS;
  readonly elevatorLabels = ELEVATOR_LABELS;

  ngOnInit(): void {
    this.loadAssessments();
  }

  loadAssessments(): void {
    this.isLoadingAssessments.set(true);
    setTimeout(() => {
      this.assessments.set([...MOCK_ITEMS]);
      this.isLoadingAssessments.set(false);
    }, 300);
  }

  onSearchInput(e: Event): void {
    this.searchQuery.set((e.target as HTMLInputElement).value);
  }
  onStatusFilterChange(e: Event): void {
    this.statusFilter.set((e.target as HTMLSelectElement).value as AssessmentStatus | '');
  }
  onTypeFilterChange(e: Event): void {
    this.typeFilter.set((e.target as HTMLSelectElement).value as ObjectType | '');
  }
  clearFilters(): void {
    this.searchQuery.set('');
    this.statusFilter.set('');
    this.typeFilter.set('');
  }
  hasActiveFilters(): boolean {
    return !!this.searchQuery() || !!this.statusFilter() || !!this.typeFilter();
  }

  sortBy(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortField.set(field);
      this.sortDir.set('asc');
    }
  }
  sortIcon(f: SortField): string {
    if (this.sortField() !== f) return '↕';
    return this.sortDir() === 'asc' ? '↑' : '↓';
  }
  isSortActive(f: SortField): boolean {
    return this.sortField() === f;
  }

  openDeleteModal(item: AssessmentItem): void {
    this.deleteTarget.set(item);
  }
  closeDeleteModal(): void {
    this.deleteTarget.set(null);
  }

  confirmDelete(): void {
    const item = this.deleteTarget();
    if (!item) return;
    this.isDeleting.set(true);
    setTimeout(() => {
      this.assessments.update((l) => l.filter((i) => i.assessment.id !== item.assessment.id));
      this.isDeleting.set(false);
      this.closeDeleteModal();
    }, 200);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeDeleteModal();
  }

  getStatusLabel(s: string): string {
    return STATUS_LABELS[s as AssessmentStatus] ?? s;
  }
  getStatusClass(s: string): string {
    const m: Record<string, string> = {
      New: 'badge--new',
      Verified: 'badge--verified',
      InProgress: 'badge--inprogress',
      Completed: 'badge--completed',
      Cancelled: 'badge--cancelled',
    };
    return `badge ${m[s] ?? ''}`;
  }
  getTypeLabel(t: string): string {
    return OBJECT_TYPE_LABELS[t as ObjectType] ?? t;
  }
  formatAssessmentDate(s: string): string {
    const d = new Date(s);
    return isNaN(d.getTime())
      ? s
      : d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  formatCurrency(v: number): string {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(v);
  }

  readonly editItem = signal<AssessmentItem | null>(null);
  readonly isSaving = signal(false);
  readonly showEditErrors = signal(false);
  readonly cities = ['Москва', 'Санкт-Петербург', 'Казань', 'Екатеринбург', 'Новосибирск'];
  readonly districts = ['Центральный', 'Северный', 'Южный', 'Западный', 'Восточный'];
  get isEditMode(): boolean {
    return !!this.editItem();
  }
  get editTitle(): string {
    return this.isEditMode ? 'Редактирование заявки' : 'Новая заявка';
  }

  readonly editForm = this.fb.group({
    status: ['New' as AssessmentStatus, Validators.required],
    address: ['', [Validators.required, Validators.minLength(8)]],
    description: [''],
    estimatedValue: [null as number | null],
    city: ['', Validators.required],
    district: [''],
    area: [null as number | null, [Validators.required, Validators.min(1)]],
    objectType: ['' as ObjectType | '', Validators.required],
    roomsCount: [null as number | null],
    floorsTotal: [null as number | null, [Validators.required, Validators.min(1)]],
    floor: [null as number | null],
    condition: ['', Validators.required],
    yearBuilt: [null as number | null],
    wallMaterial: [''],
    elevatorType: [''],
  });

  openAddForm(): void {
    this.editItem.set(null);
    this.showEditErrors.set(false);
    this.editForm.reset({ status: 'New' });
    this.view.set('edit');
  }

  openEditForm(item: AssessmentItem): void {
    this.editItem.set(item);
    this.showEditErrors.set(false);
    const { assessment: a, realEstate: r } = item;
    this.editForm.patchValue({
      status: a.status,
      address: a.address,
      description: a.description ?? '',
      estimatedValue: a.estimatedValue ?? null,
      city: r.city,
      district: r.district ?? '',
      area: r.area,
      objectType: r.objectType,
      roomsCount: r.roomsCount ?? null,
      floorsTotal: r.floorsTotal,
      floor: r.floor ?? null,
      condition: r.condition,
      yearBuilt: r.yearBuilt ?? null,
      wallMaterial: r.wallMaterial ?? '',
      elevatorType: r.elevatorType ?? '',
    });
    this.view.set('edit');
  }

  onSaveEdit(): void {
    this.showEditErrors.set(true);
    if (this.editForm.invalid) return;
    const v = this.editForm.getRawValue();
    const { address, city, area, objectType, floorsTotal, condition } = v;
    if (
      !address ||
      !city ||
      area == null ||
      !objectType ||
      floorsTotal == null ||
      !condition
    ) {
      return;
    }
    const reCondition = condition as RealEstateObject['condition'];
    const now = new Date().toISOString();
    this.isSaving.set(true);
    setTimeout(() => {
      const item = this.editItem();
      if (item) {
        const updated: AssessmentItem = {
          assessment: {
            ...item.assessment,
            status: v.status as AssessmentStatus,
            address,
            description: v.description || undefined,
            estimatedValue: v.estimatedValue ?? undefined,
            updatedAt: now,
          },
          realEstate: {
            ...item.realEstate,
            city,
            district: v.district || undefined,
            area,
            objectType: objectType as ObjectType,
            roomsCount: v.roomsCount ?? undefined,
            floorsTotal,
            floor: v.floor ?? undefined,
            condition: reCondition,
            yearBuilt: v.yearBuilt ?? undefined,
            wallMaterial: v.wallMaterial || undefined,
            elevatorType: v.elevatorType || undefined,
          },
        };
        this.assessments.update((l) =>
          l.map((i) => (i.assessment.id === item.assessment.id ? updated : i)),
        );
      } else {
        const id = generateId();
        const newItem: AssessmentItem = {
          assessment: {
            id,
            status: v.status as AssessmentStatus,
            address,
            description: v.description || undefined,
            estimatedValue: v.estimatedValue ?? undefined,
            createdAt: now,
            updatedAt: now,
          },
          realEstate: {
            id: `re-${id}`,
            city,
            district: v.district || undefined,
            address,
            area,
            objectType: objectType as ObjectType,
            roomsCount: v.roomsCount ?? undefined,
            floorsTotal,
            floor: v.floor ?? undefined,
            condition: reCondition,
            yearBuilt: v.yearBuilt ?? undefined,
            wallMaterial: v.wallMaterial || undefined,
            elevatorType: v.elevatorType || undefined,
          },
        };
        this.assessments.update((l) => [newItem, ...l]);
      }
      this.isSaving.set(false);
      this.view.set('list');
    }, 200);
  }

  isEditInvalid(name: string): boolean {
    const c = this.editForm.get(name);
    return !!c && c.invalid && this.showEditErrors();
  }

  readonly pdfItem = signal<AssessmentItem | null>(null);
  readonly isGenerating = signal(false);
  selectedPdfName: string | null = null;
  filteredNotaries: Notary[] = [];
  requestText = '';
  get isFormVisible(): boolean {
    return this.view() === 'pdf';
  }
  selectedAssessmentId = computed(() => this.pdfItem()?.assessment.id ?? null);

  readonly notaries: Notary[] = [
    {
      city: 'Москва',
      fio: 'Иванов Иван Иванович',
      officeNumber: '12',
      officeAddress: 'г. Москва, ул. Тверская, д. 10',
    },
    {
      city: 'Москва',
      fio: 'Петров Пётр Петрович',
      officeNumber: '48',
      officeAddress: 'г. Москва, ул. Арбат, д. 7',
    },
    {
      city: 'Санкт-Петербург',
      fio: 'Сидорова Анна Сергеевна',
      officeNumber: '5',
      officeAddress: 'г. Санкт-Петербург, Невский пр., д. 25',
    },
    {
      city: 'Казань',
      fio: 'Нуриев Рустам Ильдарович',
      officeNumber: '9',
      officeAddress: 'г. Казань, ул. Баумана, д. 18',
    },
    {
      city: 'Екатеринбург',
      fio: 'Белова Татьяна Викторовна',
      officeNumber: '3',
      officeAddress: 'г. Екатеринбург, ул. Ленина, д. 52',
    },
  ];
  readonly companies: Company[] = [
    { name: 'ООО "ОценкаПрофи"', address: 'г. Москва, ул. Мясницкая, д. 15' },
    { name: 'АО "Эксперт-Оценка"', address: 'г. Санкт-Петербург, ул. Рубинштейна, д. 9' },
    { name: 'ООО "Рынок и Стоимость"', address: 'г. Казань, ул. Баумана, д. 3' },
    { name: 'ИП Кузнецов А.В.', address: 'г. Екатеринбург, ул. Малышева, д. 101' },
  ];
  readonly propertyTypes: string[] = [
    'Квартира',
    'Комната',
    'Жилой дом',
    'Земельный участок',
    'Нежилое помещение',
  ];

  private readonly _outgoingNumber = signal<string>(randomOutgoing());
  private readonly _outgoingDate = signal<string>(fmtDate(new Date()));
  readonly outgoingDisplay = computed(() => `${this._outgoingNumber()} от ${this._outgoingDate()}`);

  readonly form = this.fb.group({
    notaryCity: ['', Validators.required],
    notaryFio: ['', Validators.required],
    notaryOfficeNumber: [''],
    notaryOfficeAddress: [''],
    companyName: ['', Validators.required],
    companyAddress: [''],
    propertyAddress: ['', Validators.required],
    cadastralNumber: ['', Validators.required],
    propertyType: ['', Validators.required],
    specialConditions: [''],
    docRequisites: ['', Validators.required],
    notarialAction: ['', Validators.required],
    valuationDate: ['', Validators.required],
    reportDueDate: ['', Validators.required],
    extraNotes: [''],
  });

  constructor() {
    this.buildRequestText();
    this.form.valueChanges.subscribe(() => this.buildRequestText());
  }

  openPdfForm(item: AssessmentItem): void {
    this.pdfItem.set(item);
    const r = item.realEstate;
    const conditions = [
      r.area ? `Площадь: ${r.area} м²` : '',
      r.floor != null ? `Этаж: ${r.floor} из ${r.floorsTotal}` : '',
      r.yearBuilt ? `Год постройки: ${r.yearBuilt}` : '',
      item.assessment.description ?? '',
    ]
      .filter(Boolean)
      .join(', ');
    this.form.patchValue({
      propertyAddress: item.assessment.address,
      propertyType: OBJECT_TYPE_LABELS[r.objectType] ?? r.objectType,
      specialConditions: conditions,
    });
    this.view.set('pdf');
  }
  selectAssessment(item: AssessmentItem): void {
    this.openPdfForm(item);
  }

  regenerateOutgoing(): void {
    this._outgoingNumber.set(randomOutgoing());
    this._outgoingDate.set(fmtDate(new Date()));
    this.buildRequestText();
  }

  onNotaryCityChange(): void {
    const city = this.form.get('notaryCity')?.value ?? '';
    this.filteredNotaries = this.notaries.filter((n) => n.city === city);
    this.form.patchValue(
      { notaryFio: '', notaryOfficeNumber: '', notaryOfficeAddress: '' },
      { emitEvent: false },
    );
    this.buildRequestText();
  }
  onNotaryFioChange(): void {
    const fio = this.form.get('notaryFio')?.value ?? '';
    const found = this.notaries.find((n) => n.fio === fio);
    this.form.patchValue(
      {
        notaryOfficeNumber: found?.officeNumber ?? '',
        notaryOfficeAddress: found?.officeAddress ?? '',
      },
      { emitEvent: false },
    );
    this.buildRequestText();
  }
  onCompanyChange(): void {
    const name = this.form.get('companyName')?.value ?? '';
    const found = this.companies.find((c) => c.name === name);
    this.form.patchValue({ companyAddress: found?.address ?? '' }, { emitEvent: false });
    this.buildRequestText();
  }
  onPdfSelected(event: Event): void {
    this.selectedPdfName = (event.target as HTMLInputElement).files?.[0]?.name ?? null;
    this.buildRequestText();
  }

  onSubmit(): void {
    this.buildRequestText();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    alert('Запрос сформирован. Скопируйте текст из блока предпросмотра.');
  }
  async copyToClipboard(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.requestText);
      alert('Текст запроса скопирован!');
    } catch {
      alert('Не удалось скопировать. Выделите текст вручную.');
    }
  }

  private buildRequestText(): void {
    const v = this.form.getRawValue();
    const notaryCity = v.notaryCity || '{Город}';
    const notaryFio = v.notaryFio || '{Фамилия И.О.}';
    const officeNumber = v.notaryOfficeNumber || '{Номер}';
    const officeAddress = v.notaryOfficeAddress || '{Адрес нотариуса}';
    const companyName = v.companyName || '{Название компании}';
    const companyAddress = v.companyAddress || '{Адрес компании}';
    const propertyAddress = v.propertyAddress || '{Адрес объекта недвижимости}';
    const cadastralNumber = v.cadastralNumber || '{Кадастровый номер}';
    const propertyType =
      v.propertyType ||
      '{Вид объекта (например: квартира, жилой дом, земельный участок, нежилое помещение)}';
    const docRequisites =
      v.docRequisites ||
      '{Реквизиты документа, подтверждающего право собственности (вид, номер, дата, кем выдан)}';
    const notarialAction =
      v.notarialAction ||
      '{Цель оценки (например: для заключения договора дарения, для вступления в наследство)}';
    const valuationDate = v.valuationDate || '{Дата оценки}';
    const reportDueDate = v.reportDueDate || '{Дата окончания срока}';
    const special = v.specialConditions?.trim() || '—';
    const extra = v.extraNotes?.trim() || '—';
    this.requestText = `Нотариальный запрос о проведении оценки рыночной стоимости объекта недвижимости
От: Нотариус города ${notaryCity} ${notaryFio}, нотариальная контора № ${officeNumber}, расположенная по адресу: ${officeAddress}
Исх. №: ${this._outgoingNumber()}
Дата: ${this._outgoingDate()}

Кому: Руководителю
Оценочной компании "${companyName}"
${companyAddress}

Запрос

На основании необходимости совершения нотариального действия (${notarialAction}) и в соответствии со статьей 47 "Основ законодательства Российской Федерации о нотариате", прошу Вас провести оценку рыночной стоимости объекта недвижимости и предоставить в мою адрес письменный отчет об оценке, соответствующий требованиям Федерального закона от 29.07.1998 № 135-ФЗ "Об оценочной деятельности в Российской Федерации" и Федеральных стандартов оценки (ФСО).

Параметры объекта для оценки:

Адрес объекта: ${propertyAddress}
Кадастровый номер: ${cadastralNumber}
Вид объекта: ${propertyType}
Правоустанавливающие документы: ${docRequisites}
Цель проведения оценки: ${notarialAction}
Дата, на которую требуется определить стоимость: ${valuationDate}
Особые условия/характеристики: ${special}
Дополнительные комментарии: ${extra}

Отчет об оценке должен быть представлен на бумажном носителе, подписан и заверен печатью оценщика, с приложением копии квалификационного аттестата оценщика.

Срок предоставления отчета: до ${reportDueDate}.

Приложение:
- Документ (PDF): ${this.selectedPdfName ?? 'не выбран'}.
- Копия технического паспорта/плана БТИ.
- Выписка из ЕГРН.`;
  }
}
