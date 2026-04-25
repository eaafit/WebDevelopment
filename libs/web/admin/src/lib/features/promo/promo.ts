import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { PromocodeService } from '../../services/promocode.service';
import { Promocode } from '@internal/api/promocode';

interface PromocodeQueryParams {
  filterName?: string;
  filterStatus?: 'active' | 'inactive';
  filterDateFrom?: string;
  filterDateTo?: string;
  sortField?: keyof Promocode;
  sortDirection?: 'asc' | 'desc';
  skip?: number;
  take?: number;
}

@Component({
  selector: 'lib-promo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promo.html',
  styleUrls: ['./promo.scss'],
})
export class PromoComponent implements OnInit {
  private promocodeService = inject(PromocodeService) as PromocodeService;

  allPromocodes: Promocode[] = [];
  loading = false;

  showDeleteModal = false;
  promoToDelete: Promocode | null = null;
  showForm = false;
  showView = false;
  selectedPromo: Promocode | null = null;
  isEditMode = false;

  currentPage = 1;
  pageSize = 5;
  totalItems = 0;

  sortField: keyof Promocode = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  formData = {
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    description: '',
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    maxUses: 100,
    usedCount: 0,
  };

  ngOnInit(): void {
    this.loadPromocodes();
  }

  loadPromocodes(): void {
    this.loading = true;
    const params: PromocodeQueryParams = {
      filterName: this.filterName || undefined,
      filterStatus: this.filterStatus !== 'all' ? this.filterStatus : undefined,
      filterDateFrom: this.filterDateFrom || undefined,
      filterDateTo: this.filterDateTo || undefined,
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      skip: (this.currentPage - 1) * this.pageSize,
      take: this.pageSize,
    };
    this.promocodeService.getAll(params).subscribe({
      next: (data) => {
        this.allPromocodes = data;
        this.totalItems = data.length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Ошибка загрузки промокодов:', err);
        this.loading = false;
      },
    });
  }

  get paginatedPromocodes(): Promocode[] {
    return this.allPromocodes;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPromocodes();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPromocodes();
    }
  }

  sortBy(field: keyof Promocode): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadPromocodes();
  }

  resetFilters(): void {
    this.filterName = '';
    this.filterStatus = 'all';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage = 1;
    this.loadPromocodes();
  }

  createPromo(): void {
    this.isEditMode = false;
    this.formData = {
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      description: '',
      isActive: true,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      maxUses: 100,
      usedCount: 0,
    };
    this.showForm = true;
    this.showView = false;
  }

  editPromo(promo: Promocode): void {
    this.isEditMode = true;
    this.selectedPromo = promo;
    this.formData = {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      description: promo.description || '',
      isActive: promo.isActive,
      validFrom: new Date(promo.validFrom).toISOString().split('T')[0],
      validTo: new Date(promo.validTo).toISOString().split('T')[0],
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
    };
    this.showForm = true;
    this.showView = false;
  }

  viewPromo(promo: Promocode): void {
    this.selectedPromo = promo;
    this.showView = true;
    this.showForm = false;
  }

  savePromo(): void {
    const data = {
      code: this.formData.code,
      discountType: this.formData.discountType,
      discountValue: this.formData.discountValue,
      description: this.formData.description,
      isActive: this.formData.isActive,
      validFrom: this.formData.validFrom,
      validTo: this.formData.validTo,
      maxUses: this.formData.maxUses,
    };
    if (this.isEditMode && this.selectedPromo) {
      this.promocodeService.update(this.selectedPromo.id, data).subscribe({
        next: () => {
          this.showForm = false;
          this.selectedPromo = null;
          this.loadPromocodes();
        },
        error: (err) => console.error('Ошибка обновления промокода:', err),
      });
    } else {
      (data as any).usedCount = 0;
      this.promocodeService.create(data).subscribe({
        next: () => {
          this.showForm = false;
          this.loadPromocodes();
        },
        error: (err) => console.error('Ошибка создания промокода:', err),
      });
    }
  }

  confirmDelete(promo: Promocode): void {
    this.promoToDelete = promo;
    this.showDeleteModal = true;
  }

  deletePromo(): void {
    if (this.promoToDelete) {
      this.promocodeService.delete(this.promoToDelete.id).subscribe({
        next: () => {
          this.showDeleteModal = false;
          this.promoToDelete = null;
          this.loadPromocodes();
        },
        error: (err) => console.error('Ошибка удаления промокода:', err),
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.promoToDelete = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedPromo = null;
  }

  closeView(): void {
    this.showView = false;
    this.selectedPromo = null;
  }

  getDiscountTypeLabel(type: 'percentage' | 'fixed'): string {
    return type === 'percentage' ? '%' : '₽';
  }

  isPromoActive(promo: Promocode): boolean {
    const now = new Date();
    return (
      promo.isActive &&
      new Date(promo.validFrom) <= now &&
      new Date(promo.validTo) >= now &&
      promo.usedCount < promo.maxUses
    );
  }
}
