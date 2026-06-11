import { Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { inject } from '@angular/core';
import { BitrixOrderService } from '../../services/bitrix-order.service';
export { MOCK_ASSESSMENTS };

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
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

type FilterColumn = 'id' | 'address' | 'applicantName' | 'status' | 'estimatedValue' | 'createdAt';

// ========== МОКОВЫЕ ДАННЫЕ ==========
const MOCK_ASSESSMENTS: AssessmentItem[] = [
  { id: 'ast-001', userId: 'user-1', applicantName: 'Иванов Иван Иванович', status: 'New', address: 'г. Москва, ул. Тверская, д. 15, кв. 45', description: '3-комнатная квартира, 5 этаж', estimatedValue: '', createdAt: '2026-06-01T10:00:00Z', updatedAt: '2026-06-01T10:00:00Z' },
  { id: 'ast-002', userId: 'user-2', applicantName: 'Петрова Мария Сергеевна', status: 'InProgress', address: 'г. Санкт-Петербург, Невский пр., д. 100', description: 'Коммерческое помещение, 150 м²', estimatedValue: '', createdAt: '2026-06-02T11:30:00Z', updatedAt: '2026-06-03T09:00:00Z' },
  { id: 'ast-003', userId: 'user-3', applicantName: 'Сидоров Алексей Викторович', status: 'Completed', address: 'г. Екатеринбург, ул. Ленина, д. 10', description: '5-комнатный дом, 220 м²', estimatedValue: '8500000', createdAt: '2026-05-28T14:20:00Z', updatedAt: '2026-06-02T16:45:00Z' },
  { id: 'ast-004', userId: 'user-4', applicantName: 'Кузнецова Анна Владимировна', status: 'Verified', address: 'г. Казань, ул. Баумана, д. 25', description: '2-этажный дом, 185 м²', estimatedValue: '', createdAt: '2026-05-20T09:15:00Z', updatedAt: '2026-05-30T11:00:00Z' },
  { id: 'ast-005', userId: 'user-5', applicantName: 'Михайлов Дмитрий Андреевич', status: 'Cancelled', address: 'г. Новосибирск, Красный пр., д. 50', description: '2-комнатная квартира, 45.2 м²', estimatedValue: '', cancelReason: 'Заявитель передумал', createdAt: '2026-05-15T08:00:00Z', updatedAt: '2026-05-25T12:30:00Z' },
  { id: 'ast-006', userId: 'user-6', applicantName: 'Соколова Елена Дмитриевна', status: 'New', address: 'г. Краснодар, ул. Красная, д. 20', description: '1-комнатная квартира', estimatedValue: '', createdAt: '2026-06-04T09:00:00Z', updatedAt: '2026-06-04T09:00:00Z' },
  { id: 'ast-007', userId: 'user-7', applicantName: 'Морозов Андрей Сергеевич', status: 'InProgress', address: 'г. Сочи, ул. Навагинская, д. 5', description: 'Таунхаус, 120 м²', estimatedValue: '', createdAt: '2026-06-05T14:00:00Z', updatedAt: '2026-06-06T10:00:00Z' },
  { id: 'ast-008', userId: 'user-8', applicantName: 'Волкова Татьяна Павловна', status: 'Completed', address: 'г. Нижний Новгород, ул. Большая Покровская, д. 30', description: 'Офисное помещение, 80 м²', estimatedValue: '4200000', createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-06-04T15:00:00Z' },
  { id: 'ast-009', userId: 'user-9', applicantName: 'Зайцев Константин Игоревич', status: 'Verified', address: 'г. Ростов-на-Дону, пр. Будённовский, д. 45', description: '3-комнатная квартира', estimatedValue: '', createdAt: '2026-05-30T12:00:00Z', updatedAt: '2026-06-05T11:00:00Z' },
  { id: 'ast-010', userId: 'user-10', applicantName: 'Николаева Ольга Владимировна', status: 'Cancelled', address: 'г. Самара, ул. Ленинградская, д. 12', description: 'Земельный участок', estimatedValue: '', cancelReason: 'Не сошлись в цене', createdAt: '2026-05-25T10:00:00Z', updatedAt: '2026-06-03T09:00:00Z' },
  { id: 'ast-011', userId: 'user-11', applicantName: 'Павлов Сергей Николаевич', status: 'New', address: 'г. Уфа, пр. Октября, д. 88', description: 'Склад 500 м²', estimatedValue: '', createdAt: '2026-05-22T16:00:00Z', updatedAt: '2026-06-01T14:00:00Z' },
  { id: 'ast-012', userId: 'user-12', applicantName: 'Егорова Анастасия Дмитриевна', status: 'InProgress', address: 'г. Воронеж, ул. Плехановская, д. 7', description: '2-комнатная квартира', estimatedValue: '', createdAt: '2026-05-18T11:00:00Z', updatedAt: '2026-05-28T09:00:00Z' },
  { id: 'ast-013', userId: 'user-13', applicantName: 'Тимофеев Алексей Петрович', status: 'Completed', address: 'г. Волгоград, ул. Мира, д. 15', description: 'Частный дом, 150 м²', estimatedValue: '12500000', createdAt: '2026-06-06T09:00:00Z', updatedAt: '2026-06-06T09:00:00Z' },
  { id: 'ast-014', userId: 'user-14', applicantName: 'Фёдорова Мария Игоревна', status: 'Verified', address: 'г. Челябинск, ул. Кирова, д. 22', description: '3-комнатная квартира', estimatedValue: '', createdAt: '2026-06-07T13:00:00Z', updatedAt: '2026-06-08T10:00:00Z' },
  { id: 'ast-015', userId: 'user-1', applicantName: 'Иванов Иван Иванович', status: 'New', address: 'г. Москва, ул. Арбат, д. 12, кв. 8', description: '2-комнатная квартира, центр', estimatedValue: '', createdAt: '2026-06-03T13:00:00Z', updatedAt: '2026-06-03T13:00:00Z' },
];

// ========== СЕРВИС АУДИТА (заглушка) ==========
class AuditService {
  log(data: { action: string; entity: string; entityId: string; details: any }) {
    console.log('[AUDIT]', { timestamp: new Date().toISOString(), ...data });
  }
}

// ========== СЕРВИС УВЕДОМЛЕНИЙ (заглушка) ==========
class NotificationService {
  send(userId: string, message: string, type: string) {
    console.log(`[NOTIFICATION] Пользователю ${userId} отправлено: ${message} (тип: ${type})`);
  }
}

@Component({
  selector: 'lib-assessment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment.html',
  styleUrl: './assessment.scss',
})
export class Assessment implements OnInit {
  private bitrixPublisher = inject(BitrixOrderService);
  private audit = new AuditService();
  private notifications = new NotificationService();

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

  showStartWorkModal = false;
  assessmentToStartWork: AssessmentItem | null = null;

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
    this.loadAssessments();
  }

  loadAssessments(): void {
    this.loading = true;
    this.assessments = JSON.parse(JSON.stringify(MOCK_ASSESSMENTS));
    this.applyFilters();
    this.loading = false;
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

  confirmCancel(): void {
    if (!this.assessmentToCancel) return;
    this.mutationInFlight = true;
    this.audit.log({ action: 'ORDER_CANCELLED', entity: 'Assessment', entityId: this.assessmentToCancel.id, details: { reason: this.cancelReason } });
    this.notifications.send(this.assessmentToCancel.userId, `Ваша заявка отменена. Причина: ${this.cancelReason}`, 'order_cancelled');
    const index = this.assessments.findIndex(a => a.id === this.assessmentToCancel!.id);
    if (index !== -1) {
      this.assessments[index].status = 'Cancelled';
      this.assessments[index].cancelReason = this.cancelReason;
      if (this.showView && this.selectedAssessment?.id === this.assessmentToCancel!.id) this.selectedAssessment = this.assessments[index];
      this.applyFilters();
    }
    this.closeCancelModal();
    this.mutationInFlight = false;
  }

  openVerifyModal(item: AssessmentItem): void { this.assessmentToVerify = item; this.showVerifyModal = true; }
  closeVerifyModal(): void { this.showVerifyModal = false; this.assessmentToVerify = null; }

  confirmVerify(): void {
    if (!this.assessmentToVerify) return;
    this.mutationInFlight = true;
    this.audit.log({ action: 'ORDER_TAKEN', entity: 'Assessment', entityId: this.assessmentToVerify.id, details: { status: 'Verified' } });
    this.notifications.send(this.assessmentToVerify.userId, 'Ваша заявка принята нотариусом в работу', 'order_taken');
    const index = this.assessments.findIndex(a => a.id === this.assessmentToVerify!.id);
    if (index !== -1) {
      this.assessments[index].status = 'Verified';
      if (this.showView && this.selectedAssessment?.id === this.assessmentToVerify!.id) this.selectedAssessment = this.assessments[index];
      this.applyFilters();
    }
    const orderId = this.assessmentToVerify!.id;
    this.bitrixPublisher.publishOrder(orderId).catch(err => console.error('❌ Ошибка отправки в Bitrix:', err));
    this.closeVerifyModal();
    this.mutationInFlight = false;
  }

  openStartWorkModal(item: AssessmentItem): void { this.assessmentToStartWork = item; this.showStartWorkModal = true; }
  closeStartWorkModal(): void { this.showStartWorkModal = false; this.assessmentToStartWork = null; }

  confirmStartWork(): void {
    if (!this.assessmentToStartWork) return;
    this.mutationInFlight = true;
    this.audit.log({ action: 'ORDER_STARTED', entity: 'Assessment', entityId: this.assessmentToStartWork.id, details: { status: 'InProgress' } });
    this.notifications.send(this.assessmentToStartWork.userId, 'Нотариус начал работу над вашей заявкой', 'order_started');
    const index = this.assessments.findIndex(a => a.id === this.assessmentToStartWork!.id);
    if (index !== -1) {
      this.assessments[index].status = 'InProgress';
      if (this.showView && this.selectedAssessment?.id === this.assessmentToStartWork!.id) this.selectedAssessment = this.assessments[index];
      this.applyFilters();
    }
    this.closeStartWorkModal();
    this.mutationInFlight = false;
  }

  openCompleteModal(item: AssessmentItem): void { this.assessmentToComplete = item; this.finalEstimatedValue = ''; this.finalEstimatedValueError = ''; this.showCompleteModal = true; }
  closeCompleteModal(): void { this.showCompleteModal = false; this.assessmentToComplete = null; }

  confirmComplete(): void {
    if (!this.assessmentToComplete) return;
    const value = String(this.finalEstimatedValue).trim();
    if (!value) { this.finalEstimatedValueError = 'Укажите итоговую стоимость'; return; }
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { this.finalEstimatedValueError = 'Введите положительное число'; return; }
    this.mutationInFlight = true;
    this.audit.log({ action: 'ORDER_COMPLETED', entity: 'Assessment', entityId: this.assessmentToComplete.id, details: { finalValue: this.finalEstimatedValue } });
    this.notifications.send(this.assessmentToComplete.userId, 'Ваша заявка успешно завершена. Отчёт готов к скачиванию.', 'order_completed');
    const index = this.assessments.findIndex(a => a.id === this.assessmentToComplete!.id);
    if (index !== -1) {
      this.assessments[index].status = 'Completed';
      this.assessments[index].estimatedValue = value;
      if (this.showView && this.selectedAssessment?.id === this.assessmentToComplete!.id) this.selectedAssessment = this.assessments[index];
      this.applyFilters();
    }
    this.closeCompleteModal();
    this.mutationInFlight = false;
  }

  reload(): void { this.assessments = JSON.parse(JSON.stringify(MOCK_ASSESSMENTS)); this.applyFilters(); }

  @HostListener('document:click') onDocumentClick(): void { this.closeColumnFilter(); }
  @HostListener('window:resize') onWindowResize(): void { this.closeColumnFilter(); }
}