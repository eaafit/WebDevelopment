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
import {
  AdminAssessmentApiService,
  type AdminAssessmentRow,
} from '../services/assessment-api.service';
import { AdminUserApiService } from '../services/user-api.service';

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

const ASSESSMENTS_PAGE_LIMIT = 200;
const DECIMAL_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * WIP — Клиентский workaround для назначения нотариуса.
 *
 * Причина: proto-контракт `Assessment` (lab #6, issue-05) не содержит
 * поле `notary_id`, а RPC `verifyAssessment(id)` определяет нотариуса
 * из контекста авторизации — это несовместимо со сценарием админки,
 * где админ выбирает нотариуса от лица системы.
 *
 * Решение: пока proto не расширен, связь `assessmentId → notaryId`
 * хранится в localStorage[ADMIN_NOTARY_ASSIGNMENTS_KEY]. Список
 * нотариусов для dropdown'а грузится через AdminUserApiService.
 *
 * План миграции при расширении proto:
 *   1. В proto Assessment добавить поле `notary_id` (и опционально
 *      вернуть его в getAssessment / listAssessments).
 *   2. В services/assessment-api.service.ts перенести подмешивание
 *      notaryId внутрь `toAdminAssessmentRow` (через named export).
 *   3. В `verifyAssessment` RPC передать notaryId как часть запроса.
 *   4. Удалить чтение/запись ADMIN_NOTARY_ASSIGNMENTS_KEY и эту константу.
 *   5. Удалить методы readNotaryAssignments / saveNotaryAssignment.
 *   6. Удалить этот WIP-блок.
 *
 * Связано: PR/issue на расширение proto должен быть открыт отдельно
 * (тег #issue-05-notary-id).
 *
 * Владелец: Деркач Е.С. (issue-05)
 * Дата создания: 2026-05-09
 */
const ADMIN_NOTARY_ASSIGNMENTS_KEY = 'admin_notary_assignments';

/**
 * WIP — Клиентский workaround для перехода «В работу» (Verified → InProgress).
 *
 * Причина: proto AssessmentService (lab #6, issue-05) не содержит RPC
 * для этого перехода. Бэкенд предоставляет только verify (New → Verified),
 * complete (любой → Completed) и cancel. Кнопка «Начать работу» в
 * админке должна работать для UX — чтобы статусы выглядели цельно
 * для пользователя и страница не показывала «обрыв» между Verified и
 * Completed.
 *
 * Решение: пока proto не расширен, статус InProgress хранится локально
 * в localStorage[ADMIN_STATUS_OVERRIDES_KEY]. На сервере при
 * complete/cancel статус сразу переходит из Verified → Completed/Cancelled,
 * минуя InProgress, — но клиент видит корректную последовательность.
 * Override применяется ТОЛЬКО если на сервере по-прежнему `Verified`,
 * иначе серверный статус считается актуальнее (override игнорируется
 * и затем чистится при следующей mutation).
 *
 * План миграции при расширении proto:
 *   1. В AssessmentService добавить RPC `startWorkAssessment(id)`.
 *   2. В AdminAssessmentApiService добавить метод-обёртку.
 *   3. Заменить запись в localStorage в `confirmStartWork()` на API-вызов.
 *   4. Удалить чтение override'а в `loadAssessments()`.
 *   5. Удалить ADMIN_STATUS_OVERRIDES_KEY и этот WIP-блок.
 *
 * Альтернатива (если бэк откажется добавлять RPC): принять InProgress
 * как чисто клиентское состояние и не отражать его на сервере вовсе —
 * тогда workaround остаётся постоянным, но WIP-комментарий заменяется
 * на финальный design note с обоснованием.
 *
 * Владелец: Деркач Е.С. (issue-05)
 * Дата создания: 2026-05-09
 */
const ADMIN_STATUS_OVERRIDES_KEY = 'admin_status_overrides';

@Component({
  selector: 'lib-requests',
  imports: [CommonModule, FormsModule],
  templateUrl: './requests.html',
  styleUrl: './requests.scss',
})
export class RequestsComponent implements OnInit, OnDestroy {
  private cdr = inject(ChangeDetectorRef);
  private readonly assessmentApi = inject(AdminAssessmentApiService);
  private readonly userApi = inject(AdminUserApiService);

  assessments: AssessmentItem[] = [];
  filteredAssessments: AssessmentItem[] = [];
  paginatedAssessments: AssessmentItem[] = [];

  loading = false;
  loadError: string | null = null;
  mutationInFlight = false;

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
  filterDropdownStyle: { top: number; left: number } | null = null;
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
  finalEstimatedValue = '';
  finalEstimatedValueError = '';

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
    void this.initialLoad();
  }

  ngOnDestroy(): void {
    this.searchSubscription?.unsubscribe();
  }

  reload(): void {
    void this.initialLoad();
  }

  onSearchChange(value: string): void {
    this.searchTerm = value;
    if (!value) {
      this.applyFilters();
    } else {
      this.searchSubject$.next(value);
    }
  }

  // ========== ЗАГРУЗКА С API ==========

  private async initialLoad(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    try {
      // Параллельно: пользователи нужны для applicantName/нотариусов,
      // заявки — основной список. Без users список покажется, но имена
      // заявителей будут стабами короткого id.
      await Promise.all([this.userApi.loadUsers(), this.loadAssessments()]);
      this.loadNotaries();
      this.applyFilters();
    } catch (error) {
      this.loadError = (error as Error).message || 'Не удалось загрузить заявки';
      this.assessments = [];
      this.applyFilters();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadAssessments(): Promise<void> {
    // Пока серверная пагинация не подключена (T-C3), грузим всё одной
    // страницей; на бэке seed создаёт заметно меньше 200 записей.
    const page = await this.assessmentApi.listAssessments({
      page: 1,
      limit: ASSESSMENTS_PAGE_LIMIT,
    });
    const overrides = this.readStatusOverrides();
    const assignments = this.readNotaryAssignments();
    this.assessments = page.items.map((row) =>
      this.toAssessmentItem(row, overrides, assignments),
    );
  }

  private toAssessmentItem(
    row: AdminAssessmentRow,
    overrides: Record<string, 'InProgress'>,
    assignments: Record<string, string>,
  ): AssessmentItem {
    const overrideStatus = overrides[row.id];
    // Override применяем ТОЛЬКО если сервер всё ещё показывает Verified.
    // Если сервер ушёл вперёд (Completed/Cancelled) — он авторитетен.
    const status: AssessmentItem['status'] =
      overrideStatus === 'InProgress' && row.status === 'Verified' ? 'InProgress' : row.status;
    return {
      id: row.id,
      userId: row.userId,
      applicantName: this.userApi.getUserName(row.userId),
      status,
      address: row.address,
      description: row.description,
      estimatedValue: row.estimatedValue,
      notaryId: assignments[row.id],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private async refreshAfterMutation(touchedId: string): Promise<void> {
    await this.loadAssessments();
    this.applyFilters();
    if (this.showView && this.selectedAssessment?.id === touchedId) {
      const fresh = this.assessments.find((a) => a.id === touchedId);
      this.selectedAssessment = fresh ?? null;
      if (!fresh) this.showView = false;
    }
    this.cdr.detectChanges();
  }

  private loadNotaries(): void {
    const notaries: NotaryOption[] = [];
    for (const user of this.userApi.usersById.values()) {
      if (user.role === 'Notary' && user.isActive) {
        notaries.push({
          id: user.id,
          label: `${user.fullName} (${this.getShortId(user.id)})`,
        });
      }
    }
    notaries.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    this.notaryOptions = notaries;
  }

  // ========== WORKAROUND #1: assessmentId → notaryId ==========

  private readNotaryAssignments(): Record<string, string> {
    const raw = localStorage.getItem(ADMIN_NOTARY_ASSIGNMENTS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private saveNotaryAssignment(assessmentId: string, notaryId: string): void {
    const map = this.readNotaryAssignments();
    map[assessmentId] = notaryId;
    localStorage.setItem(ADMIN_NOTARY_ASSIGNMENTS_KEY, JSON.stringify(map));
  }

  // ========== WORKAROUND #2: assessmentId → 'InProgress' ==========

  private readStatusOverrides(): Record<string, 'InProgress'> {
    const raw = localStorage.getItem(ADMIN_STATUS_OVERRIDES_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as Record<string, 'InProgress'>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeStatusOverride(assessmentId: string, status: 'InProgress'): void {
    const map = this.readStatusOverrides();
    map[assessmentId] = status;
    localStorage.setItem(ADMIN_STATUS_OVERRIDES_KEY, JSON.stringify(map));
  }

  private clearStatusOverride(assessmentId: string): void {
    const map = this.readStatusOverrides();
    if (assessmentId in map) {
      delete map[assessmentId];
      localStorage.setItem(ADMIN_STATUS_OVERRIDES_KEY, JSON.stringify(map));
    }
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

  @HostListener('window:resize')
  onWindowResize(): void {
    this.closeColumnFilter();
  }

  onTableScroll(): void {
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

  async confirmCancel(): Promise<void> {
    if (!this.cancelReason.trim()) {
      this.cancelReasonError = 'Укажите причину отмены';
      return;
    }
    if (!this.assessmentToCancel || this.mutationInFlight) return;
    const id = this.assessmentToCancel.id;
    const reason = this.cancelReason.trim();
    this.mutationInFlight = true;
    try {
      await this.assessmentApi.cancelAssessment(id, reason);
      this.clearStatusOverride(id);
      this.closeCancelModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.cancelReasonError = (error as Error).message || 'Не удалось отменить заявку';
    } finally {
      this.mutationInFlight = false;
    }
  }

  // ========== ВЗЯТЬ В РАБОТУ (New → Verified) ==========

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

  async confirmVerify(): Promise<void> {
    if (!this.notaryId.trim()) {
      this.notaryIdError = 'Выберите нотариуса';
      return;
    }
    if (!this.assessmentToVerify || this.mutationInFlight) return;
    const id = this.assessmentToVerify.id;
    const chosenNotary = this.notaryId;
    this.mutationInFlight = true;
    try {
      // Workaround #1: фиксируем выбор нотариуса до RPC, чтобы при
      // ошибке refresh всё равно показал назначение в UI.
      this.saveNotaryAssignment(id, chosenNotary);
      await this.assessmentApi.verifyAssessment(id);
      this.closeVerifyModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.notaryIdError = (error as Error).message || 'Не удалось перевести заявку в работу';
    } finally {
      this.mutationInFlight = false;
    }
  }

  // ========== НАЧАТЬ РАБОТУ (Verified → InProgress, без RPC) ==========

  openStartWorkModal(item: AssessmentItem): void {
    this.assessmentToStartWork = item;
    this.showStartWorkModal = true;
  }

  closeStartWorkModal(): void {
    this.showStartWorkModal = false;
    this.assessmentToStartWork = null;
  }

  confirmStartWork(): void {
    if (!this.assessmentToStartWork || this.mutationInFlight) return;
    const id = this.assessmentToStartWork.id;
    // Workaround #2: на бэке нет RPC startWorkAssessment, фиксируем
    // переход локально и обновляем строку в таблице без перезагрузки.
    this.writeStatusOverride(id, 'InProgress');
    const idx = this.assessments.findIndex((a) => a.id === id);
    if (idx !== -1) {
      this.assessments[idx] = {
        ...this.assessments[idx],
        status: 'InProgress',
        updatedAt: new Date().toISOString(),
      };
      if (this.showView && this.selectedAssessment?.id === id) {
        this.selectedAssessment = this.assessments[idx];
      }
    }
    this.closeStartWorkModal();
    this.applyFilters();
    this.cdr.detectChanges();
  }

  // ========== ЗАВЕРШИТЬ (любой → Completed) ==========

  openCompleteModal(item: AssessmentItem): void {
    this.assessmentToComplete = item;
    this.finalEstimatedValue = item.estimatedValue ?? '';
    this.finalEstimatedValueError = '';
    this.showCompleteModal = true;
  }

  closeCompleteModal(): void {
    this.showCompleteModal = false;
    this.assessmentToComplete = null;
    this.finalEstimatedValue = '';
    this.finalEstimatedValueError = '';
  }

  async confirmComplete(): Promise<void> {
    if (!this.assessmentToComplete || this.mutationInFlight) return;
    const value = this.finalEstimatedValue.trim();
    if (!value) {
      this.finalEstimatedValueError = 'Укажите итоговую стоимость';
      return;
    }
    if (!DECIMAL_PATTERN.test(value) || Number(value) <= 0) {
      this.finalEstimatedValueError =
        'Введите положительное число (до двух знаков после точки)';
      return;
    }
    const id = this.assessmentToComplete.id;
    this.mutationInFlight = true;
    try {
      await this.assessmentApi.completeAssessment(id, value);
      this.clearStatusOverride(id);
      this.closeCompleteModal();
      await this.refreshAfterMutation(id);
    } catch (error) {
      this.finalEstimatedValueError =
        (error as Error).message || 'Не удалось завершить заявку';
    } finally {
      this.mutationInFlight = false;
    }
  }
}
