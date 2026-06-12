import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// ========== ТИПЫ ==========
export type AssessmentStatus = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';

export interface AssessmentItem {
  id: string;
  userId: string;
  applicantName: string;
  status: AssessmentStatus;
  address: string;
  description: string;
  estimatedValue: string;
  createdAt: string;
  updatedAt: string;
}

type FilterColumn = 'id' | 'address' | 'applicantName' | 'status' | 'estimatedValue' | 'createdAt';

// ========== МОКОВЫЕ ДАННЫЕ (статичные) ==========
const MOCK_ASSESSMENTS: AssessmentItem[] = [
  {
    id: 'ast-001',
    userId: 'user-1',
    applicantName: 'Иванов Иван Иванович',
    status: 'New',
    address: 'г. Москва, ул. Тверская, д. 15, кв. 45',
    description: '3-комнатная квартира, 5 этаж, требуется срочная оценка',
    estimatedValue: '',
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
  },
  {
    id: 'ast-002',
    userId: 'user-2',
    applicantName: 'Петрова Мария Сергеевна',
    status: 'Verified',
    address: 'г. Санкт-Петербург, Невский пр., д. 100',
    description: 'Коммерческое помещение, 1 этаж, 150 м²',
    estimatedValue: '',
    createdAt: '2026-06-02T11:30:00Z',
    updatedAt: '2026-06-03T09:00:00Z',
  },
  {
    id: 'ast-003',
    userId: 'user-3',
    applicantName: 'Сидоров Алексей Викторович',
    status: 'InProgress',
    address: 'г. Екатеринбург, ул. Ленина, д. 10',
    description: '5-комнатный дом, 220 м², земельный участок',
    estimatedValue: '',
    createdAt: '2026-05-28T14:20:00Z',
    updatedAt: '2026-06-02T16:45:00Z',
  },
  {
    id: 'ast-004',
    userId: 'user-4',
    applicantName: 'Кузнецова Анна Владимировна',
    status: 'Completed',
    address: 'г. Казань, ул. Баумана, д. 25',
    description: '2-этажный дом, 185 м²',
    estimatedValue: '9200000',
    createdAt: '2026-05-20T09:15:00Z',
    updatedAt: '2026-05-30T11:00:00Z',
  },
  {
    id: 'ast-005',
    userId: 'user-5',
    applicantName: 'Михайлов Дмитрий Андреевич',
    status: 'Cancelled',
    address: 'г. Новосибирск, Красный пр., д. 50',
    description: '2-комнатная квартира, 3 этаж, 45.2 м²',
    estimatedValue: '',
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-05-25T12:30:00Z',
  },
  {
    id: 'ast-006',
    userId: 'user-1',
    applicantName: 'Иванов Иван Иванович',
    status: 'New',
    address: 'г. Москва, ул. Арбат, д. 12, кв. 8',
    description: '2-комнатная квартира, центр',
    estimatedValue: '',
    createdAt: '2026-06-03T13:00:00Z',
    updatedAt: '2026-06-03T13:00:00Z',
  },
];

@Component({
  selector: 'lib-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class Assessment implements OnInit {
  // ========== ДАННЫЕ ==========
  private allAssessments = MOCK_ASSESSMENTS;
  assessments: AssessmentItem[] = [...this.allAssessments];
  filteredAssessments: AssessmentItem[] = [];
  paginatedAssessments: AssessmentItem[] = [];

  // ========== СОСТОЯНИЕ ==========
  loading = false;
  loadError: string | null = null;
  mutationInFlight = false;

  // ========== ФИЛЬТРЫ ==========
  searchTerm = '';
  dateFrom = '';
  dateTo = '';

  // ========== КОЛОНОЧНЫЕ ФИЛЬТРЫ ==========
  readonly headerColumns: { key: FilterColumn; label: string }[] = [
    { key: 'id', label: 'ID' },
    { key: 'address', label: 'Адрес' },
    { key: 'applicantName', label: 'Заявитель' },
    { key: 'status', label: 'Статус' },
    { key: 'estimatedValue', label: 'Стоимость' },
    { key: 'createdAt', label: 'Дата создания' },
  ];

  activeFilterColumn: FilterColumn | null = null;
  filterDropdownStyle: { top: number; left: number } | null = null;
  columnSelectedValues: Record<FilterColumn, string[]> = {
    id: [],
    address: [],
    applicantName: [],
    status: [],
    estimatedValue: [],
    createdAt: [],
  };
  currentSortColumn: FilterColumn | null = null;
  currentSortDirection: '' | 'asc' | 'desc' = '';
  filterSearch = '';
  filterSortDraft: '' | 'asc' | 'desc' = '';
  filterSelectedDraft = new Set<string>();

  // ========== ПАГИНАЦИЯ ==========
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  pages: number[] = [];

  // ========== КАРТОЧКА ==========
  showView = false;
  selectedAssessment: AssessmentItem | null = null;

  // ========== МОДАЛКИ ==========
  showCancelModal = false;
  assessmentToCancel: AssessmentItem | null = null;
  cancelReason = '';
  cancelReasonError = '';

  showVerifyModal = false;
  assessmentToVerify: AssessmentItem | null = null;

  showStartWorkModal = false;
  assessmentToStartWork: AssessmentItem | null = null;

  showCompleteModal = false;
  assessmentToComplete: AssessmentItem | null = null;
  finalEstimatedValue = '';
  finalEstimatedValueError = '';

  // ========== ХЕЛПЕРЫ ДЛЯ СТАТУСОВ ==========
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
    this.applyFilters();
  }

  // ========== ФИЛЬТРАЦИЯ И СОРТИРОВКА ==========
  applyFilters(): void {
    let result = [...this.assessments];

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(
        (a) =>
          a.address.toLowerCase().includes(term) ||
          a.applicantName.toLowerCase().includes(term)
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

    result = result.filter((a) => this.matchesColumnFilters(a));

    const currentSortColumn = this.currentSortColumn;
    if (currentSortColumn && this.currentSortDirection) {
      result.sort((a, b) =>
        this.compareByActiveSort(a, b, currentSortColumn, this.currentSortDirection)
      );
    } else {
      result.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    }

    this.filteredAssessments = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    this.applyFilters();
  }

  resetDateFilters(): void {
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
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

  private getCellValue(item: AssessmentItem, column: FilterColumn): string {
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
      default:
        return '';
    }
  }

  private getUniqueColumnValues(column: FilterColumn): string[] {
    const values = new Set<string>();
    for (const item of this.assessments) {
      values.add(this.getCellValue(item, column));
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(
    a: AssessmentItem,
    b: AssessmentItem,
    column: FilterColumn,
    direction: string
  ): number {
    const left = this.getCellValue(a, column);
    const right = this.getCellValue(b, column);
    const result = left.localeCompare(right, 'ru', { numeric: true });
    return direction === 'asc' ? result : -result;
  }

  // ========== КОЛОНОЧНЫЕ ФИЛЬТРЫ ==========
  toggleColumnFilter(column: FilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) {
      this.closeColumnFilter();
      return;
    }
    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);
    this.updateFilterDropdownPosition(event.currentTarget as HTMLElement | null);
  }

  closeColumnFilter(): void {
    this.activeFilterColumn = null;
    this.filterDropdownStyle = null;
  }

  private updateFilterDropdownPosition(trigger: HTMLElement | null): void {
    if (!trigger) {
      this.filterDropdownStyle = null;
      return;
    }
    const rect = trigger.getBoundingClientRect();
    this.filterDropdownStyle = { top: rect.bottom + 4, left: rect.left };
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
    this.applyFilters();
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

  // ========== ПАГИНАЦИЯ ==========
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
    if (!dateString) return '—';
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
    const assessmentToCancel = this.assessmentToCancel;
    if (!assessmentToCancel) return;
    this.mutationInFlight = true;
    setTimeout(() => {
      const idx = this.assessments.findIndex((a) => a.id === assessmentToCancel.id);
      if (idx !== -1) {
        this.assessments[idx] = { ...this.assessments[idx], status: 'Cancelled' };
        if (this.showView && this.selectedAssessment?.id === assessmentToCancel.id) {
          this.selectedAssessment = this.assessments[idx];
        }
      }
      this.closeCancelModal();
      this.applyFilters();
      this.mutationInFlight = false;
    }, 300);
  }

  // ========== ВЗЯТЬ В РАБОТУ ==========
  openVerifyModal(item: AssessmentItem): void {
    this.assessmentToVerify = item;
    this.showVerifyModal = true;
  }

  closeVerifyModal(): void {
    this.showVerifyModal = false;
    this.assessmentToVerify = null;
  }

  confirmVerify(): void {
    const assessmentToVerify = this.assessmentToVerify;
    if (!assessmentToVerify) return;
    this.mutationInFlight = true;
    setTimeout(() => {
      const idx = this.assessments.findIndex((a) => a.id === assessmentToVerify.id);
      if (idx !== -1) {
        this.assessments[idx] = { ...this.assessments[idx], status: 'Verified' };
        if (this.showView && this.selectedAssessment?.id === assessmentToVerify.id) {
          this.selectedAssessment = this.assessments[idx];
        }
      }
      this.closeVerifyModal();
      this.applyFilters();
      this.mutationInFlight = false;
    }, 300);
  }

  // ========== НАЧАТЬ РАБОТУ ==========
  openStartWorkModal(item: AssessmentItem): void {
    this.assessmentToStartWork = item;
    this.showStartWorkModal = true;
  }

  closeStartWorkModal(): void {
    this.showStartWorkModal = false;
    this.assessmentToStartWork = null;
  }

  confirmStartWork(): void {
    const assessmentToStartWork = this.assessmentToStartWork;
    if (!assessmentToStartWork) return;
    this.mutationInFlight = true;
    setTimeout(() => {
      const idx = this.assessments.findIndex((a) => a.id === assessmentToStartWork.id);
      if (idx !== -1) {
        this.assessments[idx] = { ...this.assessments[idx], status: 'InProgress' };
        if (this.showView && this.selectedAssessment?.id === assessmentToStartWork.id) {
          this.selectedAssessment = this.assessments[idx];
        }
      }
      this.closeStartWorkModal();
      this.applyFilters();
      this.mutationInFlight = false;
    }, 300);
  }

  // ========== ЗАВЕРШИТЬ ==========
  openCompleteModal(item: AssessmentItem): void {
    this.assessmentToComplete = item;
    this.finalEstimatedValue = '';
    this.finalEstimatedValueError = '';
    this.showCompleteModal = true;
  }

  closeCompleteModal(): void {
    this.showCompleteModal = false;
    this.assessmentToComplete = null;
    this.finalEstimatedValue = '';
    this.finalEstimatedValueError = '';
  }

  confirmComplete(): void {
    const assessmentToComplete = this.assessmentToComplete;
    if (!assessmentToComplete) return;
    
    const value = this.finalEstimatedValue.trim();
    if (!value) {
      this.finalEstimatedValueError = 'Укажите итоговую стоимость';
      return;
    }
    
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      this.finalEstimatedValueError = 'Введите положительное число';
      return;
    }
    
    this.mutationInFlight = true;
    
    const idx = this.assessments.findIndex((a) => a.id === assessmentToComplete.id);
    if (idx !== -1) {
      this.assessments[idx] = {
        ...this.assessments[idx],
        status: 'Completed',
        estimatedValue: this.finalEstimatedValue,
      };
      
      if (this.showView && this.selectedAssessment?.id === assessmentToComplete.id) {
        this.selectedAssessment = this.assessments[idx];
      }
    }
    
    this.closeCompleteModal();
    this.applyFilters();
    this.mutationInFlight = false;
  }

  // ========== ПЕРЕЗАГРУЗКА ==========
  reload(): void {
    this.assessments = [...this.allAssessments];
    this.applyFilters();
  }

  // ========== ГЛОБАЛЬНЫЕ СОБЫТИЯ ==========
  @HostListener('document:click')
  onDocumentClick(): void {
    this.closeColumnFilter();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.closeColumnFilter();
  }
}
