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
  // Скидки
  discounts: Discount[] = [
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

  // Состояния
  showDeleteModal = false;
  discountToDelete: Discount | null = null;
  showForm = false;
  showView = false;
  selectedDiscount: Discount | null = null;
  isEditMode = false;

  // Данные формы
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

  // Методы для скидок
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
      // Обновление
      const index = this.discounts.findIndex((d) => d.id === this.selectedDiscount?.id);
      if (index !== -1) {
        this.discounts[index] = {
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
      // Создание
      const newDiscount: Discount = {
        id: Math.max(...this.discounts.map((d) => d.id)) + 1,
        name: this.formData.name,
        percentage: this.formData.percentage,
        validFrom: new Date(this.formData.validFrom),
        validTo: new Date(this.formData.validTo),
        isActive: this.formData.isActive,
        description: this.formData.description,
        minOrderAmount: this.formData.minOrderAmount || undefined,
        maxDiscountAmount: this.formData.maxDiscountAmount || undefined,
      };
      this.discounts.push(newDiscount);
      console.log('Создана скидка:', newDiscount);
    }
    this.showForm = false;
    this.selectedDiscount = null;
  }

  confirmDelete(discount: Discount): void {
    this.discountToDelete = discount;
    this.showDeleteModal = true;
  }

  deleteDiscount(): void {
    if (this.discountToDelete) {
      this.discounts = this.discounts.filter((d) => d.id !== this.discountToDelete?.id);
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

  // Проверка активности скидки по дате
  isDiscountActive(discount: Discount): boolean {
    const now = new Date();
    return (
      discount.isActive && new Date(discount.validFrom) <= now && new Date(discount.validTo) >= now
    );
  }

  // Форматирование ограничений
  getDiscountLimits(discount: Discount): string {
    const limits = [];
    if (discount.minOrderAmount) {
      limits.push(`от ${discount.minOrderAmount}₽`);
    }
    if (discount.maxDiscountAmount) {
      limits.push(`макс. скидка ${discount.maxDiscountAmount}₽`);
    }
    return limits.length ? limits.join(', ') : 'нет';
  }
}
