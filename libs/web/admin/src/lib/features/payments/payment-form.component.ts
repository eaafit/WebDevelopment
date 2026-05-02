import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentStatus as RpcPaymentStatus, PaymentType as RpcPaymentType } from '@notary-portal/api-contracts';
import {
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
import { AdminPaymentsApiService } from './payments-api.service';

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR'] as const;
type Currency = (typeof CURRENCY_OPTIONS)[number];

@Component({
  selector: 'lib-payment-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './payment-form.component.html',
  styleUrl: './payment-form.component.scss',
})
export class PaymentFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AdminPaymentsApiService);

  mode: 'create' | 'edit' = 'create';
  paymentId: string | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  readonly form = this.fb.group({
    userId: ['', [Validators.required]],
    payer: ['', [Validators.required, Validators.maxLength(200)]],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    currency: ['RUB' as Currency, [Validators.required]],
    fee: [0, [Validators.required, Validators.min(0)]],
    paymentDate: [new Date().toISOString().split('T')[0], [Validators.required]],
    type: ['Assessment' as PaymentType, [Validators.required]],
    paymentMethod: ['card' as PaymentMethod, [Validators.required]],
    status: ['pending' as PaymentStatus, [Validators.required]],
    description: [''],
    subscriptionId: [''],
    assessmentId: [''],
    transactionId: [''],
    attachmentFileName: [''],
    attachmentFileUrl: [''],
  });

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.mode = idParam ? 'edit' : 'create';
    this.paymentId = idParam;

    if (this.mode === 'edit' && this.paymentId) {
      this.form.get('userId')?.disable();
      this.loadPayment(this.paymentId);
    }
  }

  private async loadPayment(id: string): Promise<void> {
    this.loading = true;
    try {
      const payment = await this.api.getPaymentById(id);
      if (payment) {
        this.patchForm(payment);
      } else {
        this.error = 'Платёж не найден';
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Ошибка при загрузке платежа';
    } finally {
      this.loading = false;
    }
  }

  private patchForm(payment: Payment): void {
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
    this.loading = false;
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;
    const data = this.form.getRawValue();

    if (this.mode === 'create') {
      try {
        const targetId = this.resolveTargetId(data);
        await this.api.createPayment({
          userId: data.userId ?? '',
          amount: String(data.amount ?? 0),
          type: this.toRpcPaymentType(data.type as PaymentType),
          targetId: targetId || (data.userId ?? ''),
        });
        this.successMessage = 'Платёж успешно создан';
        this.router.navigate(['/admin', 'payments']);
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Ошибка при создании платежа';
        this.loading = false;
      }
    } else {
      try {
        await this.api.updatePayment({
          id: this.paymentId!,
          amount: String(data.amount ?? 0),
          status: this.toRpcPaymentStatus(data.status as PaymentStatus),
          paymentMethod: data.paymentMethod ?? undefined,
          transactionId: data.transactionId ?? undefined,
          attachmentFileName: data.attachmentFileName ?? undefined,
          attachmentFileUrl: data.attachmentFileUrl ?? undefined,
        });
        this.successMessage = 'Платёж обновлён';
        this.router.navigate(['/admin', 'payments']);
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Ошибка при обновлении платежа';
        this.loading = false;
      }
    }
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

  get currencies(): Currency[] {
    return [...CURRENCY_OPTIONS];
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

  private resolveTargetId(data: ReturnType<typeof this.form.getRawValue>): string {
    switch (data.type) {
      case 'Subscription':
        return data.subscriptionId ?? '';
      case 'Assessment':
      case 'DocumentCopy':
      default:
        return data.assessmentId ?? '';
    }
  }

  private toRpcPaymentStatus(status: PaymentStatus): RpcPaymentStatus {
    switch (status) {
      case 'completed':
        return RpcPaymentStatus.COMPLETED;
      case 'failed':
        return RpcPaymentStatus.FAILED;
      case 'refunded':
        return RpcPaymentStatus.REFUNDED;
      case 'pending':
      default:
        return RpcPaymentStatus.PENDING;
    }
  }

  private toRpcPaymentType(type: PaymentType): RpcPaymentType {
    switch (type) {
      case 'Subscription':
        return RpcPaymentType.SUBSCRIPTION;
      case 'DocumentCopy':
        return RpcPaymentType.DOCUMENT_COPY;
      case 'Assessment':
      default:
        return RpcPaymentType.ASSESSMENT;
    }
  }
}
