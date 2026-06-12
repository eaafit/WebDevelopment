import { Component, HostListener, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationCounterService } from '@notary-portal/ui';
import { BitrixOrderService } from '../../services/bitrix-order.service';
import {
  NotaryAssessmentApiService,
  type NotaryAssessmentRow,
} from '../../services/assessment-api.service';
import { UserApiService } from '../../services/user.service';

export type AssessmentStatus = 'New' | 'Verified' | 'InProgress' | 'Completed' | 'Cancelled';

export interface AssessmentItem {
  id: string;
  userId: string;
  applicantName: string;
  status: AssessmentStatus;
  address: string;
  description: string;
  estimatedValue: string;
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

type FilterColumn = 'id' | 'address' | 'applicantName' | 'status' | 'estimatedValue' | 'createdAt';

const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

@Component({
  selector: 'lib-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class Assessment implements OnInit {
  private readonly bitrixPublisher = inject(BitrixOrderService);
  private readonly assessmentApi = inject(NotaryAssessmentApiService);
  private readonly userApi = inject(UserApiService);
  private readonly notificationCounter = inject(NotificationCounterService);

  assessments: AssessmentItem[] = [];
  filteredAssessments: AssessmentItem[] = [];
  paginatedAssessments: AssessmentItem[] = [];

  loading = false;
  loadError: string | null = null;
  mutationInFlight = false;

  searchTerm = '';
  dateFrom = '';
  dateTo = '';

  readonly headerColumns: { key: FilterColumn; label: string }[] = [
    { key: 'id', label: 'ID' }, { key: 'address', label: 'Адрес' }, { key: 'applicantName', label: 'Заявитель' },
    { key: 'status', label: 'Статус' }, { key: 'estimatedValue', label: 'Стоимость' }, { key: 'createdAt', label: 'Дата создания' },
  ];

  activeFilterColumn: FilterColumn | null = null;
  filterDropdownStyle: { top: number; left: number } | null = null;
  columnSelectedValues: Record<FilterColumn, string[]> = {
    id: [], address: [], applicantName: [], status: [], estimatedValue: [], createdAt: [],
  };
  currentSortColumn: FilterColumn | null = null;
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
  verifyError = '';

  showCompleteModal = false;
  assessmentToComplete: AssessmentItem | null = null;
  finalEstimatedValue = '';
  finalEstimatedValueError = '';

  readonly statusLabels: Record<string, string> = {
    New: 'Новая', Verified: 'Подтверждена', InProgress: 'В работе', Completed: 'Завершена', Cancelled: 'Отменена',
  };

  readonly statusBadgeClasses: Record<string, string> = {
    New: 'badge-primary', Verified: 'badge-info', InProgress: 'badge-warning', Completed: 'badge-success', Cancelled: 'badge-danger',
  };

  ngOnInit(): void {
    void this.loadAssessments();
  }

  async loadAssessments(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    try {
      await this.userApi.loadUsers().catch(() => undefined);
      const data = await this.assessmentApi.listAssessments();
      this.assessments = data.map((item) => this.toAssessmentItem(item));
      this.applyFilters();
    } catch (error) {
      console.error('Ошибка загрузки заявок:', error);
      this.loadError = (error as Error).message || 'Не удалось загрузить заявки';
      this.assessments = [];
      this.applyFilters();
    } finally {
      this.loading = false;
    }
  }

  private toAssessmentItem(row: NotaryAssessmentRow): AssessmentItem {
    return {
      id: row.id,
      userId: row.userId,
      applicantName: this.userApi.getUserName(row.userId),
      status: row.status,
      address: row.address,
      description: row.description,
      estimatedValue: row.estimatedValue,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async refreshAfterMutation(touchedId: string): Promise<void> {
    await this.loadAssessments();
    if (this.showView && this.selectedAssessment?.id === touchedId) {
      const fresh = this.assessments.find((a) => a.id === touchedId);
      this.selectedAssessment = fresh ?? null;
      if (!fresh) {
        this.showView = false;
      }
    }
    void this.notificationCounter.refresh();
  }

  applyFilters(): void {
    let result = [...this.assessments];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      result = result.filter(a => a.address.toLowerCase().includes(term) || a.applicantName.toLowerCase().includes(term));
    }
    if (this.dateFrom) result = result.filter(a => a.createdAt.slice(0, 10) >= this.dateFrom);
    if (this.dateTo) result = result.filter(a => a.createdAt.slice(0, 10) <= this.dateTo);
    result = result.filter(a => this.matchesColumnFilters(a));
    if (this.currentSortColumn && this.currentSortDirection) {
      result.sort((a, b) => this.compareByActiveSort(a, b, this.currentSortColumn!, this.currentSortDirection));
    } else {
      result.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    }
    this.filteredAssessments = result;
    this.currentPage = 1;
    this.updatePagination();
  }

  onSearchChange(value: string): void { this.searchTerm = value; this.applyFilters(); }
  resetDateFilters(): void { this.dateFrom = ''; this.dateTo = ''; this.applyFilters(); }

  private matchesColumnFilters(item: AssessmentItem): boolean {
    for (const col of this.headerColumns.map(c => c.key)) {
      const selected = this.columnSelectedValues[col];
      if (!selected.length) continue;
      if (!selected.includes(this.getCellValue(item, col))) return false;
    }
    return true;
  }

  private getCellValue(item: AssessmentItem, column: FilterColumn): string {
    switch (column) {
      case 'id': return this.getShortId(item.id);
      case 'address': return item.address;
      case 'applicantName': return item.applicantName;
      case 'status': return this.getStatusLabel(item.status);
      case 'estimatedValue': return this.formatValue(item.estimatedValue);
      case 'createdAt': return this.formatDate(item.createdAt);
      default: return '';
    }
  }

  private getUniqueColumnValues(column: FilterColumn): string[] {
    const values = new Set<string>();
    for (const item of this.assessments) values.add(this.getCellValue(item, column));
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'ru'));
  }

  private compareByActiveSort(a: AssessmentItem, b: AssessmentItem, column: FilterColumn, direction: string): number {
    const result = this.getCellValue(a, column).localeCompare(this.getCellValue(b, column), 'ru', { numeric: true });
    return direction === 'asc' ? result : -result;
  }

  toggleColumnFilter(column: FilterColumn, event: MouseEvent): void {
    event.stopPropagation();
    if (this.activeFilterColumn === column) { this.closeColumnFilter(); return; }
    this.activeFilterColumn = column;
    this.filterSearch = '';
    this.filterSortDraft = this.currentSortColumn === column ? this.currentSortDirection : '';
    const allValues = this.getUniqueColumnValues(column);
    const selected = this.columnSelectedValues[column];
    this.filterSelectedDraft = new Set(selected.length ? selected : allValues);
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.filterDropdownStyle = { top: rect.bottom + 4, left: rect.left };
  }

  closeColumnFilter(): void { this.activeFilterColumn = null; this.filterDropdownStyle = null; }
  setDraftSort(direction: 'asc' | 'desc'): void { this.filterSortDraft = direction; }
  
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
    return term ? all.filter(v => v.toLowerCase().includes(term)) : all;
  }

  isValueChecked(value: string): boolean { return this.filterSelectedDraft.has(value); }
  get isAllChecked(): boolean { const v = this.filterValues; return v.length > 0 && v.every(v => this.filterSelectedDraft.has(v)); }

  onToggleAllChange(event: Event): void {
    const checked = !!(event.target as HTMLInputElement)?.checked;
    for (const v of this.filterValues) checked ? this.filterSelectedDraft.add(v) : this.filterSelectedDraft.delete(v);
  }

  onToggleValueChange(value: string, event: Event): void {
    const checked = !!(event.target as HTMLInputElement)?.checked;
    checked ? this.filterSelectedDraft.add(value) : this.filterSelectedDraft.delete(value);
  }

  applyColumnFilter(): void {
    if (!this.activeFilterColumn) return;
    const column = this.activeFilterColumn;
    const allValues = this.getUniqueColumnValues(column);
    const selected = allValues.filter(v => this.filterSelectedDraft.has(v));
    this.columnSelectedValues[column] = selected.length === allValues.length ? [] : selected;
    if (this.filterSortDraft) { this.currentSortColumn = column; this.currentSortDirection = this.filterSortDraft; }
    else if (this.currentSortColumn === column) { this.currentSortColumn = null; this.currentSortDirection = ''; }
    this.closeColumnFilter();
    this.applyFilters();
  }

  cancelColumnFilter(): void { this.closeColumnFilter(); }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.filteredAssessments.length / this.itemsPerPage);
    const start = (this.currentPage - 1) * this.itemsPerPage;
    this.paginatedAssessments = this.filteredAssessments.slice(start, start + this.itemsPerPage);
    this.pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      if (i === 1 || i === this.totalPages || (i >= this.currentPage - 1 && i <= this.currentPage + 1)) this.pages.push(i);
      else if (i === this.currentPage - 2 || i === this.currentPage + 2) this.pages.push(-1);
    }
  }

  changePage(page: number): void { if (page < 1 || page > this.totalPages) return; this.currentPage = page; this.updatePagination(); }
  getShortId(id: string): string { return id.substring(0, 8); }
  formatDate(dateString: string): string { return dateString ? new Date(dateString).toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'; }
  formatValue(value: string): string { return value ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(parseFloat(value)) : 'Не определена'; }
  getStatusLabel(status: string): string { return this.statusLabels[status] || status; }
  getStatusBadgeClass(status: string): string { return this.statusBadgeClasses[status] || 'badge-primary'; }

  viewAssessment(item: AssessmentItem): void { this.selectedAssessment = item; this.showView = true; }
  closeView(): void { this.selectedAssessment = null; this.showView = false; }

  openCancelModal(item: AssessmentItem): void { this.assessmentToCancel = item; this.cancelReason = ''; this.cancelReasonError = ''; this.showCancelModal = true; }
  closeCancelModal(): void { this.showCancelModal = false; this.assessmentToCancel = null; this.cancelReason = ''; this.cancelReasonError = ''; }

  async confirmCancel(): Promise<void> {
    if (!this.assessmentToCancel || this.mutationInFlight) return;
    const id = this.assessmentToCancel.id;
    const reason = this.cancelReason.trim();
    this.mutationInFlight = true;
    this.cancelReasonError = '';
    try {
      await this.assessmentApi.cancelAssessment(id, reason);
      this.closeCancelModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.cancelReasonError = (error as Error).message || 'Не удалось отменить заявку';
    } finally {
      this.mutationInFlight = false;
    }
  }

  openVerifyModal(item: AssessmentItem): void {
    this.assessmentToVerify = item;
    this.verifyError = '';
    this.showVerifyModal = true;
  }
  closeVerifyModal(): void { this.showVerifyModal = false; this.assessmentToVerify = null; this.verifyError = ''; }

  async confirmVerify(): Promise<void> {
    if (!this.assessmentToVerify || this.mutationInFlight) return;
    const id = this.assessmentToVerify.id;
    this.mutationInFlight = true;
    this.verifyError = '';
    try {
      await this.assessmentApi.verifyAssessment(id);
      this.bitrixPublisher.publishOrder(id).catch(err => console.error('Ошибка отправки в Bitrix:', err));
      this.closeVerifyModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.verifyError = (error as Error).message || 'Не удалось взять заявку в работу';
    } finally {
      this.mutationInFlight = false;
    }
  }

  openCompleteModal(item: AssessmentItem): void {
    this.assessmentToComplete = item;
    this.finalEstimatedValue = item.estimatedValue ?? '';
    this.finalEstimatedValueError = '';
    this.showCompleteModal = true;
  }
  closeCompleteModal(): void { this.showCompleteModal = false; this.assessmentToComplete = null; }

  async confirmComplete(): Promise<void> {
    if (!this.assessmentToComplete || this.mutationInFlight) return;
    const value = String(this.finalEstimatedValue).trim();
    if (!value) { this.finalEstimatedValueError = 'Укажите итоговую стоимость'; return; }
    if (!DECIMAL_PATTERN.test(value) || Number(value) <= 0) {
      this.finalEstimatedValueError = 'Введите положительное число (до двух знаков после точки)';
      return;
    }
    const id = this.assessmentToComplete.id;
    this.mutationInFlight = true;
    this.finalEstimatedValueError = '';
    try {
      await this.assessmentApi.completeAssessment(id, value);
      this.closeCompleteModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.finalEstimatedValueError = (error as Error).message || 'Не удалось завершить заявку';
    } finally {
      this.mutationInFlight = false;
    }
  }

  reload(): void {
    void this.loadAssessments();
  }

  @HostListener('document:click') onDocumentClick(): void { this.closeColumnFilter(); }
  @HostListener('window:resize') onWindowResize(): void { this.closeColumnFilter(); }
}
