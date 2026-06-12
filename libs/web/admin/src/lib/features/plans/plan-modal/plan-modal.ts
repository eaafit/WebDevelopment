import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, EMPTY } from 'rxjs';
import { TariffPlanService, type TariffPlan } from '../../../../services/tariff-plan.service';
import { buildPlanDescription, splitPlanDescription } from '../plan-description';

export type PlanModalSavedEvent = { mode: 'create' | 'edit'; plan: TariffPlan };

const UI = {
  closeWindow: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u043e\u043a\u043d\u043e',
  createHint: '\u0421\u043e\u0437\u0434\u0430\u043d\u0438\u0435 \u043d\u043e\u0432\u043e\u0433\u043e \u043f\u043b\u0430\u043d\u0430',
  editHint:
    '\u0420\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044e\u0449\u0435\u0433\u043e \u043f\u043b\u0430\u043d\u0430',
  close: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
  name: '\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435',
  description: '\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435',
  pricePerMonth: '\u0426\u0435\u043d\u0430 (\u20bd/\u043c\u0435\u0441)',
  featuresPerLine:
    '\u0424\u0443\u043d\u043a\u0446\u0438\u0438 (\u043f\u043e \u043e\u0434\u043d\u043e\u0439 \u043d\u0430 \u0441\u0442\u0440\u043e\u043a\u0443)',
  validFrom: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0441',
  validTo: '\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u043f\u043e',
  active: '\u0410\u043a\u0442\u0438\u0432\u0435\u043d',
  cancel: '\u041e\u0442\u043c\u0435\u043d\u0430',
  save: '\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c',
  saving: '\u0421\u043e\u0445\u0440\u0430\u043d\u0435\u043d\u0438\u0435...',
  nameRequired:
    '\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u0430\u0440\u0438\u0444\u043d\u043e\u0433\u043e \u043f\u043b\u0430\u043d\u0430',
  nonNegativePrice:
    '\u0426\u0435\u043d\u0430 \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u043e\u0442\u0440\u0438\u0446\u0430\u0442\u0435\u043b\u044c\u043d\u043e\u0439',
  invalidDates:
    '\u0414\u0430\u0442\u0430 \u043e\u043a\u043e\u043d\u0447\u0430\u043d\u0438\u044f \u043d\u0435 \u043c\u043e\u0436\u0435\u0442 \u0431\u044b\u0442\u044c \u0440\u0430\u043d\u044c\u0448\u0435 \u0434\u0430\u0442\u044b \u043d\u0430\u0447\u0430\u043b\u0430',
  saveError:
    '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0441\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c \u0442\u0430\u0440\u0438\u0444\u043d\u044b\u0439 \u043f\u043b\u0430\u043d',
} as const;

@Component({
  selector: 'lib-plan-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './plan-modal.html',
  styleUrl: './plan-modal.scss',
})
export class PlanModalComponent implements OnInit {
  private readonly tariffPlanService = inject(TariffPlanService);

  readonly ui = UI;

  @Input({ required: true }) title!: string;
  @Input({ required: true }) mode!: 'create' | 'edit';
  @Input() plan: TariffPlan | null = null;

  @Output() closed = new EventEmitter<void>();
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
      const details = splitPlanDescription(this.plan.description);
      this.form = {
        name: this.plan.name,
        description: details.description,
        price: this.plan.price,
        featuresText: details.features.join('\n'),
        isActive: this.plan.isActive,
        validFrom: new Date(this.plan.validFrom).toISOString().split('T')[0],
        validTo: new Date(this.plan.validTo).toISOString().split('T')[0],
      };
    }
  }

  onClose(): void {
    this.closed.emit();
  }

  save(): void {
    if (!this.form.name.trim()) {
      this.error = this.ui.nameRequired;
      return;
    }

    if (this.form.price < 0) {
      this.error = this.ui.nonNegativePrice;
      return;
    }

    if (this.form.validFrom && this.form.validTo && this.form.validTo < this.form.validFrom) {
      this.error = this.ui.invalidDates;
      return;
    }

    this.saving = true;
    this.error = null;

    const payload = {
      name: this.form.name.trim(),
      price: this.form.price,
      description: buildPlanDescription(this.form.description, this.form.featuresText),
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
          this.error = err?.message ?? this.ui.saveError;
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
