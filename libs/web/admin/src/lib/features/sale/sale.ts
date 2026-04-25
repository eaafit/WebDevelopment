import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DiscountService } from '../../services/discount.service';
import { Discount } from '@internal/api/discount';

interface DiscountQueryParams {
  filterName?: string;
  filterStatus?: 'active' | 'inactive';
  filterDateFrom?: string;
  filterDateTo?: string;
  sortField?: keyof Discount;
  sortDirection?: 'asc' | 'desc';
  skip?: number;
  take?: number;
}

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent implements OnInit {
  private discountService = inject(DiscountService) as DiscountService;

  allDiscounts: Discount[] = [];
  loading = false;

  showDeleteModal = false;
  discountToDelete: Discount | null = null;
  showForm = false;
  showView = false;
  selectedDiscount: Discount | null = null;
  isEditMode = false;

  currentPage = 1;
  pageSize = 5;
  totalItems = 0;

  sortField: keyof Discount = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  formData = {
    name: '',
    percentage: 0,
    description: '',
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    minOrderAmount: null as number | null,
    maxDiscountAmount: null as number | null,
  };

  ngOnInit(): void {
    this.loadDiscounts();
  }

  loadDiscounts(): void {
    this.loading = true;
    const params: DiscountQueryParams = {
      filterName: this.filterName || undefined,
      filterStatus: this.filterStatus !== 'all' ? this.filterStatus : undefined,
      filterDateFrom: this.filterDateFrom || undefined,
      filterDateTo: this.filterDateTo || undefined,
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      skip: (this.currentPage - 1) * this.pageSize,
      take: this.pageSize,
    };
    this.discountService.getAll(params).subscribe({
      next: (data: Discount[]) => {
        this.allDiscounts = data;
        this.totalItems = data.length;
        this.loading = false;
      },
      error: (err: any) => {
        console.error('Ошибка загрузки скидок:', err);
        this.loading = false;
      },
    });
  }

  get paginatedDiscounts(): Discount[] {
    return this.allDiscounts;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadDiscounts();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadDiscounts();
    }
  }

  sortBy(field: keyof Discount): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadDiscounts();
  }

  resetFilters(): void {
    this.filterName = '';
    this.filterStatus = 'all';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage = 1;
    this.loadDiscounts();
  }

  createDiscount(): void {
    this.isEditMode = false;
    this.formData = {
      name: '',
      percentage: 0,
      description: '',
      isActive: true,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      minOrderAmount: null,
      maxDiscountAmount: null,
    };
    this.showForm = true;
    this.showView = false;
  }

  editDiscount(discount: Discount): void {
    this.isEditMode = true;
    this.selectedDiscount = discount;
    this.formData = {
      name: discount.name,
      percentage: discount.percentage,
      description: discount.description || '',
      isActive: discount.isActive,
      validFrom: new Date(discount.validFrom).toISOString().split('T')[0],
      validTo: new Date(discount.validTo).toISOString().split('T')[0],
      minOrderAmount: discount.minOrderAmount ?? null,
      maxDiscountAmount: discount.maxDiscountAmount ?? null,
    };
    this.showForm = true;
    this.showView = false;
  }

  viewDiscount(discount: Discount): void {
    this.selectedDiscount = discount;
    this.showView = true;
    this.showForm = false;
  }

  saveDiscount(): void {
    const data = {
      name: this.formData.name,
      percentage: this.formData.percentage,
      description: this.formData.description,
      isActive: this.formData.isActive,
      validFrom: this.formData.validFrom,
      validTo: this.formData.validTo,
      minOrderAmount: this.formData.minOrderAmount,
      maxDiscountAmount: this.formData.maxDiscountAmount,
    };
    if (this.isEditMode && this.selectedDiscount) {
      this.discountService.update(this.selectedDiscount.id, data).subscribe({
        next: () => {
          this.showForm = false;
          this.selectedDiscount = null;
          this.loadDiscounts();
        },
        error: (err: any) => console.error('Ошибка обновления скидки:', err),
      });
    } else {
      this.discountService.create(data).subscribe({
        next: () => {
          this.showForm = false;
          this.loadDiscounts();
        },
        error: (err: any) => console.error('Ошибка создания скидки:', err),
      });
    }
  }

  confirmDelete(discount: Discount): void {
    this.discountToDelete = discount;
    this.showDeleteModal = true;
  }

  deleteDiscount(): void {
    if (this.discountToDelete) {
      this.discountService.delete(this.discountToDelete.id).subscribe({
        next: () => {
          this.showDeleteModal = false;
          this.discountToDelete = null;
          this.loadDiscounts();
        },
        error: (err: any) => console.error('Ошибка удаления скидки:', err),
      });
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.discountToDelete = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedDiscount = null;
  }

  closeView(): void {
    this.showView = false;
    this.selectedDiscount = null;
  }

  getDiscountLimits(discount: Discount): string {
    const limits = [];
    if (discount.minOrderAmount) limits.push(`от ${discount.minOrderAmount}₽`);
    if (discount.maxDiscountAmount) limits.push(`макс. скидка ${discount.maxDiscountAmount}₽`);
    return limits.length ? limits.join(', ') : 'нет ограничений';
  }

  isDiscountActive(discount: Discount): boolean {
    const now = new Date();
    return (
      discount.isActive && new Date(discount.validFrom) <= now && new Date(discount.validTo) >= now
    );
  }
}
