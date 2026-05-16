import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangeDetectorRef, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TokenStore, WebLoggerService } from '@notary-portal/ui';
import {
  formatPrice,
  resolveSubscriptionPlan,
  SUBSCRIPTION_PLANS,
  type SubscriptionPlanCode,
  type SubscriptionPlanViewModel,
} from './subscription-checkout.models';
import {
  type CheckoutPromoValidationStatus,
  SubscriptionCheckoutApiService,
  type CheckoutPaymentStatus,
} from './subscription-checkout-api.service';
import { YooKassaWidgetService, type YooKassaWidgetSession } from './yookassa-widget.service';

type CheckoutState = 'ready' | 'widget' | 'processing' | 'success' | 'cancelled' | 'error';

@Component({
  selector: 'lib-checkout',
  imports: [RouterLink, FormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout implements OnDestroy {
  protected readonly plans = SUBSCRIPTION_PLANS;
  protected readonly formatPrice = formatPrice;
  protected readonly state = signal<CheckoutState>('ready');
  protected readonly loading = signal(false);
  protected readonly promoLoading = signal(false);
  protected readonly promoInput = signal('');
  protected readonly appliedPromoCode = signal('');
  protected readonly promoFeedback = signal('');
  protected readonly promoFeedbackTone = signal<'success' | 'error' | null>(null);
  protected readonly promoPreviewAmount = signal<string | null>(null);
  protected readonly promoDiscountAmount = signal<string | null>(null);
  protected readonly notice = signal('');
  protected readonly errorTitle = signal('Не получилось продолжить оплату');
  protected readonly errorMessage = signal('');
  protected readonly paymentId = signal<string | null>(null);
  protected readonly selectedPlanCode = signal<SubscriptionPlanCode>(
    resolvePlanCode(inject(ActivatedRoute).snapshot.queryParamMap.get('plan')),
  );
  protected readonly confirmedAmount = signal<string | null>(null);

  protected readonly selectedPlan = computed<SubscriptionPlanViewModel>(() =>
    resolveSubscriptionPlan(this.selectedPlanCode()),
  );
  protected readonly displayAmount = computed(
    () => this.confirmedAmount() ?? this.promoPreviewAmount() ?? this.selectedPlan().price,
  );
  protected readonly displayAmountLabel = computed(() => formatPrice(this.displayAmount()));
  protected readonly isBusy = computed(
    () =>
      this.loading() ||
      this.promoLoading() ||
      this.state() === 'widget' ||
      this.state() === 'processing',
  );
  protected readonly hasPendingPromoChanges = computed(() => {
    const draftCode = normalizePromoCode(this.promoInput());
    if (!draftCode) {
      return false;
    }

    return draftCode !== normalizePromoCode(this.appliedPromoCode());
  });

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly tokenStore = inject(TokenStore);
  private readonly checkoutApi = inject(SubscriptionCheckoutApiService);
  private readonly widgetService = inject(YooKassaWidgetService);
  private readonly logger = inject(WebLoggerService);

  private widgetSession: YooKassaWidgetSession | null = null;
  private widgetResultHandled = false;

  constructor() {
    this.logInfo('payment.checkout.notary.page_opened', {
      routePath: this.route.snapshot.routeConfig?.path ?? '',
    });
    this.resumeFromFallbackRoute();
  }

  protected selectPlan(code: SubscriptionPlanCode): void {
    if (code === this.selectedPlanCode() || this.isBusy()) {
      return;
    }

    this.logInfo('payment.checkout.notary.plan_selected', {
      previousPlanCode: this.selectedPlanCode(),
      nextPlanCode: code,
    });
    this.selectedPlanCode.set(code);
    this.confirmedAmount.set(null);
    this.notice.set('');
    this.errorTitle.set('Не получилось продолжить оплату');
    this.errorMessage.set('');
    this.state.set('ready');
    this.paymentId.set(null);
    this.destroyWidget();
    this.clearAppliedPromoState();
    this.clearPromoFeedback();
  }

  protected updatePromoInput(value: string): void {
    this.promoInput.set(value);
    this.errorMessage.set('');

    if (normalizePromoCode(value) !== normalizePromoCode(this.appliedPromoCode())) {
      if (this.appliedPromoCode()) {
        this.logInfo('payment.checkout.notary.promo_changed_after_apply');
      }
      this.clearAppliedPromoState();
    }

    this.clearPromoFeedback();
  }

  protected async applyPromo(): Promise<void> {
    const promoCode = this.promoInput().trim();
    this.errorMessage.set('');
    this.clearPromoFeedback();

    if (!promoCode) {
      this.clearAppliedPromoState();
      this.setPromoFeedback('success', 'Промокод очищен. Итоговая сумма снова без скидки.');
      this.logInfo('payment.checkout.notary.promo_cleared');
      return;
    }

    this.promoLoading.set(true);

    try {
      this.logInfo('payment.checkout.notary.promo_validation_started', {
        planCode: this.selectedPlanCode(),
        promoCodeLength: promoCode.length,
      });
      const validation = await this.checkoutApi.validateSubscriptionPromo({
        planCode: this.selectedPlanCode(),
        promoCode,
      });

      if (validation.status !== 'valid') {
        this.clearAppliedPromoState();
        this.setPromoFeedback('error', promoValidationMessage(validation.status));
        this.logWarn('payment.checkout.notary.promo_validation_rejected', {
          validationStatus: validation.status,
          planCode: this.selectedPlanCode(),
        });
        return;
      }

      this.promoInput.set(validation.promoCode);
      this.appliedPromoCode.set(validation.promoCode);
      this.promoPreviewAmount.set(validation.finalAmount);
      this.promoDiscountAmount.set(
        validation.discountAmount === '0.00' ? null : validation.discountAmount,
      );
      this.confirmedAmount.set(null);
      this.setPromoFeedback('success', 'Промокод применён.');
      this.logInfo('payment.checkout.notary.promo_applied', {
        planCode: this.selectedPlanCode(),
        baseAmount: validation.baseAmount,
        finalAmount: validation.finalAmount,
        discountAmount: validation.discountAmount,
        discountPercent: validation.discountPercent,
      });
    } catch (error) {
      this.logError('payment.checkout.notary.promo_validation_failed', error, {
        planCode: this.selectedPlanCode(),
        promoCodeLength: promoCode.length,
      });
      this.clearAppliedPromoState();
      this.setPromoFeedback('error', 'Не удалось проверить промокод. Попробуйте ещё раз.');
    } finally {
      this.promoLoading.set(false);
    }
  }

  protected async startPayment(): Promise<void> {
    this.logInfo('payment.checkout.notary.start_requested');
    if (this.hasPendingPromoChanges()) {
      this.setPromoFeedback(
        'error',
        'Промокод ещё не применён. Нажмите «Применить» или очистите поле.',
      );
      this.logWarn('payment.checkout.notary.start_blocked_pending_promo', {
        promoCodeLength: this.promoInput().trim().length,
      });
      return;
    }

    const userId = this.requireUserId();
    if (!userId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.errorTitle.set('Не получилось продолжить оплату');
    this.notice.set('');
    this.clearPromoFeedback();
    this.confirmedAmount.set(null);
    this.state.set('ready');
    this.destroyWidget();
    this.widgetResultHandled = false;

    try {
      this.logInfo('payment.checkout.notary.subscription_draft_requested', {
        actorUserId: userId,
        planCode: this.selectedPlanCode(),
      });
      const subscriptionId = await this.checkoutApi.createSubscriptionDraft({
        userId,
        planCode: this.selectedPlanCode(),
      });
      this.logInfo('payment.checkout.notary.subscription_draft_created', {
        actorUserId: userId,
        subscriptionId,
        planCode: this.selectedPlanCode(),
      });

      this.logInfo('payment.checkout.notary.create_payment_requested', {
        actorUserId: userId,
        subscriptionId,
        requestedAmount: this.selectedPlan().price,
        promoApplied: Boolean(this.appliedPromoCode().trim()),
      });
      const response = await this.checkoutApi.createPayment({
        userId,
        amount: this.selectedPlan().price,
        subscriptionId,
        promoCode: this.appliedPromoCode().trim(),
        paymentProvider: 'yookassa',
      });

      this.paymentId.set(response.paymentId);
      this.confirmedAmount.set(response.amount?.amount?.trim() || this.selectedPlan().price);
      this.logInfo('payment.checkout.notary.create_payment_succeeded', {
        actorUserId: userId,
        subscriptionId,
        paymentId: response.paymentId,
        confirmedAmount: this.confirmedAmount(),
        currency: response.amount?.currency ?? 'RUB',
        promoApplied: Boolean(this.appliedPromoCode().trim()),
      });

      const confirmationToken = response.widget?.confirmationToken?.trim();
      if (!confirmationToken) {
        throw new Error('Backend did not return a YooKassa confirmation token');
      }

      this.state.set('widget');
      this.cdr.detectChanges();

      this.logInfo('payment.checkout.notary.widget_mount_requested', {
        actorUserId: userId,
        paymentId: response.paymentId,
      });
      this.widgetSession = await this.widgetService.mount(
        'yookassa-widget-host',
        confirmationToken,
        {
          onSuccess: () => void this.handleWidgetSuccess(),
          onFail: () => this.handleWidgetCancellation('Платёж был отменён в ЮKassa.'),
          onComplete: () => undefined,
          onClose: () => this.handleWidgetCancellation('Виджет оплаты закрыт. Попробуйте снова.'),
          onError: (error) => this.handleWidgetError(error),
        },
      );
      this.logInfo('payment.checkout.notary.widget_mounted', {
        actorUserId: userId,
        paymentId: response.paymentId,
      });
    } catch (error) {
      const promoErrorMessage = readPromoErrorMessage(error);
      if (promoErrorMessage) {
        this.clearAppliedPromoState();
        this.setPromoFeedback('error', promoErrorMessage);
        this.logWarn('payment.checkout.notary.start_rejected_by_promo', {
          promoErrorMessage,
        });
        return;
      }

      this.showErrorState(
        'Не получилось открыть оплату',
        'Мы не смогли подготовить платёж. Попробуйте ещё раз через несколько секунд.',
        'payment.checkout.notary.start_failed',
        error,
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async startRobokassaPayment(): Promise<void> {
    this.logInfo('payment.checkout.notary.robokassa_start_requested');
    if (this.hasPendingPromoChanges()) {
      this.setPromoFeedback(
        'error',
        'Промокод ещё не применён. Нажмите «Применить» или очистите поле.',
      );
      this.logWarn('payment.checkout.notary.robokassa_start_blocked_pending_promo', {
        promoCodeLength: this.promoInput().trim().length,
      });
      return;
    }

    const userId = this.requireUserId();
    if (!userId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.errorTitle.set('Не получилось продолжить оплату');
    this.notice.set('');
    this.clearPromoFeedback();
    this.confirmedAmount.set(null);
    this.state.set('ready');
    this.destroyWidget();
    this.widgetResultHandled = false;

    try {
      this.logInfo('payment.checkout.notary.robokassa_subscription_draft_requested', {
        actorUserId: userId,
        planCode: this.selectedPlanCode(),
      });
      const subscriptionId = await this.checkoutApi.createSubscriptionDraft({
        userId,
        planCode: this.selectedPlanCode(),
      });
      this.logInfo('payment.checkout.notary.robokassa_subscription_draft_created', {
        actorUserId: userId,
        subscriptionId,
        planCode: this.selectedPlanCode(),
      });

      this.logInfo('payment.checkout.notary.robokassa_create_payment_requested', {
        actorUserId: userId,
        subscriptionId,
        requestedAmount: this.selectedPlan().price,
        promoApplied: Boolean(this.appliedPromoCode().trim()),
      });
      const response = await this.checkoutApi.createPayment({
        userId,
        amount: this.selectedPlan().price,
        subscriptionId,
        promoCode: this.appliedPromoCode().trim(),
        paymentProvider: 'robokassa',
      });

      this.paymentId.set(response.paymentId);
      this.confirmedAmount.set(response.amount?.amount?.trim() || this.selectedPlan().price);
      this.logInfo('payment.checkout.notary.robokassa_create_payment_succeeded', {
        actorUserId: userId,
        subscriptionId,
        paymentId: response.paymentId,
        confirmedAmount: this.confirmedAmount(),
        currency: response.amount?.currency ?? 'RUB',
        promoApplied: Boolean(this.appliedPromoCode().trim()),
      });

      const paymentUrl = response.paymentUrl?.trim();
      if (!paymentUrl) {
        throw new Error('Backend did not return a Robokassa payment URL');
      }

      this.logInfo('payment.checkout.notary.robokassa_redirect', {
        actorUserId: userId,
        paymentId: response.paymentId,
        paymentUrl,
      });
      this.state.set('processing');
      this.cdr.detectChanges();
      window.location.href = paymentUrl;
    } catch (error) {
      const promoErrorMessage = readPromoErrorMessage(error);
      if (promoErrorMessage) {
        this.clearAppliedPromoState();
        this.setPromoFeedback('error', promoErrorMessage);
        this.logWarn('payment.checkout.notary.robokassa_start_rejected_by_promo', {
          promoErrorMessage,
        });
        return;
      }

      this.showErrorState(
        'Не получилось открыть оплату',
        'Мы не смогли подготовить платёж через Robokassa. Попробуйте ещё раз через несколько секунд.',
        'payment.checkout.notary.robokassa_start_failed',
        error,
      );
    } finally {
      this.loading.set(false);
    }
  }

  protected async retryStatusCheck(): Promise<void> {
    const userId = this.requireUserId();
    const paymentId = this.paymentId();
    if (!userId || !paymentId) {
      return;
    }

    this.logInfo('payment.checkout.notary.status_retry_requested', {
      actorUserId: userId,
      paymentId,
    });
    await this.confirmPayment(userId, paymentId);
  }

  protected resetCheckout(): void {
    if (this.isBusy()) {
      return;
    }

    this.logInfo('payment.checkout.notary.reset');
    this.state.set('ready');
    this.notice.set('');
    this.errorTitle.set('Не получилось продолжить оплату');
    this.errorMessage.set('');
    this.confirmedAmount.set(null);
    this.paymentId.set(null);
    this.destroyWidget();
    this.clearPromoFeedback();
  }

  protected readonly cabinetLink = '/notary';

  ngOnDestroy(): void {
    this.destroyWidget();
  }

  private async handleWidgetSuccess(): Promise<void> {
    if (!this.beginWidgetTerminalTransition()) {
      return;
    }

    const userId = this.requireUserId();
    const paymentId = this.paymentId();
    if (!userId || !paymentId) {
      return;
    }

    this.logInfo('payment.checkout.notary.widget_success', {
      actorUserId: userId,
      paymentId,
    });
    this.notice.set('');
    this.state.set('processing');
    await this.confirmPayment(userId, paymentId);
  }

  private handleWidgetCancellation(message: string): void {
    if (!this.beginWidgetTerminalTransition()) {
      return;
    }

    this.logWarn('payment.checkout.notary.widget_cancelled', {
      reason: message,
    });
    this.state.set('cancelled');
    this.notice.set('');
    this.errorMessage.set(message);
  }

  private handleWidgetError(error: unknown): void {
    if (!this.beginWidgetTerminalTransition()) {
      return;
    }

    this.showErrorState(
      'Не получилось продолжить оплату',
      'Мы не смогли завершить оплату через ЮKassa. Попробуйте открыть виджет ещё раз.',
      'payment.checkout.notary.widget_error',
      error,
    );
  }

  private async confirmPayment(userId: string, paymentId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.logInfo('payment.checkout.notary.status_check_started', {
        actorUserId: userId,
        paymentId,
      });
      const status = await this.checkoutApi.waitForPaymentStatus({
        userId,
        paymentId,
      });
      this.logInfo('payment.checkout.notary.status_check_finished', {
        actorUserId: userId,
        paymentId,
        status,
      });
      this.applyPaymentStatus(status);
    } catch (error) {
      this.showErrorState(
        'Не получилось подтвердить платёж',
        'Мы не смогли получить актуальный статус платежа. Попробуйте запросить проверку ещё раз.',
        'payment.checkout.notary.status_check_failed',
        error,
      );
    } finally {
      this.loading.set(false);
    }
  }

  private applyPaymentStatus(status: CheckoutPaymentStatus): void {
    switch (status) {
      case 'completed':
        this.state.set('success');
        this.notice.set('');
        this.errorMessage.set('');
        this.logInfo('payment.checkout.notary.status_applied', {
          status,
          nextState: 'success',
        });
        return;

      case 'failed':
      case 'refunded':
        this.state.set('cancelled');
        this.notice.set('');
        this.errorMessage.set('Платёж не был завершён. Можно попробовать ещё раз.');
        this.logWarn('payment.checkout.notary.status_applied', {
          status,
          nextState: 'cancelled',
        });
        return;

      case 'pending':
      case 'not_found':
      default:
        this.state.set('processing');
        this.errorMessage.set('');
        this.notice.set('');
        this.logInfo('payment.checkout.notary.status_applied', {
          status,
          nextState: 'processing',
        });
        return;
    }
  }

  private beginWidgetTerminalTransition(): boolean {
    if (this.widgetResultHandled) {
      this.logWarn('payment.checkout.notary.widget_terminal_event_ignored');
      return false;
    }

    this.widgetResultHandled = true;
    this.destroyWidget();
    return true;
  }

  private resumeFromFallbackRoute(): void {
    const routePath = this.route.snapshot.routeConfig?.path ?? '';
    const paymentId = this.route.snapshot.queryParamMap.get('paymentId')?.trim();

    if (routePath.endsWith('cancel')) {
      this.logWarn('payment.checkout.notary.fallback_cancelled', {
        routePath,
        paymentId,
      });
      this.state.set('cancelled');
      this.errorMessage.set('Оплата была отменена во внешнем сценарии. Попробуйте снова.');
      return;
    }

    if (!routePath.endsWith('success') || !paymentId) {
      return;
    }

    const userId = this.requireUserId();
    if (!userId) {
      return;
    }

    this.logInfo('payment.checkout.notary.fallback_success', {
      actorUserId: userId,
      routePath,
      paymentId,
    });
    this.paymentId.set(paymentId);
    this.state.set('processing');
    this.notice.set('');
    void this.confirmPayment(userId, paymentId);
  }

  private requireUserId(): string | null {
    const userId = this.tokenStore.user()?.id?.trim() ?? '';
    if (userId) {
      return userId;
    }

    this.logWarn('payment.checkout.notary.session_missing');
    this.showErrorState(
      'Нужно войти заново',
      'Сессия истекла. Авторизуйтесь снова и повторите оплату.',
    );
    void this.router.navigateByUrl('/auth');
    return null;
  }

  private showErrorState(
    title: string,
    message: string,
    logMessage?: string,
    error?: unknown,
  ): void {
    if (logMessage) {
      this.logError(logMessage, error);
    }

    this.state.set('error');
    this.notice.set('');
    this.errorTitle.set(title);
    this.errorMessage.set(message);
  }

  private clearAppliedPromoState(): void {
    this.appliedPromoCode.set('');
    this.promoPreviewAmount.set(null);
    this.promoDiscountAmount.set(null);
    this.confirmedAmount.set(null);
  }

  private clearPromoFeedback(): void {
    this.promoFeedback.set('');
    this.promoFeedbackTone.set(null);
  }

  private setPromoFeedback(tone: 'success' | 'error', message: string): void {
    this.promoFeedbackTone.set(tone);
    this.promoFeedback.set(message);
  }

  private destroyWidget(): void {
    if (this.widgetSession) {
      this.logInfo('payment.checkout.notary.widget_destroyed');
    }
    this.widgetSession?.destroy();
    this.widgetSession = null;
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
    const plan = this.selectedPlan();

    return {
      area: 'notary_subscription_checkout',
      route: '/notary/subscription/checkout',
      planCode: plan.code,
      paymentType: 'subscription',
      paymentId: this.paymentId(),
      state: this.state(),
      amount: this.displayAmount(),
      promoApplied: Boolean(this.appliedPromoCode().trim()),
      ...extra,
    };
  }
}

function resolvePlanCode(rawPlan: string | null): SubscriptionPlanCode {
  const plan = rawPlan?.trim().toLowerCase();
  return plan === 'premium' || plan === 'enterprise' ? plan : 'basic';
}

function normalizePromoCode(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function promoValidationMessage(status: CheckoutPromoValidationStatus): string {
  switch (status) {
    case 'expired':
      return 'Срок действия этого промокода закончился.';
    case 'usage_limit_reached':
      return 'Этот промокод больше недоступен.';
    case 'not_found':
    default:
      return 'Такой промокод не найден. Проверьте написание.';
  }
}

function readPromoErrorMessage(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message.trim();

  if (message.includes('Promo code was not found')) {
    return promoValidationMessage('not_found');
  }

  if (message.includes('Promo code has expired')) {
    return promoValidationMessage('expired');
  }

  if (message.includes('Promo code usage limit has been reached')) {
    return promoValidationMessage('usage_limit_reached');
  }

  return null;
}
