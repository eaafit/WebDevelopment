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
          this.error.set(err?.error?.message || err?.message || 'Не удалось загрузить промокоды');
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
          this.error.set(err?.error?.message || err?.message || 'Не удалось обновить промокод');
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
          this.error.set(err?.error?.message || err?.message || 'Не удалось удалить промокод');
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
    if (!this.form.code.trim()) {
      this.error.set('Укажите код промокода');
      return;
    }
    this.saving.set(true);
    this.error.set(null);

    const editId = this.selectedPromo()?.id;
    const req =
      this.modalMode() === 'edit' && editId != null
        ? this.promocodeService.update(editId, {
            code: this.form.code.trim().toUpperCase(),
            discountType: this.form.discountType,
            discountValue: Number(this.form.discountValue),
            description: this.form.description.trim() || null,
            isActive: this.form.isActive,
            validFrom: new Date(this.form.validFrom).toISOString(),
            validTo: new Date(this.form.validTo).toISOString(),
            maxUses: Number(this.form.usageLimit),
          })
        : this.promocodeService.create({
            code: this.form.code.trim().toUpperCase(),
            discountType: this.form.discountType,
            discountValue: Number(this.form.discountValue),
            description:
              this.form.description.trim() || `Промокод ${this.form.code.trim().toUpperCase()}`,
            isActive: this.form.isActive,
            validFrom: new Date(this.form.validFrom).toISOString(),
            validTo: new Date(this.form.validTo).toISOString(),
            maxUses: Number(this.form.usageLimit),
          });

    req
      .pipe(
        catchError((err) => {
          this.error.set(err?.error?.message || err?.message || 'Не удалось сохранить промокод');
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
