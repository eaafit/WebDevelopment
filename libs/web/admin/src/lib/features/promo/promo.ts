import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface Promocode {
  id: number;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  validFrom: Date;
  validTo: Date;
  maxUses: number;
  usedCount: number;
  isActive: boolean;
  description: string;
}

@Component({
  selector: 'lib-promo',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './promo.html',
  styleUrls: ['./promo.scss'],
})
export class PromoComponent {
  // Исходные данные
  allPromocodes: Promocode[] = [
    {
      id: 1,
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      maxUses: 100,
      usedCount: 23,
      isActive: true,
      description: 'Приветственная скидка 10%',
    },
    {
      id: 2,
      code: 'SUMMER500',
      discountType: 'fixed',
      discountValue: 500,
      validFrom: new Date(),
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 3)),
      maxUses: 50,
      usedCount: 12,
      isActive: true,
      description: 'Летняя скидка 500₽',
    },
    {
      id: 3,
      code: 'VIP20',
      discountType: 'percentage',
      discountValue: 20,
      validFrom: new Date(),
      validTo: new Date(new Date().setDate(new Date().getDate() + 15)),
      maxUses: 200,
      usedCount: 45,
      isActive: false,
      description: 'VIP-скидка 20%',
    },
  ];

  // Состояния
  showDeleteModal = false;
  promoToDelete: Promocode | null = null;
  showForm = false;
  showView = false;
  selectedPromo: Promocode | null = null;
  isEditMode = false;

  // Пагинация
  currentPage = 1;
  pageSize = 5;

  // Сортировка
  sortField: keyof Promocode = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Фильтры
  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  // Геттер для отфильтрованных и отсортированных промокодов
  get filteredAndSortedPromocodes(): Promocode[] {
    let result = [...this.allPromocodes];

    // Фильтр по коду
    if (this.filterName) {
      result = result.filter((p) => p.code.toLowerCase().includes(this.filterName.toLowerCase()));
    }
    // Фильтр по статусу
    if (this.filterStatus !== 'all') {
      const active = this.filterStatus === 'active';
      result = result.filter((p) => p.isActive === active);
    }
    // Фильтр по дате начала
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom);
      result = result.filter((p) => p.validFrom >= from);
    }
    // Фильтр по дате окончания
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo);
      result = result.filter((p) => p.validTo <= to);
    }

    // Сортировка
    result.sort((a, b) => {
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }

  // Отображаемые на текущей странице записи
  get paginatedPromocodes(): Promocode[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAndSortedPromocodes.slice(start, start + this.pageSize);
  }

  // Общее количество страниц
  get totalPages(): number {
    return Math.ceil(this.filteredAndSortedPromocodes.length / this.pageSize);
  }

  // Переход на предыдущую страницу
  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  // Переход на следующую страницу
  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  // Сортировка по полю
  sortBy(field: keyof Promocode): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1; // при изменении сортировки сбрасываем на первую страницу
  }

  // Сброс всех фильтров
  resetFilters(): void {
    this.filterName = '';
    this.filterStatus = 'all';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage = 1;
  }

  // Данные формы (для создания/редактирования)
  formData = {
    code: '',
    discountType: 'percentage' as 'percentage' | 'fixed',
    discountValue: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    maxUses: 100,
    usedCount: 0,
    isActive: true,
    description: '',
  };

  // Создание нового промокода
  createPromo(): void {
    this.isEditMode = false;
    this.formData = {
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      maxUses: 100,
      usedCount: 0,
      isActive: true,
      description: '',
    };
    this.showForm = true;
    this.showView = false;
  }

  // Редактирование промокода
  editPromo(promo: Promocode): void {
    this.isEditMode = true;
    this.selectedPromo = promo;
    this.formData = {
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      validFrom: new Date(promo.validFrom).toISOString().split('T')[0],
      validTo: new Date(promo.validTo).toISOString().split('T')[0],
      maxUses: promo.maxUses,
      usedCount: promo.usedCount,
      isActive: promo.isActive,
      description: promo.description,
    };
    this.showForm = true;
    this.showView = false;
  }

  // Просмотр промокода
  viewPromo(promo: Promocode): void {
    this.selectedPromo = promo;
    this.showView = true;
    this.showForm = false;
  }

  // Сохранение (создание или обновление)
  savePromo(): void {
    if (this.isEditMode && this.selectedPromo) {
      // Обновление
      const index = this.allPromocodes.findIndex((p) => p.id === this.selectedPromo?.id);
      if (index !== -1) {
        this.allPromocodes[index] = {
          ...this.selectedPromo,
          code: this.formData.code,
          discountType: this.formData.discountType,
          discountValue: this.formData.discountValue,
          validFrom: new Date(this.formData.validFrom),
          validTo: new Date(this.formData.validTo),
          maxUses: this.formData.maxUses,
          usedCount: this.formData.usedCount,
          isActive: this.formData.isActive,
          description: this.formData.description,
        };
      }
      console.log('Обновлен промокод:', this.formData);
    } else {
      // Создание
      const newPromo: Promocode = {
        id: Math.max(...this.allPromocodes.map((p) => p.id), 0) + 1,
        code: this.formData.code,
        discountType: this.formData.discountType,
        discountValue: this.formData.discountValue,
        validFrom: new Date(this.formData.validFrom),
        validTo: new Date(this.formData.validTo),
        maxUses: this.formData.maxUses,
        usedCount: 0,
        isActive: this.formData.isActive,
        description: this.formData.description,
      };
      this.allPromocodes.push(newPromo);
      console.log('Создан промокод:', newPromo);
    }
    this.showForm = false;
    this.selectedPromo = null;
    this.currentPage = 1; // после сохранения возвращаемся на первую страницу
  }

  // Подтверждение удаления
  confirmDelete(promo: Promocode): void {
    this.promoToDelete = promo;
    this.showDeleteModal = true;
  }

  // Удаление
  deletePromo(): void {
    if (this.promoToDelete) {
      this.allPromocodes = this.allPromocodes.filter((p) => p.id !== this.promoToDelete?.id);
      console.log('Удален промокод:', this.promoToDelete);
      this.showDeleteModal = false;
      this.promoToDelete = null;
    }
  }

  // Отмена удаления
  cancelDelete(): void {
    this.showDeleteModal = false;
    this.promoToDelete = null;
  }

  // Отмена формы
  cancelForm(): void {
    this.showForm = false;
    this.selectedPromo = null;
  }

  // Закрыть просмотр
  closeView(): void {
    this.showView = false;
    this.selectedPromo = null;
  }

  // Вспомогательные методы
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
