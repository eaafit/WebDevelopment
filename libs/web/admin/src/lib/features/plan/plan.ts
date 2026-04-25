import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TariffPlanService } from '../../services/tariff-plan.service';
import { TariffPlan } from '@internal/api/tariff-plan';

@Component({
  selector: 'lib-plan',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan.html',
  styleUrls: ['./plan.scss'],
})
export class PlanComponent implements OnInit {
  private tariffPlanService = inject(TariffPlanService);

  allPlans: TariffPlan[] = [];
  loading = false;

  showDeleteModal = false;
  planToDelete: TariffPlan | null = null;
  showForm = false;
  showView = false;
  selectedPlan: TariffPlan | null = null;
  isEditMode = false;

  currentPage = 1;
  pageSize = 5;
  totalItems = 0;

  sortField: keyof TariffPlan = 'id';
  sortDirection: 'asc' | 'desc' = 'asc';

  filterName = '';
  filterStatus: 'all' | 'active' | 'inactive' = 'all';
  filterDateFrom = '';
  filterDateTo = '';

  formData = {
    name: '',
    price: 0,
    description: '',
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  };

  ngOnInit(): void {
    this.loadPlans();
  }

  loadPlans(): void {
    this.loading = true;
    const params = {
      filterName: this.filterName || undefined,
      filterStatus: this.filterStatus !== 'all' ? this.filterStatus : undefined,
      filterDateFrom: this.filterDateFrom || undefined,
      filterDateTo: this.filterDateTo || undefined,
      sortField: this.sortField,
      sortDirection: this.sortDirection,
      skip: (this.currentPage - 1) * this.pageSize,
      take: this.pageSize,
    };
    this.tariffPlanService.getAll(params).subscribe({
      next: (data) => {
        this.allPlans = data;
        this.totalItems = data.length;
        this.loading = false;
      },
      error: (err) => {
        console.error('Ошибка загрузки тарифов:', err);
        this.loading = false;
      },
    });
  }

  get paginatedPlans(): TariffPlan[] {
    return this.allPlans;
  }

  get totalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadPlans();
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadPlans();
    }
  }

  sortBy(field: keyof TariffPlan): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.currentPage = 1;
    this.loadPlans();
  }

  resetFilters(): void {
    this.filterName = '';
    this.filterStatus = 'all';
    this.filterDateFrom = '';
    this.filterDateTo = '';
    this.currentPage = 1;
    this.loadPlans();
  }

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
      description: plan.description || '',
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
    const data = {
      name: this.formData.name,
      price: this.formData.price,
      description: this.formData.description,
      isActive: this.formData.isActive,
      validFrom: this.formData.validFrom,
      validTo: this.formData.validTo,
    };
    if (this.isEditMode && this.selectedPlan) {
      this.tariffPlanService.update(this.selectedPlan.id, data).subscribe({
        next: () => {
          this.showForm = false;
          this.selectedPlan = null;
          this.loadPlans();
        },
        error: (err) => console.error('Ошибка обновления:', err),
      });
    } else {
      this.tariffPlanService.create(data).subscribe({
        next: () => {
          this.showForm = false;
          this.loadPlans();
        },
        error: (err) => console.error('Ошибка создания:', err),
      });
    }
  }

  confirmDelete(plan: TariffPlan): void {
    this.planToDelete = plan;
    this.showDeleteModal = true;
  }

  deletePlan(): void {
    if (this.planToDelete) {
      this.tariffPlanService.delete(this.planToDelete.id).subscribe({
        next: () => {
          this.showDeleteModal = false;
          this.planToDelete = null;
          this.loadPlans();
        },
        error: (err) => console.error('Ошибка удаления:', err),
      });
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
