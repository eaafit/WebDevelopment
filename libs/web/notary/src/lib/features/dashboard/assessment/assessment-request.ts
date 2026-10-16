import { CommonModule } from '@angular/common';
import { Component, input, output, signal, OnDestroy } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import type { AssessmentItem } from './assessment';

@Component({
  selector: 'lib-assessment-request',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './assessment-request.html',
  styleUrl: './assessment-request.scss',
})
export class AssessmentRequest implements OnDestroy {
  readonly item = input.required<AssessmentItem>();
  readonly closeRequest = output<void>();
  readonly step = signal<'parameters' | 'confirmation' | 'progress'>('parameters');
  readonly stage = signal(0);
  readonly dates = signal<string[]>([]);
  readonly stages = ['Получена', 'В очереди', 'Обрабатывается', 'Завершена'];
  readonly message = signal('');
  readonly models = [
    { id: 'standard', name: 'Стандартная оценка', price: 3000, days: 5 },
    { id: 'extended', name: 'Расширенная оценка', price: 5000, days: 7 },
  ];
  readonly form = new FormGroup({
    model: new FormControl('standard', { nonNullable: true, validators: Validators.required }),
    urgency: new FormControl('standard', { nonNullable: true, validators: Validators.required }),
    comment: new FormControl('', { nonNullable: true, validators: Validators.maxLength(1000) }),
    confirmed: new FormControl(false, { nonNullable: true, validators: Validators.requiredTrue }),
  });
  private timer?: ReturnType<typeof setInterval>;

  get model() {
    return (
      this.models.find((model) => model.id === this.form.controls.model.value) ?? this.models[0]
    );
  }
  get price(): number {
    return this.model.price * (this.form.controls.urgency.value === 'urgent' ? 1.5 : 1);
  }
  get days(): number {
    return this.form.controls.urgency.value === 'urgent' ? 2 : this.model.days;
  }
  get unavailable(): boolean {
    return ['Completed', 'Cancelled', 'Unknown'].includes(this.item().assessment.status);
  }
  confirm(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.unavailable) return;
    this.step.set('confirmation');
  }
  back(): void {
    this.step.set('parameters');
    this.form.controls.confirmed.setValue(false);
  }
  submit(): void {
    if (this.step() !== 'confirmation' || this.form.invalid || this.unavailable) return;
    this.step.set('progress');
    this.stage.set(0);
    this.dates.set([new Date().toLocaleString('ru-RU')]);
    this.message.set('Демонстрация: запрос принят. Данные на сервер не отправлялись.');
    this.timer = setInterval(() => {
      this.stage.update((stage) => stage + 1);
      this.dates.update((dates) => [...dates, new Date().toLocaleString('ru-RU')]);
      this.message.set('Демонстрация: ' + this.stages[this.stage()]);
      if (this.stage() === this.stages.length - 1) clearInterval(this.timer);
    }, 3000);
  }
  ngOnDestroy(): void {
    clearInterval(this.timer);
  }
}
