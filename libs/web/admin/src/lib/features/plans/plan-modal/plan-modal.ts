import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { TariffPlanService, type TariffPlan } from '../../../../services/tariff-plan.service';

export type PlanModalSavedEvent = { mode: 'create' | 'edit'; plan: TariffPlan };

@Component({
  selector: 'lib-plan-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-modal.html',
  styleUrl: './plan-modal.scss',
})
export class PlanModalComponent {
  private readonly tariffPlanService = inject(TariffPlanService);

  @Input({ required: true }) title!: string;
  @Input({ required: true }) mode!: 'create' | 'edit';
  @Input() plan: TariffPlan | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<PlanModalSavedEvent>();

  saving = false;
  error: string | null = null;

  form = {
    name: '',
    description: '',
    price: 0,
    featuresText: '',
    isActive: true,
    validFrom: new Date().toISOString().split('T')[0],
    validTo: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
  };

  ngOnInit(): void {
    if (this.mode === 'edit' && this.plan) {
      this.form = {
        name: this.plan.name,
        description: this.plan.description ?? '',
        price: this.plan.price,
        featuresText: '',
        isActive: this.plan.isActive,
        validFrom: new Date(this.plan.validFrom).toISOString().split('T')[0],
        validTo: new Date(this.plan.validTo).toISOString().split('T')[0],
      };
    }
  }

  onClose(): void {
    this.close.emit();
  }

  save(): void {
    this.saving = true;
    this.error = null;

    // NOTE: DB schema for TariffPlan doesn't have "features".
    const description =
      (this.form.description ?? '').trim() +
      (this.form.featuresText.trim() ? `\n\nFeatures:\n${this.form.featuresText.trim()}` : '');

    const payload = {
      name: this.form.name,
      price: this.form.price,
      description,
      isActive: this.form.isActive,
      validFrom: this.form.validFrom,
      validTo: this.form.validTo,
    };

    const request$ =
      this.mode === 'edit' && this.plan
        ? this.tariffPlanService.update(this.plan.id, payload)
        : this.tariffPlanService.create(payload);

    request$
      .pipe(
        catchError((err) => {
          this.error = err?.message ?? 'Не удалось сохранить тарифный план';
          this.saving = false;
          return EMPTY;
        }),
      )
      .subscribe((plan) => {
        this.saving = false;
        this.saved.emit({ mode: this.mode, plan: plan as TariffPlan });
      });
  }
}
