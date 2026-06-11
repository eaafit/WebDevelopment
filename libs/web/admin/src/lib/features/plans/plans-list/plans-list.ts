import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SubscriptionPlan } from '@notary-portal/api-contracts';
import { catchError, of } from 'rxjs';
import { PlanModalComponent } from '../plan-modal/plan-modal';
import { TariffPlanService, type TariffPlan } from '../../../../services/tariff-plan.service';

@Component({
  selector: 'lib-plans-list',
  standalone: true,
  imports: [CommonModule, FormsModule, PlanModalComponent],
  templateUrl: './plans-list.html',
  styleUrl: './plans-list.scss',
})
export class PlansListComponent implements OnInit {
  private readonly tariffPlanService = inject(TariffPlanService);

  readonly tariffPlans = signal<TariffPlan[]>([]);
  readonly error = signal<string | null>(null);

  readonly plans = computed(() => {
    const source = this.tariffPlans().slice(0, 3);
    const defaultFeaturesByPlan: Record<SubscriptionPlan, string[]> = {
      [SubscriptionPlan.UNSPECIFIED]: ['Р‘Р°Р·РѕРІС‹Рµ С„СѓРЅРєС†РёРё'],
      [SubscriptionPlan.BASIC]: [
        'Р‘Р°Р·РѕРІР°СЏ РїРѕРґРґРµСЂР¶РєР°',
        'Р›РёС‡РЅС‹Р№ РєР°Р±РёРЅРµС‚',
        'РћРіСЂР°РЅРёС‡РµРЅРЅС‹Рµ РѕС‚С‡С‘С‚С‹',
      ],
      [SubscriptionPlan.PREMIUM]: [
        'РџСЂРёРѕСЂРёС‚РµС‚РЅР°СЏ РїРѕРґРґРµСЂР¶РєР°',
        'Р Р°СЃС€РёСЂРµРЅРЅР°СЏ Р°РЅР°Р»РёС‚РёРєР°',
        'Р­РєСЃРїРѕСЂС‚ РґР°РЅРЅС‹С…',
      ],
      [SubscriptionPlan.ENTERPRISE]: ['SLA', 'РРЅС‚РµРіСЂР°С†РёРё', 'Р РѕР»Рё Рё РґРѕСЃС‚СѓРїС‹'],
    };

    return source.map((plan, idx) => {
      const planKey =
        idx === 0
          ? SubscriptionPlan.BASIC
          : idx === 1
            ? SubscriptionPlan.PREMIUM
            : SubscriptionPlan.ENTERPRISE;

      return {
        key: planKey,
        title: plan.name,
        description: plan.description || 'РћРїРёСЃР°РЅРёРµ РѕС‚СЃСѓС‚СЃС‚РІСѓРµС‚',
        pricePerMonth: plan.price,
        features: defaultFeaturesByPlan[planKey],
      };
    });
  });

  readonly isModalOpen = signal(false);
  readonly modalMode = signal<'create' | 'edit'>('create');
  readonly selectedTariffPlan = signal<TariffPlan | null>(null);

  readonly modalTitle = computed(() =>
    this.modalMode() === 'create'
      ? 'РЎРѕР·РґР°С‚СЊ С‚Р°СЂРёС„РЅС‹Р№ РїР»Р°РЅ'
      : 'Р РµРґР°РєС‚РёСЂРѕРІР°С‚СЊ С‚Р°СЂРёС„РЅС‹Р№ РїР»Р°РЅ',
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
          this.error.set(err?.message ?? 'РќРµ СѓРґР°Р»РѕСЃСЊ Р·Р°РіСЂСѓР·РёС‚СЊ С‚Р°СЂРёС„РЅС‹Рµ РїР»Р°РЅС‹');
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
