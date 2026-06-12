import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { TariffPlanService, type TariffPlan } from '../../../../services/tariff-plan.service';
import { PlanModalComponent } from '../plan-modal/plan-modal';
import { splitPlanDescription } from '../plan-description';

interface TariffPlanCardView {
  id: number;
  title: string;
  description: string;
  features: string[];
  pricePerMonth: number;
  isActive: boolean;
}

const UI = {
  eyebrow:
    '\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442 \u0430\u0434\u043c\u0438\u043d\u0438\u0441\u0442\u0440\u0430\u0442\u043e\u0440\u0430 / \u0422\u0430\u0440\u0438\u0444\u043d\u044b\u0435 \u043f\u043b\u0430\u043d\u044b',
  heading: '\u0423\u043f\u0440\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u043c\u0438 \u043f\u043b\u0430\u043d\u0430\u043c\u0438',
  lead:
    '\u041f\u0440\u043e\u0441\u043c\u043e\u0442\u0440 \u0430\u043a\u0442\u0438\u0432\u043d\u044b\u0445 \u043f\u043b\u0430\u043d\u043e\u0432, \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u043e\u0432 \u0438 \u0441\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043d\u043e\u0432\u044b\u0445 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439.',
  addPlan: '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043b\u0430\u043d',
  cardsTitle: '\u041a\u0430\u0440\u0442\u043e\u0447\u043a\u0438 \u043f\u043b\u0430\u043d\u043e\u0432',
  cardsLead:
    '\u041a\u0440\u0430\u0442\u043a\u0438\u0439 \u043e\u0431\u0437\u043e\u0440 \u043e\u0441\u043d\u043e\u0432\u043d\u044b\u0445 \u043f\u0440\u0435\u0434\u043b\u043e\u0436\u0435\u043d\u0438\u0439 \u043f\u043e \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0430\u043c.',
  shown: '\u041f\u043e\u043a\u0430\u0437\u0430\u043d\u043e',
  perMonthShort: '\u043c\u0435\u0441',
  listTitle: '\u0421\u043f\u0438\u0441\u043e\u043a \u0442\u0430\u0440\u0438\u0444\u043e\u0432',
  listLead:
    '\u0414\u0430\u043d\u043d\u044b\u0435 \u0438\u0437 \u0431\u0430\u0437\u044b \u0441 \u0431\u044b\u0441\u0442\u0440\u044b\u043c \u043f\u0435\u0440\u0435\u0445\u043e\u0434\u043e\u043c \u043a \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u044e.',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  price: '\u0426\u0435\u043d\u0430',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
  period: '\u041f\u0435\u0440\u0438\u043e\u0434',
  actions: '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044f',
  noDescription: '\u0411\u0435\u0437 \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u044f',
  yes: '\u0414\u0430',
  no: '\u041d\u0435\u0442',
  edit: '\u0418\u0437\u043c\u0435\u043d\u0438\u0442\u044c',
  emptyState:
    '\u041f\u043e\u043a\u0430 \u043d\u0435\u0442 \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u0445 \u043f\u043b\u0430\u043d\u043e\u0432. \u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u043b\u0430\u043d\u00bb.',
  ruble: '\u20bd',
  createTitle: '\u0421\u043e\u0437\u0434\u0430\u0442\u044c \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u0439 \u043f\u043b\u0430\u043d',
  editTitle: '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u0442\u044c \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u0439 \u043f\u043b\u0430\u043d',
  loadError:
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u0435 \u043f\u043b\u0430\u043d\u044b',
  defaultDescription:
    '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u043d\u0435 \u0443\u043a\u0430\u0437\u0430\u043d\u043e',
} as const;

@Component({
  selector: 'lib-plans-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanModalComponent],
  templateUrl: './plans-list.html',
  styleUrl: './plans-list.scss',
})
export class PlansListComponent implements OnInit {
  private readonly tariffPlanService = inject(TariffPlanService);

  readonly ui = UI;
  readonly splitPlanDescription = splitPlanDescription;

  readonly tariffPlans = signal<TariffPlan[]>([]);
  readonly error = signal<string | null>(null);

  readonly plans = computed<TariffPlanCardView[]>(() =>
    this.tariffPlans().map((plan) => {
      const details = splitPlanDescription(plan.description);
      return {
        id: plan.id,
        title: plan.name,
        description: details.description || this.ui.defaultDescription,
        features: details.features.length > 0 ? details.features : buildFallbackFeatures(plan.name),
        pricePerMonth: plan.price,
        isActive: plan.isActive,
      };
    }),
  );

  readonly isModalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedTariffPlan = signal<TariffPlan | null>(null);

  readonly modalTitle = computed(() =>
    this.modalMode() === 'create' ? this.ui.createTitle : this.ui.editTitle,
  );

  ngOnInit(): void {
    this.loadTariffPlans();
  }

  loadTariffPlans(): void {
    this.error.set(null);
    this.tariffPlanService
      .getAll({ sortField: 'id', sortDirection: 'desc', limit: 100 })
      .pipe(
        catchError((err) => {
          this.error.set(err?.message ?? this.ui.loadError);
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

  handleSaved(): void {
    this.isModalOpen.set(false);
    this.loadTariffPlans();
  }
}

function buildFallbackFeatures(planName: string): string[] {
  const normalized = planName.toLowerCase();

  if (normalized.includes('basic') || normalized.includes('\u0431\u0430\u0437') || normalized.includes('start')) {
    return [
      '\u041b\u0438\u0447\u043d\u044b\u0439 \u043a\u0430\u0431\u0438\u043d\u0435\u0442',
      '\u0411\u0430\u0437\u043e\u0432\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430',
      '\u0421\u0442\u0430\u043d\u0434\u0430\u0440\u0442\u043d\u044b\u0439 \u0434\u043e\u0441\u0442\u0443\u043f',
    ];
  }

  if (normalized.includes('premium') || normalized.includes('pro') || normalized.includes('\u043f\u0440\u0435\u043c')) {
    return [
      '\u041f\u0440\u0438\u043e\u0440\u0438\u0442\u0435\u0442\u043d\u0430\u044f \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0430',
      '\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043d\u043d\u0430\u044f \u0430\u043d\u0430\u043b\u0438\u0442\u0438\u043a\u0430',
      '\u042d\u043a\u0441\u043f\u043e\u0440\u0442 \u0434\u0430\u043d\u043d\u044b\u0445',
    ];
  }

  if (
    normalized.includes('enterprise') ||
    normalized.includes('\u043a\u043e\u0440\u043f') ||
    normalized.includes('biz')
  ) {
    return ['SLA', '\u0418\u043d\u0442\u0435\u0433\u0440\u0430\u0446\u0438\u0438', '\u0413\u0438\u0431\u043a\u0438\u0435 \u0440\u043e\u043b\u0438 \u0434\u043e\u0441\u0442\u0443\u043f\u0430'];
  }

  return [
    '\u0410\u043a\u0442\u0438\u0432\u043d\u044b\u0439 \u043f\u043b\u0430\u043d \u043f\u043e\u0434\u043f\u0438\u0441\u043a\u0438',
    '\u0414\u043e\u0441\u0442\u0443\u043f \u043a \u0441\u0435\u0440\u0432\u0438\u0441\u0443',
    '\u041d\u0430\u0441\u0442\u0440\u0430\u0438\u0432\u0430\u0435\u043c\u044b\u0435 \u043f\u0430\u0440\u0430\u043c\u0435\u0442\u0440\u044b',
  ];
}
