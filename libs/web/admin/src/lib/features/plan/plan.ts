import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TariffPlan {
  id: number;
  name: string;
  price: number;
  description: string;
  isActive: boolean;
  createdAt: Date;
}

@Component({
  selector: 'lib-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan.html',
  styleUrls: ['./plan.scss'],
})
export class PlanComponent {
  // Тарифные планы
  plans: TariffPlan[] = [
    {
      id: 1,
      name: 'Базовый',
      price: 1000,
      description: 'Для физических лиц',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 2,
      name: 'Стандарт',
      price: 2500,
      description: 'Для малого бизнеса',
      isActive: true,
      createdAt: new Date(),
    },
    {
      id: 3,
      name: 'Премиум',
      price: 5000,
      description: 'Полный функционал',
      isActive: false,
      createdAt: new Date(),
    },
  ];

  // Состояния
  showDeleteModal = false;
  planToDelete: TariffPlan | null = null;
  showForm = false;
  showView = false;
  selectedPlan: TariffPlan | null = null;
  isEditMode = false;

  // Данные формы
  formData = {
    name: '',
    price: 0,
    description: '',
    isActive: true,
  };

  // Методы для тарифов
  createPlan(): void {
    this.isEditMode = false;
    this.formData = { name: '', price: 0, description: '', isActive: true };
    this.showForm = true;
    this.showView = false;
  }

  editPlan(plan: TariffPlan): void {
    this.isEditMode = true;
    this.selectedPlan = plan;
    this.formData = {
      name: plan.name,
      price: plan.price,
      description: plan.description,
      isActive: plan.isActive,
    };
    this.showForm = true;
    this.showView = false;
  }

  viewPlan(plan: TariffPlan): void {
    this.selectedPlan = plan;
    this.showView = true;
    this.showForm = false;
  }

  savePlan(): void {
    if (this.isEditMode && this.selectedPlan) {
      // Обновление
      const index = this.plans.findIndex((p) => p.id === this.selectedPlan?.id);
      if (index !== -1) {
        this.plans[index] = {
          ...this.selectedPlan,
          ...this.formData,
        };
      }
      console.log('Обновлен тариф:', this.formData);
    } else {
      // Создание
      const newPlan: TariffPlan = {
        id: Math.max(...this.plans.map((p) => p.id)) + 1,
        ...this.formData,
        createdAt: new Date(),
      };
      this.plans.push(newPlan);
      console.log('Создан тариф:', newPlan);
    }
    this.showForm = false;
    this.selectedPlan = null;
  }

  confirmDelete(plan: TariffPlan): void {
    this.planToDelete = plan;
    this.showDeleteModal = true;
  }

  deletePlan(): void {
    if (this.planToDelete) {
      this.plans = this.plans.filter((p) => p.id !== this.planToDelete?.id);
      console.log('Удален тариф:', this.planToDelete);
      this.showDeleteModal = false;
      this.planToDelete = null;
    }
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.planToDelete = null;
  }

  cancelForm(): void {
    this.showForm = false;
    this.selectedPlan = null;
  }

  closeView(): void {
    this.showView = false;
    this.selectedPlan = null;
  }
}
