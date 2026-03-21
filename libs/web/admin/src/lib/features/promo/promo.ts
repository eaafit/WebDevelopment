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
  // Промокоды
  promocodes: Promocode[] = [
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

  // Данные формы
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

  // Методы для промокодов
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

  viewPromo(promo: Promocode): void {
    this.selectedPromo = promo;
    this.showView = true;
    this.showForm = false;
  }

  savePromo(): void {
    if (this.isEditMode && this.selectedPromo) {
      // Обновление
      const index = this.promocodes.findIndex((p) => p.id === this.selectedPromo?.id);
      if (index !== -1) {
        this.promocodes[index] = {
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
        id: Math.max(...this.promocodes.map((p) => p.id)) + 1,
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
      this.promocodes.push(newPromo);
      console.log('Создан промокод:', newPromo);
    }
    this.showForm = false;
    this.selectedPromo = null;
  }

  confirmDelete(promo: Promocode): void {
    this.promoToDelete = promo;
    this.showDeleteModal = true;
  }

  deletePromo(): void {
    if (this.promoToDelete) {
      this.promocodes = this.promocodes.filter((p) => p.id !== this.promoToDelete?.id);
      console.log('Удален промокод:', this.promoToDelete);
      this.showDeleteModal = false;
      this.promoToDelete = null;
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

  // Форматирование типа скидки
  getDiscountTypeLabel(type: 'percentage' | 'fixed'): string {
    return type === 'percentage' ? '%' : '₽';
  }

  // Проверка активности промокода по дате
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
