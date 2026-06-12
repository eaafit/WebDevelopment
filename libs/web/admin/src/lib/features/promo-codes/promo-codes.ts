import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { PromocodeService, type PromocodeDto } from '../../../services/promocode.service';

export type PromocodeUiStatus = 'Active' | 'Inactive' | 'Expired';

const UI = {
  eyebrow:
    '\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430 / \u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b',
  heading: '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u0430\u043c\u0438',
  lead:
    '\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b \u0438\u0437 \u0431\u0430\u0437\u044b: \u0442\u0438\u043f \u0441\u043a\u0438\u0434\u043a\u0438, \u0441\u0440\u043e\u043a\u0438, \u043b\u0438\u043c\u0438\u0442\u044b \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f.',
  addPromo: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  searchLead:
    '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043a\u043e\u0434\u0443 \u0438 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e \u0441\u0440\u0435\u0434\u0438 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043d\u044b\u0445 \u0437\u0430\u043f\u0438\u0441\u0435\u0439.',
  found: '\u041d\u0430\u0439\u0434\u0435\u043d\u043e',
  searchByCode: '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043a\u043e\u0434\u0443',
  searchPlaceholder: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043a\u043e\u0434 \u0438\u043b\u0438 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435...',
  listTitle: '\u0421\u043f\u0438\u0441\u043e\u043a \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u043e\u0432',
  listLead:
    '\u0414\u0430\u043d\u043d\u044b\u0435 \u0438\u0437 \u0442\u0430\u0431\u043b\u0438\u0446\u044b promocodes: \u0430\u043a\u0442\u0438\u0432\u0430\u0446\u0438\u044f \u0438 \u0441\u0440\u043e\u043a \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.',
  loading: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
  code: '\u041a\u043e\u0434',
  discount: '\u0421\u043a\u0438\u0434\u043a\u0430',
  limit: '\u041b\u0438\u043c\u0438\u0442',
  used: '\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u043e',
  period: '\u041f\u0435\u0440\u0438\u043e\u0434',
  status: '\u0421\u0442\u0430\u0442\u0443\u0441',
  actions: '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
  active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
  inactive: '\u041d\u0435\u0430\u043a\u0442\u0438\u0432\u0435\u043d',
  expired: '\u0418\u0441\u0442\u0451\u043a',
  edit: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c',
  deactivate: '\u0414\u0435\u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  activate: '\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  delete: '\u0423\u0434\u0430\u043b\u0438\u0442\u044c',
  dash: '-',
  emptyState:
    '\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u044b. \u0421\u043e\u0437\u0434\u0430\u0439\u0442\u0435 \u043f\u0435\u0440\u0432\u044b\u0439 \u0447\u0435\u0440\u0435\u0437 \u00ab\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u00bb.',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  closeAria: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  modalCreateTitle: '\u041d\u043e\u0432\u044b\u0439 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  modalEditTitle: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u0430',
  modalCreateSubtitle:
    '\u041a\u043e\u0434, \u0442\u0438\u043f \u0441\u043a\u0438\u0434\u043a\u0438, \u043f\u0435\u0440\u0438\u043e\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f \u0438 \u043b\u0438\u043c\u0438\u0442 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u0439.',
  modalEditSubtitle:
    '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435.',
  discountType: '\u0422\u0438\u043f \u0441\u043a\u0438\u0434\u043a\u0438',
  percentage: '\u041f\u0440\u043e\u0446\u0435\u043d\u0442',
  fixedAmount: '\u0424\u0438\u043a\u0441\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u0430\u044f \u0441\u0443\u043c\u043c\u0430 (\u20bd)',
  value: '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  descriptionPlaceholder:
    '\u041d\u0435\u043e\u0431\u044f\u0437\u0430\u0442\u0435\u043b\u044c\u043d\u043e - \u0438\u043d\u0430\u0447\u0435 \u043f\u043e\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0441\u044f \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u0442\u0435\u043a\u0441\u0442',
  validFrom: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441',
  validTo: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043f\u043e',
  usageLimit: '\u041c\u0430\u043a\u0441\u0438\u043c\u0443\u043c \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u0439',
  enabledPromo: '\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434 \u0430\u043a\u0442\u0438\u0432\u0435\u043d',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  saveChanges: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f',
  saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
  confirmDeleteTitle: '\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0438\u0435 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f',
  confirmDeleteSubtitle: '\u0423\u0434\u0430\u043b\u0435\u043d\u0438\u0435 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u0430',
  confirmDeleteQuestion:
    '\u0412\u044b \u0443\u0432\u0435\u0440\u0435\u043d\u044b, \u0447\u0442\u043e \u0445\u043e\u0442\u0438\u0442\u0435 \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  deleteWarning: '\u042d\u0442\u043e \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 \u043d\u0435\u043b\u044c\u0437\u044f \u043e\u0442\u043c\u0435\u043d\u0438\u0442\u044c.',
  ruble: '\u20bd',
  loadError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u044b',
  updateError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  deleteError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0443\u0434\u0430\u043b\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  codeRequired: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043a\u043e\u0434 \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434\u0430',
  discountValueRequired:
    '\u0417\u043d\u0430\u0447\u0435\u043d\u0438\u0435 \u0441\u043a\u0438\u0434\u043a\u0438 \u0434\u043e\u043b\u0436\u043d\u043e \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0',
  usageLimitRequired:
    '\u041b\u0438\u043c\u0438\u0442 \u0438\u0441\u043f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u043d\u0438\u044f \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0',
  invalidDates:
    '\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0440\u0430\u043d\u044c\u0448\u0435 \u0434\u0430\u0442\u044b \u043d\u0430\u0447\u0430\u043b\u0430',
  saveError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u043f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
  autoDescriptionPrefix: '\u041f\u0440\u043e\u043c\u043e\u043a\u043e\u0434',
} as const;

@Component({
  selector: 'lib-promo-codes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promo-codes.html',
  styleUrl: './promo-codes.scss',
})
export class PromoCodesComponent implements OnInit {
  private readonly promocodeService = inject(PromocodeService);

  readonly ui = UI;
  readonly rows = signal<PromocodeDto[]>([]);
  readonly filter = signal('');
  readonly showModal = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedPromo = signal<PromocodeDto | null>(null);
  readonly showDeleteModal = signal(false);
  readonly promoToDelete = signal<PromocodeDto | null>(null);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);

  form = {
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 10,
    description: '',
    usageLimit: 100,
    validFrom: '',
    validTo: '',
    isActive: true,
  };

  ngOnInit(): void {
    this.loadPromocodes();
  }

  loadPromocodes(): void {
    this.loading.set(true);
    this.error.set(null);
    this.promocodeService
      .getAll({ sortField: 'id', sortDirection: 'desc', limit: 500 })
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.loadError);
          this.loading.set(false);
          return EMPTY;
        }),
      )
      .subscribe((list) => {
        this.rows.set(list);
        this.loading.set(false);
      });
  }

  filteredRows(): PromocodeDto[] {
    const term = this.filter().trim().toLowerCase();
    const list = this.rows();
    if (!term) return list;
    return list.filter(
      (row) =>
        row.code.toLowerCase().includes(term) ||
        (row.description ?? '').toLowerCase().includes(term),
    );
  }

  rowStatus(row: PromocodeDto): PromocodeUiStatus {
    const now = Date.now();
    if (new Date(row.validTo).getTime() < now) return 'Expired';
    if (!row.isActive) return 'Inactive';
    return 'Active';
  }

  statusLabel(status: PromocodeUiStatus): string {
    if (status === 'Active') return this.ui.active;
    if (status === 'Inactive') return this.ui.inactive;
    return this.ui.expired;
  }

  modalTitle(): string {
    return this.modalMode() === 'create' ? this.ui.modalCreateTitle : this.ui.modalEditTitle;
  }

  modalSubtitle(): string {
    return this.modalMode() === 'create' ? this.ui.modalCreateSubtitle : this.ui.modalEditSubtitle;
  }

  discountLabel(row: PromocodeDto): string {
    if (row.discountType === 'percentage') {
      return `${row.discountValue}%`;
    }
    return `${row.discountValue} ${this.ui.ruble}`;
  }

  toggleActive(row: PromocodeDto): void {
    this.promocodeService
      .update(row.id, {
        code: row.code,
        discountType: row.discountType,
        discountValue: Number(row.discountValue),
        description: row.description ?? null,
        isActive: !row.isActive,
        validFrom: row.validFrom,
        validTo: row.validTo,
        maxUses: row.maxUses,
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.updateError);
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadPromocodes());
  }

  openAddModal(): void {
    this.error.set(null);
    this.modalMode.set('create');
    this.selectedPromo.set(null);
    this.form = {
      code: '',
      discountType: 'percentage',
      discountValue: 10,
      description: '',
      usageLimit: 100,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      isActive: true,
    };
    this.showModal.set(true);
  }

  openEditModal(row: PromocodeDto): void {
    this.error.set(null);
    this.modalMode.set('edit');
    this.selectedPromo.set(row);
    this.form = {
      code: row.code,
      discountType: row.discountType,
      discountValue: row.discountValue,
      description: row.description ?? '',
      usageLimit: row.maxUses,
      validFrom: new Date(row.validFrom).toISOString().split('T')[0],
      validTo: new Date(row.validTo).toISOString().split('T')[0],
      isActive: row.isActive,
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedPromo.set(null);
  }

  confirmDelete(row: PromocodeDto): void {
    this.promoToDelete.set(row);
    this.showDeleteModal.set(true);
  }

  cancelDelete(): void {
    this.showDeleteModal.set(false);
    this.promoToDelete.set(null);
  }

  deletePromo(): void {
    const promo = this.promoToDelete();
    if (!promo) return;
    this.promocodeService
      .delete(promo.id)
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.deleteError);
          this.showDeleteModal.set(false);
          this.promoToDelete.set(null);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.showDeleteModal.set(false);
        this.promoToDelete.set(null);
        this.loadPromocodes();
      });
  }

  savePromo(): void {
    const normalizedCode = this.form.code.trim().toUpperCase();
    if (!normalizedCode) {
      this.error.set(this.ui.codeRequired);
      return;
    }

    if (Number(this.form.discountValue) <= 0) {
      this.error.set(this.ui.discountValueRequired);
      return;
    }

    if (Number(this.form.usageLimit) <= 0) {
      this.error.set(this.ui.usageLimitRequired);
      return;
    }

    if (this.form.validFrom && this.form.validTo && this.form.validTo < this.form.validFrom) {
      this.error.set(this.ui.invalidDates);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload = {
      code: normalizedCode,
      discountType: this.form.discountType,
      discountValue: Number(this.form.discountValue),
      description: this.form.description.trim() || null,
      isActive: this.form.isActive,
      validFrom: new Date(this.form.validFrom).toISOString(),
      validTo: new Date(this.form.validTo).toISOString(),
      maxUses: Number(this.form.usageLimit),
    };

    const editId = this.selectedPromo()?.id;
    const request$ =
      this.modalMode() === 'edit' && editId != null
        ? this.promocodeService.update(editId, payload)
        : this.promocodeService.create({
            ...payload,
            description: payload.description || `${this.ui.autoDescriptionPrefix} ${normalizedCode}`,
          });

    request$
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.saveError);
          this.saving.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.saving.set(false);
        this.showModal.set(false);
        this.selectedPromo.set(null);
        this.loadPromocodes();
      });
  }
}
