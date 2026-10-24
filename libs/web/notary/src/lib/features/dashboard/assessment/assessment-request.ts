import {
  EVALUATION_MODEL_LABELS,
  EVALUATION_URGENCY_LABELS,
  evaluationQuote,
} from '@notary-portal/api-contracts';
import { CommonModule } from '@angular/common';
import { Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { EvaluationParameters, WorkspaceAssessment } from '@notary-portal/api-contracts';
import { AssessmentReadApiService } from './assessment-read-api.service';

@Component({
  selector: 'lib-assessment-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './assessment-request.html',
  styleUrl: './assessment-request.scss',
})
export class AssessmentRequest {
  private readonly api = inject(AssessmentReadApiService);
  readonly item = input.required<WorkspaceAssessment>();
  readonly saved = output<WorkspaceAssessment>();
  readonly cancelled = output<void>();
  readonly working = output<boolean>();
  readonly confirmation = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  parameters: EvaluationParameters = { model: 'standard', urgency: 'standard', comment: '' };
  confirmed = false;
  get price() {
    return evaluationQuote(this.parameters).price;
  }
  get modelLabel() {
    return EVALUATION_MODEL_LABELS[this.parameters.model];
  }
  get urgencyLabel() {
    return EVALUATION_URGENCY_LABELS[this.parameters.urgency];
  }
  get days() {
    return evaluationQuote(this.parameters).days;
  }
  get money() {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(this.price);
  }
  confirm() {
    if (this.parameters.comment.length <= 1000 && !this.item().order) {
      this.confirmed = false;
      this.confirmation.set(true);
    }
  }
  back() {
    this.confirmed = false;
    this.confirmation.set(false);
  }
  async submit() {
    if (!this.confirmation() || !this.confirmed || this.busy() || this.item().order) return;
    this.busy.set(true);
    this.working.emit(true);
    this.error.set('');
    try {
      this.saved.emit(await this.api.submit(this.item().id, this.parameters));
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Не удалось создать заказ');
    } finally {
      this.busy.set(false);
      this.working.emit(false);
    }
  }
}
