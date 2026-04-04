import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Discount {
  id: number;
  name: string;
  percentage: number;
  validFrom: Date;
  validTo: Date;
  isActive: boolean;
  description: string;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
}

@Component({
  selector: 'lib-sale',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sale.html',
  styleUrls: ['./sale.scss'],
})
export class SaleComponent {
  allDiscounts: Discount[] = [
    {
      id: 1,
      name: 'Скидка новым клиентам',
      percentage: 10,
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      isActive: true,
      description: 'Для всех новых клиентов при первой сделке',
      minOrderAmount: 1000,
      maxDiscountAmount: 5000,
    },
    {
      id: 2,
      name: 'Летняя акция',
      percentage: 15,
      validFrom: new Date(new Date().setMonth(5, 1)),
      validTo: new Date(new Date().setMonth(8, 31)),
      isActive: true,
      description: 'Скидка на все нотариальные действия',
      minOrderAmount: 2000,
      maxDiscountAmount: 3000,
    },
    {
      id: 3,
      name: 'Скидка пенсионерам',
      percentage: 20,
      validFrom: new Date(),
      validTo: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      isActive: false,
      description: 'Для пенсионеров по предъявлению удостоверения',
      maxDiscountAmount: 2000,
    },
    {
      id: 4,
      name: 'Скидка на доверенности',
      percentage: 5,
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      isActive: true,
      description: 'Скидка на оформление доверенностей',
    },
  ];

  showDeleteModal = false;
  discountToDelete: Discount | null = null;
  showForm = false;
  showView = false;
  selectedDiscount: Discount | null = null;
  isEditMode = false;

  currentPage = 1;
  pageSize = 5;

  sortField: keyof Discount = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  get filteredAndSortedDiscounts(): Discount[] {
    let result = [...this.allDiscounts];

    if (this.filterName) {
      result = result.filter((d) => d.name.toLowerCase().includes(this.filterName.toLowerCase()));
    }
    if (this.filterStatus !== 'all') {
      const active = this.filterStatus === 'active';
      result = result.filter((d) => d.isActive === active);
    }
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom);
      result = result.filter((d) => d.validFrom.getTime() >= from.getTime());
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo);
      result = result.filter((d) => d.validTo.getTime() <= to.getTime());
    }

    result.sort((a, b) => {
      let aVal: any = a[this.sortField];
      let bVal: any = b[this.sortField];

      // Если поле — дата, сравниваем по числовому значению
      if (aVal instanceof Date && bVal instanceof Date) {
        aVal = aVal.getTime();
        bVal = bVal.getTime();
      }

      // Обработка undefined/null (считаем их меньше любого значения)
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1; // null/undefined считаем бОльшими (чтобы шли вниз)
      if (bVal == null) return -1;

      // Сравнение
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }

  get paginatedDiscounts(): Discount[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAndSortedDiscounts.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAndSortedDiscounts.length / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  sortBy(field: keyof Discount): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
  }

  resetFilters(): void {
    this.filterName = '';
    this.filterStatus = 'all';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage = 1;
  }

  formData = {
    name: '',
    percentage: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    isActive: true,
    description: '',
    minOrderAmount: null as number | null,
    maxDiscountAmount: null as number | null,
  };

  createDiscount(): void {
    this.isEditMode = false;
    this.formData = {
      name: '',
      percentage: 0,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      isActive: true,
      description: '',
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
      validFrom: new Date(discount.validFrom).toISOString().split('T')[0],
      validTo: new Date(discount.validTo).toISOString().split('T')[0],
      isActive: discount.isActive,
      description: discount.description,
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
    if (this.isEditMode && this.selectedDiscount) {
      const index = this.allDiscounts.findIndex((d) => d.id === this.selectedDiscount!.id);
      if (index !== -1) {
        this.allDiscounts[index] = {
          ...this.selectedDiscount,
          name: this.formData.name,
          percentage: this.formData.percentage,
          validFrom: new Date(this.formData.validFrom),
          validTo: new Date(this.formData.validTo),
          isActive: this.formData.isActive,
          description: this.formData.description,
          minOrderAmount: this.formData.minOrderAmount || undefined,
          maxDiscountAmount: this.formData.maxDiscountAmount || undefined,
        };
      }
      console.log('Обновлена скидка:', this.formData);
    } else {
      const newDiscount: Discount = {
        id: Math.max(...this.allDiscounts.map((d) => d.id), 0) + 1,
        name: this.formData.name,
        percentage: this.formData.percentage,
        validFrom: new Date(this.formData.validFrom),
        validTo: new Date(this.formData.validTo),
        isActive: this.formData.isActive,
        description: this.formData.description,
        minOrderAmount: this.formData.minOrderAmount || undefined,
        maxDiscountAmount: this.formData.maxDiscountAmount || undefined,
      };
      this.allDiscounts.push(newDiscount);
      console.log('Создана скидка:', newDiscount);
    }
    this.showForm = false;
    this.selectedDiscount = null;
    this.currentPage = 1;
  }

  confirmDelete(discount: Discount): void {
    this.discountToDelete = discount;
    this.showDeleteModal = true;
  }

  deleteDiscount(): void {
    if (this.discountToDelete) {
      this.allDiscounts = this.allDiscounts.filter((d) => d.id !== this.discountToDelete!.id);
      console.log('Удалена скидка:', this.discountToDelete);
      this.showDeleteModal = false;
      this.discountToDelete = null;
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

  isDiscountActive(discount: Discount): boolean {
    const now = new Date();
    return (
      discount.isActive &&
      discount.validFrom.getTime() <= now.getTime() &&
      discount.validTo.getTime() >= now.getTime()
    );
  }

  getDiscountLimits(discount: Discount): string {
    const limits = [];
    if (discount.minOrderAmount) limits.push(`от ${discount.minOrderAmount}₽`);
    if (discount.maxDiscountAmount) limits.push(`макс. скидка ${discount.maxDiscountAmount}₽`);
    return limits.length ? limits.join(', ') : 'нет';
  }
}
