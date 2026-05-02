import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubscriptionPlan } from '@notary-portal/api-contracts';
import { catchError, of } from 'rxjs';
import { PlanModalComponent, PlanModalSavedEvent } from '../plan-modal/plan-modal';
import { TariffPlanService, type TariffPlan } from '../../../../services/tariff-plan.service';

@Component({
  selector: 'lib-plans-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanModalComponent],
  templateUrl: './plans-list.html',
  styleUrl: './plans-list.scss',
})
export class PlansListComponent {
  private readonly tariffPlanService = inject(TariffPlanService);

  readonly tariffPlans = signal<TariffPlan[]>([]);
  readonly error = signal<string | null>(null);
  get plans() {
    const source = this.tariffPlans().slice(0, 3);
    const defaultFeaturesByPlan: Record<SubscriptionPlan, string[]> = {
      [SubscriptionPlan.UNSPECIFIED]: ['Базовые функции'],
      [SubscriptionPlan.BASIC]: ['Базовая поддержка', 'Личный кабинет', 'Ограниченные отчёты'],
      [SubscriptionPlan.PREMIUM]: [
        'Приоритетная поддержка',
        'Расширенная аналитика',
        'Экспорт данных',
      ],
      [SubscriptionPlan.ENTERPRISE]: ['SLA', 'Интеграции', 'Роли и доступы'],
    };
    return source.map((p, idx) => {
      const planKey =
        idx === 0
          ? SubscriptionPlan.BASIC
          : idx === 1
            ? SubscriptionPlan.PREMIUM
            : SubscriptionPlan.ENTERPRISE;
      return {
        key: planKey,
        title: p.name,
        description: p.description || 'Описание отсутствует',
        pricePerMonth: p.price,
        features: defaultFeaturesByPlan[planKey],
      };
    });
  }

  readonly isModalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedTariffPlan = signal<TariffPlan | null>(null);

  readonly modalTitle = computed(() =>
    this.modalMode() === 'create' ? 'Создать тарифный план' : 'Редактировать тарифный план',
  );

  ngOnInit(): void {
    this.loadTariffPlans();
  }

  loadTariffPlans(): void {
    this.error.set(null);
    this.tariffPlanService
      .getAll({ sortField: 'id', sortDirection: 'desc', take: 100 })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? 'Не удалось загрузить тарифные планы');
          return of([] as TariffPlan[]);
        }),
      )
      .subscribe((rows) => this.tariffPlans.set(rows));
  }

  openCreateModal(): void {
    this.modalMode.set('create');
    this.selectedTariffPlan.set(null);
    this.isModalOpen.set(true);
  }

  openEditModal(plan: TariffPlan): void {
    this.modalMode.set('edit');
    this.selectedTariffPlan.set(plan);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
  }

  handleSaved(event: PlanModalSavedEvent): void {
    this.isModalOpen.set(false);
    this.loadTariffPlans();
  }
}
