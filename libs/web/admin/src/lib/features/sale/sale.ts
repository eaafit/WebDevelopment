import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import {
  DiscountService,
  type Discount,
  type DiscountCreatePayload,
} from '../../../services/discount.service';

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent implements OnInit {
  private readonly discountService = inject(DiscountService);

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
          this.error.set(err?.message ?? 'Не удалось загрузить скидки');
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
      (d) =>
        d.name.toLowerCase().includes(term) ||
        (d.description ?? '').toLowerCase().includes(term) ||
        String(d.percentage).includes(term),
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
      this.error.set('Укажите название скидки');
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const base: DiscountCreatePayload = {
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
    const req =
      this.modalMode() === 'edit' && editId != null
        ? this.discountService.update(editId, base)
        : this.discountService.create(base);

    req
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось сохранить скидку');
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
    const isActive = Boolean(discount.isActive);
    this.discountService
      .update(discount.id, {
        name: discount.name,
        percentage: Number(discount.percentage),
        description: discount.description ?? null,
        isActive: !isActive,
        validFrom: discount.validFrom,
        validTo: discount.validTo,
        minOrderAmount: discount.minOrderAmount ?? null,
        maxDiscountAmount: discount.maxDiscountAmount ?? null,
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось обновить скидку');
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadDiscounts());
  }
}
