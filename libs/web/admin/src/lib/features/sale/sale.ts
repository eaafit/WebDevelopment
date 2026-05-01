import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import type { Discount } from '@internal/models/discount';
import { DiscountService } from '../../services/discount.service';

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent {
  private readonly discountService = inject(DiscountService);

  discounts: Discount[] = [];
  filterName = '';
  error: string | null = null;
  showAddModal = false;
  creating = false;
  form = {
    name: '',
    percentage: 10,
    description: '',
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    minOrderAmount: null as number | null,
    maxDiscountAmount: null as number | null,
    isActive: true,
  };

  ngOnInit(): void {
    this.loadDiscounts();
  }

  loadDiscounts(): void {
    this.error = null;
    this.discountService
      .getAll({ sortField: 'id', sortDirection: 'desc', take: 200 })
      .pipe(
        catchError((err) => {
          this.error = err?.message ?? 'Не удалось загрузить скидки';
          return EMPTY;
        }),
      )
      .subscribe((rows) => {
        this.discounts = rows;
      });
  }

  get visibleDiscounts(): Discount[] {
    const term = this.filterName.trim().toLowerCase();
    if (!term) return this.discounts;
    return this.discounts.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        (d.description ?? '').toLowerCase().includes(term) ||
        String(d.percentage).includes(term),
    );
  }

  toggleActive(discount: Discount): void {
    this.discountService
      .update(discount.id, { isActive: !discount.isActive })
      .pipe(
        catchError((err) => {
          this.error = err?.message ?? 'Не удалось обновить скидку';
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadDiscounts());
  }

  openAddModal(): void {
    this.error = null;
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
    this.showAddModal = true;
  }

  closeAddModal(): void {
    this.showAddModal = false;
  }

  createDiscount(): void {
    if (!this.form.name.trim()) {
      this.error = 'Укажи название скидки';
      return;
    }
    this.creating = true;
    this.discountService
      .create({
        name: this.form.name.trim(),
        percentage: Number(this.form.percentage),
        description: this.form.description.trim() || null,
        validFrom: this.form.validFrom,
        validTo: this.form.validTo,
        minOrderAmount: this.form.minOrderAmount,
        maxDiscountAmount: this.form.maxDiscountAmount,
        isActive: this.form.isActive,
      })
      .pipe(
        catchError((err) => {
          this.error = err?.message ?? 'Не удалось создать скидку';
          this.creating = false;
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.creating = false;
        this.showAddModal = false;
        this.loadDiscounts();
      });
  }
}
