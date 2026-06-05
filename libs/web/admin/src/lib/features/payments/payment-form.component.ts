import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentStatus as RpcPaymentStatus, PaymentType as RpcPaymentType } from '@notary-portal/api-contracts';
import { WebLoggerService } from '@notary-portal/ui';
import { Subscription } from 'rxjs';
import { AdminAssessmentApiService, type AdminAssessmentRow } from '../RequestAssessment/services/assessment-api.service';
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
import { AdminPaymentsApiService } from '../../api/admin-payments-api.service';

const CURRENCY_OPTIONS = ['RUB', 'USD', 'EUR'] as const;
type Currency = (typeof CURRENCY_OPTIONS)[number];
type PaymentSelectControl =
  | 'type'
  | 'status'
  | 'currency'
  | 'paymentMethod'
  | 'subscriptionId'
  | 'assessmentId'
  | 'transactionId';

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
  private assessmentApi = inject(AdminAssessmentApiService);
  private dataSub?: Subscription;

  allUsers: AdminUserRef[] = [];
  userSearchQuery = '';
  userDropdownOpen = false;
  activeSelectKey: PaymentSelectControl | null = null;

  mode: 'create' | 'edit' = 'create';
  paymentId: string | null = null;
  loading = false;
  error: string | null = null;
  successMessage: string | null = null;

  subscriptionIdOptions: string[] = [];
  assessmentIdOptions: string[] = [];
  assessmentOptions: AdminAssessmentRow[] = [];
  transactionIdOptions: string[] = [];
  private readonly paymentBySubscriptionId = new Map<string, Payment>();
  private readonly paymentByTransactionId = new Map<string, Payment>();

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
    this.loadPaymentLookupOptions();
    this.loadUsers();
    this.loadAssessmentOptions();

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

  private async loadAssessmentOptions(): Promise<void> {
    try {
      const page = await this.assessmentApi.listAssessments({ page: 1, limit: 200 });
      this.assessmentOptions = page.items;
      this.assessmentIdOptions = this.mergeIdOptions(
        this.assessmentIdOptions,
        page.items.map((assessment) => assessment.id),
      );
    } catch (err) {
      this.logWarn('payment.admin.form_assessment_options_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      this.assessmentOptions = [];
    }
  }

  private async loadPaymentLookupOptions(): Promise<void> {
    try {
      const payments = await this.api.getAllPayments();
      this.applyPaymentLookupOptions(payments);
    } catch (err) {
      this.logWarn('payment.admin.form_payment_lookup_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
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
    if (!target.closest('.custom-select-container')) {
      this.activeSelectKey = null;
    }
  }

  private loadIdOptions(): void {
    this.api.preload();
    this.dataSub = this.api.payments$.subscribe((payments) => {
      if (payments) {
        this.applyPaymentLookupOptions(payments);
      }
    });
  }

  private applyPaymentLookupOptions(payments: Payment[]): void {
    for (const payment of payments) {
      if (payment.subscriptionId) {
        this.paymentBySubscriptionId.set(
          payment.subscriptionId,
          this.pickMostRecentPayment(this.paymentBySubscriptionId.get(payment.subscriptionId), payment),
        );
      }

      if (payment.transactionId) {
        this.paymentByTransactionId.set(
          payment.transactionId,
          this.pickMostRecentPayment(this.paymentByTransactionId.get(payment.transactionId), payment),
        );
      }
    }

    this.subscriptionIdOptions = this.mergeIdOptions(
      this.subscriptionIdOptions,
      payments.map((payment) => payment.subscriptionId).filter(Boolean) as string[],
    );
    this.assessmentIdOptions = this.mergeIdOptions(
      this.assessmentIdOptions,
      payments.map((payment) => payment.assessmentId).filter(Boolean) as string[],
    );
    this.transactionIdOptions = this.mergeIdOptions(
      this.transactionIdOptions,
      payments.map((payment) => payment.transactionId).filter(Boolean) as string[],
    );
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
    this.activeSelectKey = null;
  }

  toggleSelect(key: PaymentSelectControl, event: MouseEvent): void {
    event.stopPropagation();
    this.activeSelectKey = this.activeSelectKey === key ? null : key;
  }

  selectFormValue(key: PaymentSelectControl, value: string, event: MouseEvent): void {
    event.stopPropagation();
    this.form.get(key)?.setValue(value);
    this.form.get(key)?.markAsDirty();
    this.form.get(key)?.markAsTouched();
    this.activeSelectKey = null;
  }

  isSelectOpen(key: PaymentSelectControl): boolean {
    return this.activeSelectKey === key;
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
      currency: (payment.currency as Currency) || 'RUB',
      paymentDate: toDateInputValue(payment.paymentDate),
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

  formatSubscriptionOption(id: string): string {
    return this.formatPaymentBackedOption('Подписка', id, this.paymentBySubscriptionId.get(id));
  }

  formatAssessmentOption(id: string): string {
    const assessment = this.assessmentOptions.find((item) => item.id === id);
    if (!assessment) {
      return `Заявка ${this.compactIdentifier(id)}`;
    }

    const label = assessment.address.trim() || assessment.description.trim();
    if (!label) {
      return `Заявка ${this.compactIdentifier(id)}`;
    }

    return `${this.compactIdentifier(id)} - ${label}`;
  }

  formatTransactionOption(id: string): string {
    return this.formatPaymentBackedOption('Транзакция', id, this.paymentByTransactionId.get(id));
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

  private compactIdentifier(id: string): string {
    const normalized = id.trim();
    if (normalized.length <= 18) {
      return normalized;
    }

    return `${normalized.slice(0, 8)}...${normalized.slice(-6)}`;
  }

  private mergeIdOptions(current: string[], next: string[]): string[] {
    return Array.from(new Set([...current, ...next].filter(Boolean)));
  }

  private pickMostRecentPayment(current: Payment | undefined, next: Payment): Payment {
    if (!current) {
      return next;
    }

    const currentTime = Date.parse(current.paymentDate);
    const nextTime = Date.parse(next.paymentDate);
    if (Number.isNaN(currentTime)) {
      return next;
    }
    if (Number.isNaN(nextTime)) {
      return current;
    }

    return nextTime >= currentTime ? next : current;
  }

  private formatPaymentBackedOption(prefix: string, id: string, payment: Payment | undefined): string {
    if (!payment) {
      return `${prefix} ${this.compactIdentifier(id)}`;
    }

    const amount = this.formatPaymentAmount(payment);
    const status = PAYMENT_STATUS_LABELS[payment.status] ?? payment.status;
    const date = toDateInputValue(payment.paymentDate);

    return `${prefix} ${this.compactIdentifier(id)} - ${amount} - ${status} - ${date}`;
  }

  private formatPaymentAmount(payment: Payment): string {
    const amount = new Intl.NumberFormat('ru-RU', {
      maximumFractionDigits: 2,
      minimumFractionDigits: Number.isInteger(payment.amount) ? 0 : 2,
    }).format(payment.amount);

    return `${amount} ${payment.currency || 'RUB'}`;
  }
}

function toDateInputValue(value: string): string {
  if (!value) {
    return new Date().toISOString().split('T')[0];
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}
