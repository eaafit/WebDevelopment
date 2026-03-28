import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MOCK_PAYMENTS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHOD_OPTIONS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_TYPE_LABELS,
  PAYMENT_TYPE_OPTIONS,
  Payment,
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from './payments.shared';

@Component({
  selector: 'lib-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  mode: 'create' | 'edit' = 'create';
  paymentId: number | null = null;

  readonly form = this.fb.group({
    payer: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    fee: [0, [Validators.required, Validators.min(0)]],
    paymentDate: [new Date().toISOString().split('T')[0], [Validators.required]],
    type: ['Assessment' as PaymentType, [Validators.required]],
    paymentMethod: ['card' as PaymentMethod, [Validators.required]],
    status: ['pending' as PaymentStatus, [Validators.required]],
    subscriptionId: [''],
    assessmentId: [''],
    transactionId: [''],
    attachmentFileName: [''],
    attachmentFileUrl: [''],
  });

  constructor() {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.mode = idParam ? 'edit' : 'create';
    this.paymentId = idParam ? Number(idParam) : null;

    if (this.mode === 'edit' && this.paymentId) {
      const payment = MOCK_PAYMENTS.find((item) => item.id === this.paymentId);
      if (payment) {
        this.form.patchValue({
          payer: payment.payer,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          type: payment.type,
          paymentMethod: payment.paymentMethod ?? 'card',
          status: payment.status,
          subscriptionId: payment.subscriptionId ?? '',
          assessmentId: payment.assessmentId ?? '',
          transactionId: payment.transactionId ?? '',
          attachmentFileName: payment.attachmentFileName ?? '',
          attachmentFileUrl: payment.attachmentFileUrl ?? '',
        });
      }
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const data = this.form.getRawValue();
    if (this.mode === 'create') {
      const created: Payment = {
        id: Math.max(...MOCK_PAYMENTS.map((payment) => payment.id), 0) + 1,
        payer: data.payer ?? '',
        amount: Number(data.amount ?? 0),
        fee: Number(data.fee ?? 0),
        paymentDate: data.paymentDate ?? new Date().toISOString().split('T')[0],
        type: (data.type ?? 'Assessment') as PaymentType,
        paymentMethod: (data.paymentMethod ?? 'card') as PaymentMethod,
        status: 'pending',
        statusText: PAYMENT_STATUS_LABELS.pending,
        subscriptionId: data.subscriptionId || null,
        assessmentId: data.assessmentId || null,
        transactionId: data.transactionId || '',
        attachmentFileName: data.attachmentFileName || '',
        attachmentFileUrl: data.attachmentFileUrl || '',
      };
      MOCK_PAYMENTS.push(created);
    } else {
      // TODO: заменить mock-логику на реальный API после подключения backend
      const index = MOCK_PAYMENTS.findIndex((payment) => payment.id === this.paymentId);
      if (index !== -1) {
        MOCK_PAYMENTS[index] = {
          ...MOCK_PAYMENTS[index],
          payer: data.payer ?? '',
          amount: Number(data.amount ?? 0),
          fee: Number(data.fee ?? 0),
          paymentDate: data.paymentDate ?? MOCK_PAYMENTS[index].paymentDate,
          type: (data.type ?? MOCK_PAYMENTS[index].type) as PaymentType,
          paymentMethod: (data.paymentMethod ??
            MOCK_PAYMENTS[index].paymentMethod ??
            'card') as PaymentMethod,
          status: (data.status ?? MOCK_PAYMENTS[index].status) as PaymentStatus,
          statusText:
            PAYMENT_STATUS_LABELS[(data.status ?? MOCK_PAYMENTS[index].status) as PaymentStatus],
          subscriptionId: data.subscriptionId || null,
          assessmentId: data.assessmentId || null,
          transactionId: data.transactionId || '',
          attachmentFileName: data.attachmentFileName || '',
          attachmentFileUrl: data.attachmentFileUrl || '',
        };
      }
    }

    this.router.navigate(['/admin', 'payments']);
  }

  cancel(): void {
    this.router.navigate(['/admin', 'payments']);
  }

  get paymentTypes(): PaymentType[] {
    return PAYMENT_TYPE_OPTIONS;
  }

  get paymentMethods(): PaymentMethod[] {
    return PAYMENT_METHOD_OPTIONS;
  }

  get statuses(): PaymentStatus[] {
    return Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[];
  }

  getTypeLabel(type: PaymentType): string {
    return PAYMENT_TYPE_LABELS[type];
  }

  getMethodLabel(method: PaymentMethod): string {
    return PAYMENT_METHOD_LABELS[method];
  }

  getStatusLabel(status: PaymentStatus): string {
    return PAYMENT_STATUS_LABELS[status];
  }
}
