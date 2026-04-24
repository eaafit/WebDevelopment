import {
  ChangeDetectorRef,
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { User } from '../RequestAssessment';

export interface AssessmentItem {
  id: string;
  userId: string;
  applicantName: string;
  status: 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';
  address: string;
  description: string;
  estimatedValue: string;
  notaryId?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotaryOption {
  id: string;
  label: string;
}

type RequestFilterColumn =
  | 'id'
  | 'address'
  | 'applicantName'
  | 'status'
  | 'estimatedValue'
  | 'createdAt'
  | 'actions';

@Component({
  selector: 'lib-requests',
  imports: [CommonModule, FormsModule],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class RequestsComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);

  assessments: AssessmentItem[] = [];
  filteredAssessments: AssessmentItem[] = [];
  paginatedAssessments: AssessmentItem[] = [];

  searchTerm = '';
  dateFrom = '';
  dateTo = '';
  notaryFilter = '';
  private searchSubject$ = new Subject<string>();
  private searchSubscription?: Subscription;

  readonly headerColumns: { key: RequestFilterColumn; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'address', label: 'Адрес' },
    { key: 'applicantName', label: 'Заявитель' },
    { key: 'status', label: 'Статус' },
    { key: 'estimatedValue', label: 'Стоимость' },
    { key: 'createdAt', label: 'Дата создания' },
    { key: 'actions', label: 'Действия' },
  ];

  activeFilterColumn: RequestFilterColumn | null = null;
  columnSelectedValues: Record<RequestFilterColumn, string[]> = {
    id: [],
    address: [],
    applicantName: [],
    status: [],
    estimatedValue: [],
    createdAt: [],
    actions: [],
  };
  currentSortColumn: RequestFilterColumn | null = null;
  currentSortDirection: '' | 'asc' | 'desc' = '';
  filterSearch = '';
  filterSortDraft: '' | 'asc' | 'desc' = '';
  filterSelectedDraft = new Set<string>();

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  pages: number[] = [];

  showView = false;
  selectedAssessment: AssessmentItem | null = null;

  showCancelModal = false;
  assessmentToCancel: AssessmentItem | null = null;
  cancelReason = '';
  cancelReasonError = '';

  showVerifyModal = false;
  assessmentToVerify: AssessmentItem | null = null;
  notaryId = '';
  notaryIdError = '';
  notaryOptions: NotaryOption[] = [];

  showStartWorkModal = false;
  assessmentToStartWork: AssessmentItem | null = null;

  showCompleteModal = false;
  assessmentToComplete: AssessmentItem | null = null;

  readonly statusLabels: Record<string, string> = {
    New: 'Новая',
    Verified: 'Подтверждена',
    InProgress: 'В работе',
    Completed: 'Завершена',
    Cancelled: 'Отменена',
  };

  readonly statusBadgeClasses: Record<string, string> = {
    New: 'badge-primary',
    Verified: 'badge-info',
    InProgress: 'badge-warning',
    Completed: 'badge-success',
    Cancelled: 'badge-danger',
  };

  ngOnInit(): void {
    this.searchSubscription = this.searchSubject$.pipe(debounceTime(300)).subscribe(() => {
      this.applyFilters();
      this.cdr.detectChanges();
    });
    this.initializeData();
    this.loadNotaries();
    this.applyFilters();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    if (!value) {
      this.applyFilters();
    } else {
      this.searchSubject$.next(value);
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private initializeData(): void {
    this.ensureUsersSeeded();

    if (!localStorage.getItem('assessments')) {
      // WIP: T-C1 — заменить чтение/запись localStorage на RPC-вызов
      const notaryIds = this.readNotaryIds();
      const pickNotary = (i: number): string | undefined =>
        notaryIds.length ? notaryIds[i % notaryIds.length] : undefined;

      const testData: AssessmentItem[] = [
        {
          id: this.generateUUID(),
          userId: 'user-001',
          applicantName: 'Иванов Иван Иванович',
          status: 'New',
          address: 'г. Москва, ул. Тверская, д. 12, кв. 45',
          description: 'Оценка жилого помещения для ипотечного кредитования',
          estimatedValue: '',
          createdAt: '2024-03-01T10:00:00',
          updatedAt: '2024-03-01T10:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-002',
          applicantName: 'Петрова Мария Сергеевна',
          status: 'Verified',
          address: 'г. Санкт-Петербург, Невский пр., д. 78, кв. 3',
          description: 'Оценка коммерческой недвижимости для продажи',
          estimatedValue: '',
          notaryId: pickNotary(0),
          createdAt: '2024-03-05T14:30:00',
          updatedAt: '2024-03-06T09:15:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-003',
          applicantName: 'Сидоров Алексей Петрович',
          status: 'InProgress',
          address: 'г. Казань, ул. Баумана, д. 33',
          description: 'Оценка земельного участка под строительство',
          estimatedValue: '4500000',
          notaryId: pickNotary(1),
          createdAt: '2024-02-20T11:45:00',
          updatedAt: '2024-03-10T16:20:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-004',
          applicantName: 'Козлова Елена Викторовна',
          status: 'Completed',
          address: 'г. Екатеринбург, ул. Ленина, д. 5, кв. 12',
          description: 'Оценка квартиры для наследственного дела',
          estimatedValue: '3200000',
          createdAt: '2024-02-10T09:00:00',
          updatedAt: '2024-03-01T14:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-005',
          applicantName: 'Новиков Дмитрий Александрович',
          status: 'Cancelled',
          address: 'г. Новосибирск, ул. Красный пр., д. 100',
          description: 'Оценка нежилого помещения',
          estimatedValue: '',
          createdAt: '2024-02-15T16:30:00',
          updatedAt: '2024-02-18T10:00:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-006',
          applicantName: 'Васильева Ольга Михайловна',
          status: 'New',
          address: 'г. Нижний Новгород, ул. Горького, д. 22, кв. 8',
          description: 'Оценка жилого дома для раздела имущества',
          estimatedValue: '',
          createdAt: '2024-03-12T08:15:00',
          updatedAt: '2024-03-12T08:15:00',
        },
        {
          id: this.generateUUID(),
          userId: 'user-007',
          applicantName: 'Морозов Сергей Владимирович',
          status: 'InProgress',
          address: 'г. Краснодар, ул. Красная, д. 55',
          description: 'Оценка гаражного помещения',
          estimatedValue: '1800000',
          notaryId: pickNotary(0),
          createdAt: '2024-03-08T13:00:00',
          updatedAt: '2024-03-11T11:30:00',
        },
      ];
      localStorage.setItem('assessments', JSON.stringify(testData));
    }

    this.assessments = JSON.parse(localStorage.getItem('assessments') ?? '[]');
  }

  private ensureUsersSeeded(): void {
    // WIP: T-C1 — заменить чтение/запись localStorage на RPC-вызов
    // Минимальный seed активных нотариусов, чтобы dropdown в модалке Verify
    // и фильтр по нотариусу в T-A2 имели данные при первом заходе на /admin/orders.
    if (localStorage.getItem('users')) return;
    const seed: User[] = [
      {
        id: 'seed-notary-petrova',
        firstName: 'Мария',
        lastName: 'Петрова',
        middleName: 'Сергеевна',
        email: 'petrova@example.com',
        phoneNumber: '+7 (999) 234-56-78',
        role: 'Notary',
        subscriptionPlan: 'Premium',
        isActive: true,
        createdAt: '2024-01-20T14:20:00',
        updatedAt: '2024-02-01T09:15:00',
      },
      {
        id: 'seed-notary-novikov',
        firstName: 'Дмитрий',
        lastName: 'Новиков',
        middleName: 'Александрович',
        email: 'novikov@example.com',
        phoneNumber: '+7 (999) 567-89-01',
        role: 'Notary',
        subscriptionPlan: 'Premium',
        isActive: true,
        createdAt: '2024-02-08T09:15:00',
        updatedAt: '2024-02-08T09:15:00',
      },
      {
        id: 'seed-notary-morozov',
        firstName: 'Сергей',
        lastName: 'Морозов',
        middleName: 'Владимирович',
        email: 'morozov@example.com',
        phoneNumber: '+7 (999) 789-01-23',
        role: 'Notary',
        subscriptionPlan: 'Basic',
        isActive: false,
        createdAt: '2024-02-15T10:00:00',
        updatedAt: '2024-02-20T15:20:00',
      },
    ];
    localStorage.setItem('users', JSON.stringify(seed));
  }

  private readNotaryIds(): string[] {
    return this.readUsers()
      .filter((u) => u.role === 'Notary' && u.isActive)
      .map((u) => u.id);
  }

  private readUsers(): User[] {
    // WIP: T-C1 — заменить чтение/запись localStorage на RPC-вызов
    const raw = localStorage.getItem('users');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as User[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private loadNotaries(): void {
    this.notaryOptions = this.readUsers()
      .filter((u) => u.role === 'Notary' && u.isActive)
      .map((u) => ({
        id: u.id,
        label: `${u.lastName} ${u.firstName} ${u.middleName} (${this.getShortId(u.id)})`,
      }));
  }

  private saveToStorage(): void {
    localStorage.setItem('assessments', JSON.stringify(this.assessments));
  }

  // ========== ФИЛЬТРАЦИЯ И СОРТИРОВКА ==========

  applyFilters(): void {
    let result = [...this.assessments];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.address.toLowerCase().includes(term) ||
          a.applicantName.toLowerCase().includes(term) ||
          a.id.toLowerCase().includes(term),
      );
    }

    if (this.dateFrom) {
      const from = this.dateFrom;
      result = result.filter((a) => a.createdAt.slice(0, 10) >= from);
    }

    if (this.dateTo) {
      const to = this.dateTo;
      result = result.filter((a) => a.createdAt.slice(0, 10) <= to);
    }

    if (this.notaryFilter) {
      const notary = this.notaryFilter;
      result = result.filter((a) => a.notaryId === notary);
    }

    result = result.filter((a) => this.matchesColumnFilters(a));
    result.sort((a, b) => this.compareByActiveSort(a, b));

    this.filteredAssessments = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  resetTopFilters(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.notaryFilter = '';
    this.applyFilters();
  }

  // ========== COLUMN FILTER ==========

  toggleColumnFilter(column: RequestFilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) {
      this.activeFilterColumn = null;
      return;
    }
    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);
  }

  closeColumnFilter(): void {
    this.activeFilterColumn = null;
  }

  setDraftSort(direction: 'asc' | 'desc'): void {
    this.filterSortDraft = direction;
  }

  clearCurrentColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    this.columnSelectedValues[this.activeFilterColumn] = [];
    if (this.currentSortColumn === this.activeFilterColumn) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
      this.filterSortDraft = '';
    }
    this.filterSearch = '';
    this.filterSelectedDraft = new Set(this.getUniqueColumnValues(this.activeFilterColumn));
    this.currentPage = 1;
  }

  get filterValues(): string[] {
    if (!this.activeFilterColumn) return [];
    const all = this.getUniqueColumnValues(this.activeFilterColumn);
    const term = this.filterSearch.trim().toLowerCase();
    if (!term) return all;
    return all.filter((v) => v.toLowerCase().includes(term));
  }

  isValueChecked(value: string): boolean {
    return this.filterSelectedDraft.has(value);
  }

  get isAllChecked(): boolean {
    const values = this.filterValues;
    if (!values.length) return false;
    return values.every((v) => this.filterSelectedDraft.has(v));
  }

  onToggleAllChange(event: Event): void {
    const checked = !!(event.target as HTMLInputElement | null)?.checked;
    for (const v of this.filterValues) {
      if (checked) this.filterSelectedDraft.add(v);
      else this.filterSelectedDraft.delete(v);
    }
  }

  onToggleValueChange(value: string, event: Event): void {
    const checked = !!(event.target as HTMLInputElement | null)?.checked;
    if (checked) this.filterSelectedDraft.add(value);
    else this.filterSelectedDraft.delete(value);
  }

  applyColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    const column = this.activeFilterColumn;
    const allValues = this.getUniqueColumnValues(column);
    const selected = allValues.filter((v) => this.filterSelectedDraft.has(v));
    this.columnSelectedValues[column] = selected.length === allValues.length ? [] : selected;
    if (this.filterSortDraft) {
      this.currentSortColumn = column;
      this.currentSortDirection = this.filterSortDraft;
    } else if (this.currentSortColumn === column) {
      this.currentSortColumn = null;
      this.currentSortDirection = '';
    }
    this.closeColumnFilter();
    this.applyFilters();
  }

  cancelColumnFilter(): void {
    this.closeColumnFilter();
  }

  isSortDraftActive(direction: 'asc' | 'desc'): boolean {
    return this.filterSortDraft === direction;
  }

  getCellValue(item: AssessmentItem, column: RequestFilterColumn): string {
    switch (column) {
      case 'id':
        return this.getShortId(item.id);
      case 'address':
        return item.address;
      case 'applicantName':
        return item.applicantName;
      case 'status':
        return this.getStatusLabel(item.status);
      case 'estimatedValue':
        return this.formatValue(item.estimatedValue);
      case 'createdAt':
        return this.formatDate(item.createdAt);
      case 'actions':
        return '';
      default:
        return '';
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeColumnFilter();
  }

  private matchesColumnFilters(item: AssessmentItem): boolean {
    for (const col of this.headerColumns.map((c) => c.key)) {
      const selected = this.columnSelectedValues[col];
      if (!selected.length) continue;
      const value = this.getCellValue(item, col);
      if (!selected.includes(value)) return false;
    }
    return true;
  }

  private getUniqueColumnValues(column: RequestFilterColumn): string[] {
    const values = new Set<string>();
    for (const item of this.assessments) {
      values.add(this.getCellValue(item, column));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(a: AssessmentItem, b: AssessmentItem): number {
    if (!this.currentSortColumn || !this.currentSortDirection) return 0;
    const left = this.getCellValue(a, this.currentSortColumn);
    const right = this.getCellValue(b, this.currentSortColumn);
    const result = left.localeCompare(right, 'ru', { numeric: true });
    return this.currentSortDirection === 'asc' ? result : -result;
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredAssessments.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedAssessments = this.filteredAssessments.slice(start, start + this.itemsPerPage);
    this.buildPages();
  }

  private buildPages(): void {
    this.pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      if (
        i === 1 ||
        i === this.totalPages ||
        (i >= this.currentPage - 1 && i <= this.currentPage + 1)
      ) {
        this.pages.push(i);
      } else if (i === this.currentPage - 2 || i === this.currentPage + 2) {
        this.pages.push(-1);
      }
    }
  }

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.updatePagination();
  }

  // ========== ХЕЛПЕРЫ ==========

  getShortId(id: string): string {
    return id.substring(0, 8);
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatValue(value: string): string {
    if (!value) return 'Не определена';
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(parseFloat(value));
  }

  getStatusLabel(status: string): string {
    return this.statusLabels[status] || status;
  }

  getStatusBadgeClass(status: string): string {
    return this.statusBadgeClasses[status] || 'badge-primary';
  }

  // ========== НАВИГАЦИЯ ==========

  viewAssessment(item: AssessmentItem): void {
    this.selectedAssessment = item;
    this.showView = true;
  }

  closeView(): void {
    this.selectedAssessment = null;
    this.showView = false;
  }

  // ========== ОТМЕНА ЗАЯВКИ ==========

  openCancelModal(item: AssessmentItem): void {
    this.assessmentToCancel = item;
    this.cancelReason = '';
    this.cancelReasonError = '';
    this.showCancelModal = true;
  }

  closeCancelModal(): void {
    this.showCancelModal = false;
    this.assessmentToCancel = null;
    this.cancelReason = '';
    this.cancelReasonError = '';
  }

  confirmCancel(): void {
    if (!this.cancelReason.trim()) {
      this.cancelReasonError = 'Укажите причину отмены';
      return;
    }
    if (!this.assessmentToCancel) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToCancel?.id);
    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'Cancelled',
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeCancelModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }

  // ========== ВЗЯТЬ В РАБОТУ ==========

  openVerifyModal(item: AssessmentItem): void {
    this.assessmentToVerify = item;
    this.notaryId = '';
    this.notaryIdError = '';
    this.loadNotaries();
    this.showVerifyModal = true;
  }

  closeVerifyModal(): void {
    this.showVerifyModal = false;
    this.assessmentToVerify = null;
    this.notaryId = '';
    this.notaryIdError = '';
  }

  confirmVerify(): void {
    if (!this.notaryId.trim()) {
      this.notaryIdError = 'Выберите нотариуса';
      return;
    }
    if (!this.assessmentToVerify) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToVerify?.id);
    if (index !== -1) {
      // WIP: T-C1 — заменить чтение/запись localStorage на RPC-вызов
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'Verified',
        notaryId: this.notaryId,
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeVerifyModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }

  // ========== НАЧАТЬ РАБОТУ (Verified → InProgress) ==========

  openStartWorkModal(item: AssessmentItem): void {
    this.assessmentToStartWork = item;
    this.showStartWorkModal = true;
  }

  closeStartWorkModal(): void {
    this.showStartWorkModal = false;
    this.assessmentToStartWork = null;
  }

  confirmStartWork(): void {
    if (!this.assessmentToStartWork) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToStartWork?.id);
    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'InProgress',
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeStartWorkModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }

  // ========== ЗАВЕРШИТЬ (InProgress → Completed) ==========

  openCompleteModal(item: AssessmentItem): void {
    this.assessmentToComplete = item;
    this.showCompleteModal = true;
  }

  closeCompleteModal(): void {
    this.showCompleteModal = false;
    this.assessmentToComplete = null;
  }

  confirmComplete(): void {
    if (!this.assessmentToComplete) return;

    const index = this.assessments.findIndex((a) => a.id === this.assessmentToComplete?.id);
    if (index !== -1) {
      this.assessments[index] = {
        ...this.assessments[index],
        status: 'Completed',
        updatedAt: new Date().toISOString(),
      };
      this.saveToStorage();
    }

    this.closeCompleteModal();
    this.applyFilters();

    if (this.showView && this.selectedAssessment?.id === this.assessments[index]?.id) {
      this.selectedAssessment = this.assessments[index];
    }
  }
}
