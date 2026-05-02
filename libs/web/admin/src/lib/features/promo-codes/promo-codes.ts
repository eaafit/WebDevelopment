import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { PromocodeService, type PromocodeDto } from '../../../services/promocode.service';

export type PromocodeUiStatus = 'Active' | 'Inactive' | 'Expired';

@Component({
  selector: 'lib-promo-codes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promo-codes.html',
  styleUrl: './promo-codes.scss',
})
export class PromoCodesComponent implements OnInit {
  private readonly promocodeService = inject(PromocodeService);

  readonly rows = signal<PromocodeDto[]>([]);
  readonly filter = signal('');
  readonly showModal = signal(false);
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
      .getAll({ sortField: 'id', sortDirection: 'desc', take: 500 })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось загрузить промокоды');
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
    return list.filter((row) => row.code.toLowerCase().includes(term));
  }

  rowStatus(row: PromocodeDto): PromocodeUiStatus {
    const now = Date.now();
    if (new Date(row.validTo).getTime() < now) return 'Expired';
    if (!row.isActive) return 'Inactive';
    return 'Active';
  }

  discountLabel(row: PromocodeDto): string {
    if (row.discountType === 'percentage') {
      return `${row.discountValue}%`;
    }
    return `${row.discountValue} ₽`;
  }

  toggleActive(row: PromocodeDto): void {
    const isActive = Boolean(row.isActive);
    this.promocodeService
      .update(row.id, {
        code: row.code,
        discountType: row.discountType,
        discountValue: Number(row.discountValue),
        description: row.description ?? null,
        isActive: !isActive,
        validFrom: row.validFrom,
        validTo: row.validTo,
        maxUses: row.maxUses,
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось обновить промокод');
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadPromocodes());
  }

  openAddModal(): void {
    this.error.set(null);
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

  closeModal(): void {
    this.showModal.set(false);
  }

  savePromo(): void {
    if (!this.form.code.trim()) {
      this.error.set('Укажите код промокода');
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    this.promocodeService
      .create({
        code: this.form.code.trim().toUpperCase(),
        discountType: this.form.discountType,
        discountValue: Number(this.form.discountValue),
        description:
          this.form.description.trim() || `Промокод ${this.form.code.trim().toUpperCase()}`,
        isActive: this.form.isActive,
        validFrom: new Date(this.form.validFrom).toISOString(),
        validTo: new Date(this.form.validTo).toISOString(),
        maxUses: Number(this.form.usageLimit),
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось создать промокод');
          this.saving.set(false);
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.saving.set(false);
        this.showModal.set(false);
        this.loadPromocodes();
      });
  }
}
