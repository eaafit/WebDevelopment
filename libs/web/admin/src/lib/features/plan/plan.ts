import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface TariffPlan {
  id: number;
  name: string;
  price: number;
  description: string;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
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
  allPlans: TariffPlan[] = [
    {
      id: 1,
      name: 'Базовый',
      price: 1000,
      description: 'Для физических лиц',
      isActive: true,
      validFrom: new Date(2024, 0, 1),
      validTo: new Date(2024, 11, 31),
      createdAt: new Date(),
    },
    {
      id: 2,
      name: 'Стандарт',
      price: 2500,
      description: 'Для малого бизнеса',
      isActive: true,
      validFrom: new Date(2024, 0, 1),
      validTo: new Date(2024, 11, 31),
      createdAt: new Date(),
    },
    {
      id: 3,
      name: 'Премиум',
      price: 5000,
      description: 'Полный функционал',
      isActive: false,
      validFrom: new Date(2024, 0, 1),
      validTo: new Date(2024, 11, 31),
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

  // Пагинация
  currentPage = 1;
  pageSize = 5;

  // Сортировка
  sortField: keyof TariffPlan = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Фильтры
  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  get filteredAndSortedPlans(): TariffPlan[] {
    let result = [...this.allPlans];

    if (this.filterName) {
      result = result.filter((p) => p.name.toLowerCase().includes(this.filterName.toLowerCase()));
    }
    if (this.filterStatus !== 'all') {
      const active = this.filterStatus === 'active';
      result = result.filter((p) => p.isActive === active);
    }
    if (this.filterDateFrom) {
      const from = new Date(this.filterDateFrom);
      result = result.filter((p) => p.validFrom >= from);
    }
    if (this.filterDateTo) {
      const to = new Date(this.filterDateTo);
      result = result.filter((p) => p.validTo <= to);
    }

    result.sort((a, b) => {
      const aVal = a[this.sortField];
      const bVal = b[this.sortField];
      if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }

  get paginatedPlans(): TariffPlan[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredAndSortedPlans.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAndSortedPlans.length / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) this.currentPage++;
  }

  sortBy(field: keyof TariffPlan): void {
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
    price: 0,
    description: '',
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  };

  createPlan(): void {
    this.isEditMode = false;
    this.formData = {
      name: '',
      price: 0,
      description: '',
      isActive: true,
      validFrom: new Date().toISOString().split('T')[0],
      validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    };
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
      validFrom: new Date(plan.validFrom).toISOString().split('T')[0],
      validTo: new Date(plan.validTo).toISOString().split('T')[0],
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
      const selected = this.selectedPlan;
      const index = this.allPlans.findIndex((p) => p.id === selected.id);
      if (index !== -1) {
        this.allPlans[index] = {
          ...selected,
          name: this.formData.name,
          price: this.formData.price,
          description: this.formData.description,
          isActive: this.formData.isActive,
          validFrom: new Date(this.formData.validFrom),
          validTo: new Date(this.formData.validTo),
        };
      }
      console.log('Обновлен тариф:', this.formData);
    } else {
      const newPlan: TariffPlan = {
        id: Math.max(...this.allPlans.map((p) => p.id), 0) + 1,
        name: this.formData.name,
        price: this.formData.price,
        description: this.formData.description,
        isActive: this.formData.isActive,
        validFrom: new Date(this.formData.validFrom),
        validTo: new Date(this.formData.validTo),
        createdAt: new Date(),
      };
      this.allPlans.push(newPlan);
      console.log('Создан тариф:', newPlan);
    }
    this.showForm = false;
    this.selectedPlan = null;
    this.currentPage = 1;
  }

  confirmDelete(plan: TariffPlan): void {
    this.planToDelete = plan;
    this.showDeleteModal = true;
  }

  deletePlan(): void {
    const toDelete = this.planToDelete;
    if (toDelete) {
      this.allPlans = this.allPlans.filter((p) => p.id !== toDelete.id);
      console.log('Удален тариф:', toDelete);
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
