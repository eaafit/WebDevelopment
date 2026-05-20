import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentStatus as RpcPaymentStatus, PaymentType as RpcPaymentType } from '@notary-portal/api-contracts';
import { WebLoggerService } from '@notary-portal/ui';
import { Subscription } from 'rxjs';
import { AdminUserApiService, AdminUserRef } from '../RequestAssessment/services/user-api.service';
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
export class PaymentFormComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AdminPaymentsApiService);
  private readonly logger = inject(WebLoggerService);
  private userApi = inject(AdminUserApiService);
  private dataSub?: Subscription;

  allUsers: AdminUserRef[] = [];
  userSearchQuery = '';
  userDropdownOpen = false;

  mode: 'create' | 'edit' = 'create';
  paymentId: string | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  subscriptionIdOptions: string[] = [];
  assessmentIdOptions: string[] = [];
  transactionIdOptions: string[] = [];

  idInputMode: { subscriptionId: boolean; assessmentId: boolean; transactionId: boolean } = {
    subscriptionId: false,
    assessmentId: false,
    transactionId: false,
  };

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
    this.logInfo('payment.admin.form_opened', {
      mode: this.mode,
      paymentId: this.paymentId,
    });

    this.loadIdOptions();
    this.loadUsers();

    if (this.mode === 'edit' && this.paymentId) {
      this.loadPayment(this.paymentId);
    }

    this.form.get('type')?.valueChanges.subscribe((type) => {
      this.updateIdFieldRequirements(type as PaymentType);
    });
  }

  ngOnDestroy(): void {
    this.dataSub?.unsubscribe();
  }

  private async loadUsers(): Promise<void> {
    try {
      await this.userApi.loadUsers();
      this.allUsers = Array.from(this.userApi.usersById.values());
    } catch {
      this.allUsers = [];
    }
  }

  get filteredUsers(): AdminUserRef[] {
    const q = this.userSearchQuery.trim().toLowerCase();
    if (!q) return this.allUsers.slice(0, 50);
    return this.allUsers.filter(
      (u) =>
        u.id.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q),
    ).slice(0, 50);
  }

  onUserSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.userSearchQuery = input.value;
    this.userDropdownOpen = true;
  }

  selectUser(user: AdminUserRef): void {
    this.form.get('userId')?.setValue(user.id);
    this.userSearchQuery = user.fullName;
    this.userDropdownOpen = false;
  }

  onUserInputFocus(): void {
    this.userSearchQuery = '';
    this.userDropdownOpen = true;
  }

  onUserInputBlur(): void {
    setTimeout(() => { this.userDropdownOpen = false; }, 200);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-autocomplete')) {
      this.userDropdownOpen = false;
    }
  }

  private loadIdOptions(): void {
    this.api.preload();
    this.dataSub = this.api.payments$.subscribe((payments) => {
      if (payments) {
        this.subscriptionIdOptions = Array.from(
          new Set(payments.map((p) => p.subscriptionId).filter(Boolean)),
        ) as string[];
        this.assessmentIdOptions = Array.from(
          new Set(payments.map((p) => p.assessmentId).filter(Boolean)),
        ) as string[];
        this.transactionIdOptions = Array.from(
          new Set(payments.map((p) => p.transactionId).filter(Boolean)),
        ) as string[];
      }
    });
  }

  private updateIdFieldRequirements(type: PaymentType): void {
    const subControl = this.form.get('subscriptionId');
    const assessControl = this.form.get('assessmentId');

    if (type === 'Subscription') {
      subControl?.setValidators([Validators.required]);
      assessControl?.clearValidators();
    } else {
      assessControl?.setValidators([Validators.required]);
      subControl?.clearValidators();
    }

    subControl?.updateValueAndValidity({ onlySelf: true });
    assessControl?.updateValueAndValidity({ onlySelf: true });
  }

  toggleIdInputMode(field: keyof typeof this.idInputMode): void {
    this.idInputMode = {
      ...this.idInputMode,
      [field]: !this.idInputMode[field],
    };
  }

  private async loadPayment(id: string): Promise<void> {
    this.logInfo('payment.admin.form_load_started', { paymentId: id });
    this.loading = true;
    try {
      const payment = await this.api.getPaymentById(id);
      if (payment) {
        this.patchForm(payment);
        this.logInfo('payment.admin.form_load_succeeded', { paymentId: id });
      } else {
        this.logWarn('payment.admin.form_load_not_found', { paymentId: id });
        this.error = 'Платёж не найден';
      }
    } catch (err) {
      this.logError('payment.admin.form_load_failed', err, { paymentId: id });
      this.error = err instanceof Error ? err.message : 'Ошибка при загрузке платежа';
    } finally {
      this.loading = false;
    }
  }

  private patchForm(payment: Payment): void {
    const userId = payment.userId ?? '';
    if (userId) {
      const user = this.userApi.usersById.get(userId);
      this.userSearchQuery = user ? user.fullName : userId;
    }

    this.form.patchValue({
      userId: userId,
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

    if (payment.subscriptionId && !this.subscriptionIdOptions.includes(payment.subscriptionId)) {
      this.idInputMode = { ...this.idInputMode, subscriptionId: true };
    }
    if (payment.assessmentId && !this.assessmentIdOptions.includes(payment.assessmentId)) {
      this.idInputMode = { ...this.idInputMode, assessmentId: true };
    }
    if (payment.transactionId && !this.transactionIdOptions.includes(payment.transactionId)) {
      this.idInputMode = { ...this.idInputMode, transactionId: true };
    }

    this.updateIdFieldRequirements(payment.type);
    this.loading = false;
  }

  async submit(): Promise<void> {
    this.updateIdFieldRequirements(this.form.get('type')?.value as PaymentType);

    if (this.form.invalid) {
      this.logWarn('payment.admin.form_submit_blocked_invalid', {
        mode: this.mode,
      });
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = null;
    const data = this.form.getRawValue();
    this.logInfo('payment.admin.form_submit_started', {
      mode: this.mode,
      paymentId: this.paymentId,
      paymentType: data.type,
      status: data.status,
    });

    if (this.mode === 'create') {
      try {
        const targetId = this.resolveTargetId(data);
        if (!targetId) {
          this.error = this.getTargetIdErrorMessage(data.type as PaymentType);
          this.logWarn('payment.admin.form_create_no_target', {
            paymentType: data.type,
          });
          this.loading = false;
          return;
        }
        this.logInfo('payment.admin.form_create_requested', {
          targetId,
          paymentType: data.type,
        });
        await this.api.createPayment({
          userId: data.userId ?? '',
          amount: String(data.amount ?? 0),
          type: this.toRpcPaymentType(data.type as PaymentType),
          targetId,
        });
        this.successMessage = 'Платёж успешно создан';
        this.logInfo('payment.admin.form_create_succeeded');
        this.router.navigate(['/admin', 'payments']);
      } catch (err) {
        this.logError('payment.admin.form_create_failed', err);
        this.error = err instanceof Error ? err.message : 'Ошибка при создании платежа';
        this.loading = false;
      }
    } else {
      try {
        this.logInfo('payment.admin.form_update_requested', {
          paymentId: this.paymentId,
        });
        const paymentId = this.paymentId;
        if (!paymentId) return;
        await this.api.updatePayment({
          id: paymentId,
          amount: String(data.amount ?? 0),
          status: this.toRpcPaymentStatus(data.status as PaymentStatus),
          paymentMethod: data.paymentMethod ?? undefined,
          transactionId: data.transactionId ?? undefined,
          attachmentFileName: data.attachmentFileName ?? undefined,
          attachmentFileUrl: data.attachmentFileUrl ?? undefined,
        });
        this.successMessage = 'Платёж обновлён';
        this.logInfo('payment.admin.form_update_succeeded', {
          paymentId: this.paymentId,
        });
        this.router.navigate(['/admin', 'payments']);
      } catch (err) {
        this.logError('payment.admin.form_update_failed', err, {
          paymentId: this.paymentId,
        });
        this.error = err instanceof Error ? err.message : 'Ошибка при обновлении платежа';
        this.loading = false;
      }
    }
  }

  cancel(): void {
    this.logInfo('payment.admin.form_cancelled', {
      mode: this.mode,
      paymentId: this.paymentId,
    });
    this.router.navigate(['/admin', 'payments']);
  }

  private logInfo(event: string, context: Record<string, unknown> = {}): void {
    this.logger.info(event, this.buildLogContext(context));
  }

  private logWarn(event: string, context: Record<string, unknown> = {}): void {
    this.logger.warn(event, this.buildLogContext(context));
  }

  private logError(event: string, error: unknown, context: Record<string, unknown> = {}): void {
    this.logger.error(event, this.buildLogContext({ ...context, error }));
  }

  private buildLogContext(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      area: 'admin_payments_form',
      route: '/admin/payments/:id',
      mode: this.mode,
      paymentId: this.paymentId,
      ...extra,
    };
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

  private getTargetIdErrorMessage(type: PaymentType): string {
    switch (type) {
      case 'Subscription':
        return 'Для типа «Подписка» необходимо указать ID подписки';
      case 'Assessment':
        return 'Для типа «Оценка» необходимо указать ID заявки';
      case 'DocumentCopy':
        return 'Для типа «Копия документа» необходимо указать ID заявки';
      default:
        return 'Необходимо указать связанный объект (ID подписки или заявки)';
    }
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
