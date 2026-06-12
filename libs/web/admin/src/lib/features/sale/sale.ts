import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import {
  DiscountService,
  type Discount,
  type DiscountCreatePayload,
} from '../../../services/discount.service';

const UI = {
  eyebrow:
    '\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430 / \u0421\u043a\u0438\u0434\u043a\u0438',
  heading: '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0441\u043a\u0438\u0434\u043a\u0430\u043c\u0438',
  lead:
    '\u0426\u0435\u043d\u0442\u0440\u0430\u043b\u0438\u0437\u043e\u0432\u0430\u043d\u043d\u043e\u0435 \u0443\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u0430\u043c\u0438 \u0441\u043a\u0438\u0434\u043e\u043a \u0438 \u0441\u0440\u043e\u043a\u0430\u043c\u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044f.',
  addDiscount: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443',
  filterLead:
    '\u0424\u0438\u043b\u044c\u0442\u0440\u0430\u0446\u0438\u044f \u043f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e, \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e \u0438 \u043f\u0440\u043e\u0446\u0435\u043d\u0442\u0443.',
  shown: '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e',
  search: '\u041f\u043e\u0438\u0441\u043a',
  searchPlaceholder:
    '\u041f\u043e\u0438\u0441\u043a \u043f\u043e \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u044e / \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044e / %',
  tableTitle: '\u0421\u043f\u0438\u0441\u043e\u043a \u0441\u043a\u0438\u0434\u043e\u043a',
  tableLead:
    '\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435, \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0438 \u043f\u0435\u0440\u0435\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u0430\u043a\u0442\u0438\u0432\u043d\u043e\u0441\u0442\u0438 \u043f\u0440\u044f\u043c\u043e \u0438\u0437 \u0442\u0430\u0431\u043b\u0438\u0446\u044b.',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  discount: '\u0421\u043a\u0438\u0434\u043a\u0430',
  period: '\u041f\u0435\u0440\u0438\u043e\u0434',
  constraints: '\u041e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f',
  status: '\u0421\u0442\u0430\u0442\u0443\u0441',
  actions: '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
  from: '\u043e\u0442',
  maxShort: '\u043c\u0430\u043a\u0441.',
  noConstraints: '\u0431\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u0439',
  ruble: '\u20bd',
  active: '\u0410\u043a\u0442\u0438\u0432\u043d\u0430',
  inactive: '\u041d\u0435\u0430\u043a\u0442\u0438\u0432\u043d\u0430',
  edit: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c',
  deactivate: '\u0414\u0435\u0430\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  activate: '\u0410\u043a\u0442\u0438\u0432\u0438\u0440\u043e\u0432\u0430\u0442\u044c',
  emptyState:
    '\u041d\u0435\u0442 \u0441\u043a\u0438\u0434\u043e\u043a \u043f\u043e \u0442\u0435\u043a\u0443\u0449\u0435\u043c\u0443 \u0444\u0438\u043b\u044c\u0442\u0440\u0443. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443\u00bb.',
  modalCreateTitle: '\u041d\u043e\u0432\u0430\u044f \u0441\u043a\u0438\u0434\u043a\u0430',
  modalEditTitle: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u043a\u0438\u0434\u043a\u0438',
  modalCreateSubtitle:
    '\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043f\u043e\u043b\u044f \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435 \u043f\u0440\u0430\u0432\u0438\u043b\u043e.',
  modalEditSubtitle:
    '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b \u0438 \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u0435.',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  closeAria: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  percentage: '\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u0441\u043a\u0438\u0434\u043a\u0438',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  descriptionPlaceholder:
    '\u041a\u0440\u0430\u0442\u043a\u043e \u043e\u043f\u0438\u0448\u0438\u0442\u0435 \u0443\u0441\u043b\u043e\u0432\u0438\u0435 \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u044f',
  validFrom: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441',
  validTo: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043f\u043e',
  minOrder: '\u041c\u0438\u043d. \u0441\u0443\u043c\u043c\u0430 \u0437\u0430\u043a\u0430\u0437\u0430 (\u20bd)',
  minOrderHint:
    '\u041e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e: \u0441\u043a\u0438\u0434\u043a\u0430 \u0442\u043e\u043b\u044c\u043a\u043e \u043e\u0442 \u044d\u0442\u043e\u0439 \u0441\u0443\u043c\u043c\u044b',
  maxDiscount: '\u041c\u0430\u043a\u0441. \u0440\u0430\u0437\u043c\u0435\u0440 \u0441\u043a\u0438\u0434\u043a\u0438 (\u20bd)',
  maxDiscountHint: '\u041e\u043f\u0446\u0438\u043e\u043d\u0430\u043b\u044c\u043d\u043e: \u043f\u043e\u0442\u043e\u043b\u043e\u043a \u0432\u044b\u0433\u043e\u0434\u044b',
  enabledRule: '\u041f\u0440\u0430\u0432\u0438\u043b\u043e \u0430\u043a\u0442\u0438\u0432\u043d\u043e',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
  loadError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0438',
  nameRequired: '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0441\u043a\u0438\u0434\u043a\u0438',
  invalidPercentage:
    '\u041f\u0440\u043e\u0446\u0435\u043d\u0442 \u0441\u043a\u0438\u0434\u043a\u0438 \u0434\u043e\u043b\u0436\u0435\u043d \u0431\u044b\u0442\u044c \u0431\u043e\u043b\u044c\u0448\u0435 0 \u0438 \u043d\u0435 \u043f\u0440\u0435\u0432\u044b\u0448\u0430\u0442\u044c 100',
  invalidDates:
    '\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0440\u0430\u043d\u044c\u0448\u0435 \u0434\u0430\u0442\u044b \u043d\u0430\u0447\u0430\u043b\u0430',
  saveError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443',
  updateError: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043e\u0431\u043d\u043e\u0432\u0438\u0442\u044c \u0441\u043a\u0438\u0434\u043a\u0443',
} as const;

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent implements OnInit {
  private readonly discountService = inject(DiscountService);

  readonly ui = UI;
  readonly discounts = signal<Discount[]>([]);
  readonly filterName = signal('');
  readonly error = signal<string | null>(null);
  readonly showModal = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly saving = signal(false);
  readonly selectedDiscount = signal<Discount | null>(null);

  form = {
    name: '',
    percentage: 10,
    description: '',
    validFrom: '',
    validTo: '',
    minOrderAmount: null as number | null,
    maxDiscountAmount: null as number | null,
    isActive: true,
  };

  ngOnInit(): void {
    this.loadDiscounts();
  }

  loadDiscounts(): void {
    this.error.set(null);
    this.discountService
      .getAll({ sortField: 'id', sortDirection: 'desc', limit: 200 })
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.loadError);
          return EMPTY;
        }),
      )
      .subscribe((rows) => this.discounts.set(rows));
  }

  visibleDiscounts(): Discount[] {
    const term = this.filterName().trim().toLowerCase();
    const list = this.discounts();
    if (!term) return list;
    return list.filter(
      (discount) =>
        discount.name.toLowerCase().includes(term) ||
        (discount.description ?? '').toLowerCase().includes(term) ||
        String(discount.percentage).includes(term),
    );
  }

  openCreateModal(): void {
    this.error.set(null);
    this.modalMode.set('create');
    this.selectedDiscount.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(discount: Discount): void {
    this.error.set(null);
    this.modalMode.set('edit');
    this.selectedDiscount.set(discount);
    this.form = {
      name: discount.name,
      percentage: discount.percentage,
      description: discount.description ?? '',
      validFrom: new Date(discount.validFrom).toISOString().split('T')[0],
      validTo: new Date(discount.validTo).toISOString().split('T')[0],
      minOrderAmount: discount.minOrderAmount ?? null,
      maxDiscountAmount: discount.maxDiscountAmount ?? null,
      isActive: discount.isActive,
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.selectedDiscount.set(null);
  }

  modalTitle(): string {
    return this.modalMode() === 'create' ? this.ui.modalCreateTitle : this.ui.modalEditTitle;
  }

  modalSubtitle(): string {
    return this.modalMode() === 'create' ? this.ui.modalCreateSubtitle : this.ui.modalEditSubtitle;
  }

  statusLabel(discount: Discount): string {
    return discount.isActive ? this.ui.active : this.ui.inactive;
  }

  private resetForm(): void {
    this.form = {
      name: '',
      percentage: 10,
      description: '',
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      minOrderAmount: null,
      maxDiscountAmount: null,
      isActive: true,
    };
  }

  saveDiscount(): void {
    if (!this.form.name.trim()) {
      this.error.set(this.ui.nameRequired);
      return;
    }

    if (Number(this.form.percentage) <= 0 || Number(this.form.percentage) > 100) {
      this.error.set(this.ui.invalidPercentage);
      return;
    }

    if (this.form.validFrom && this.form.validTo && this.form.validTo < this.form.validFrom) {
      this.error.set(this.ui.invalidDates);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const payload: DiscountCreatePayload = {
      name: this.form.name.trim(),
      percentage: Number(this.form.percentage),
      description: this.form.description.trim() || null,
      isActive: this.form.isActive,
      validFrom: this.form.validFrom,
      validTo: this.form.validTo,
      minOrderAmount: this.form.minOrderAmount,
      maxDiscountAmount: this.form.maxDiscountAmount,
    };

    const editId = this.selectedDiscount()?.id;
    const request$ =
      this.modalMode() === 'edit' && editId != null
        ? this.discountService.update(editId, payload)
        : this.discountService.create(payload);

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
        this.selectedDiscount.set(null);
        this.loadDiscounts();
      });
  }

  toggleActive(discount: Discount): void {
    this.discountService
      .update(discount.id, {
        name: discount.name,
        percentage: Number(discount.percentage),
        description: discount.description ?? null,
        isActive: !discount.isActive,
        validFrom: discount.validFrom,
        validTo: discount.validTo,
        minOrderAmount: discount.minOrderAmount ?? null,
        maxDiscountAmount: discount.maxDiscountAmount ?? null,
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || this.ui.updateError);
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadDiscounts());
  }
}
