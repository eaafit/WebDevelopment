import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { AdminPromoBridgeService, AdminPromoRow } from '../../services/admin-promo-bridge.service';

@Component({
  selector: 'lib-promo-codes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promo-codes.html',
  styleUrl: './promo-codes.scss',
})
export class PromoCodesComponent {
  private readonly promoService = inject(AdminPromoBridgeService);

  readonly rows = signal<AdminPromoRow[]>([]);
  readonly showAddModal = signal(false);
  readonly error = signal<string | null>(null);
  readonly loading = signal(false);

  filter = '';
  form = {
    code: '',
    discountPercent: 10,
    usageLimit: 100,
    expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  };

  ngOnInit(): void {
    this.loadPromos();
  }

  loadPromos(): void {
    this.loading.set(true);
    this.error.set(null);
    this.promoService
      .list(this.filter)
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось загрузить промокоды');
          this.loading.set(false);
          return EMPTY;
        }),
      )
      .subscribe((rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      });
  }

  get filteredRows(): AdminPromoRow[] {
    const term = this.filter.trim().toLowerCase();
    if (!term) return this.rows();
    return this.rows().filter((row) => row.code.toLowerCase().includes(term));
  }

  toggleStatus(row: AdminPromoRow): void {
    this.promoService
      .deactivate(row.id)
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось деактивировать промокод');
          return EMPTY;
        }),
      )
      .subscribe(() => this.loadPromos());
  }

  openAddModal(): void {
    this.error.set(null);
    this.form = {
      code: '',
      discountPercent: 10,
      usageLimit: 100,
      expiresAt: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    };
    this.showAddModal.set(true);
  }

  closeAddModal(): void {
    this.showAddModal.set(false);
  }

  savePromo(): void {
    if (!this.form.code.trim()) {
      this.error.set('Укажи код промокода');
      return;
    }
    this.promoService
      .create({
        code: this.form.code.trim().toUpperCase(),
        discountPercent: Number(this.form.discountPercent),
        usageLimit: Number(this.form.usageLimit),
        expiresAt: new Date(this.form.expiresAt).toISOString(),
      })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось создать промокод');
          return EMPTY;
        }),
      )
      .subscribe(() => {
        this.showAddModal.set(false);
        this.loadPromos();
      });
  }
}

