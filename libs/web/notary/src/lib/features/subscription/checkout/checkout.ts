import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangeDetectorRef, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TokenStore } from '@notary-portal/ui';
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

  private widgetSession: YooKassaWidgetSession | null = null;
  private widgetResultHandled = false;

  constructor() {
    this.resumeFromFallbackRoute();
  }

  protected selectPlan(code: SubscriptionPlanCode): void {
    if (code === this.selectedPlanCode() || this.isBusy()) {
      return;
    }

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
      return;
    }

    this.promoLoading.set(true);

    try {
      const validation = await this.checkoutApi.validateSubscriptionPromo({
        planCode: this.selectedPlanCode(),
        promoCode,
      });

      if (validation.status !== 'valid') {
        this.clearAppliedPromoState();
        this.setPromoFeedback('error', promoValidationMessage(validation.status));
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
    } catch (error) {
      console.error('[Checkout] Failed to validate promo code', error);
      this.clearAppliedPromoState();
      this.setPromoFeedback('error', 'Не удалось проверить промокод. Попробуйте ещё раз.');
    } finally {
      this.promoLoading.set(false);
    }
  }

  protected async startPayment(): Promise<void> {
    if (this.hasPendingPromoChanges()) {
      this.setPromoFeedback(
        'error',
        'Промокод ещё не применён. Нажмите «Применить» или очистите поле.',
      );
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
      const subscriptionId = await this.checkoutApi.createSubscriptionDraft({
        userId,
        planCode: this.selectedPlanCode(),
      });

      const response = await this.checkoutApi.createPayment({
        userId,
        amount: this.selectedPlan().price,
        subscriptionId,
        promoCode: this.appliedPromoCode().trim(),
      });

      const confirmationToken = response.widget?.confirmationToken?.trim();
      if (!confirmationToken) {
        throw new Error('Backend did not return a YooKassa confirmation token');
      }

      this.paymentId.set(response.paymentId);
      this.confirmedAmount.set(response.amount?.amount?.trim() || this.selectedPlan().price);
      this.state.set('widget');
      this.cdr.detectChanges();

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
    } catch (error) {
      const promoErrorMessage = readPromoErrorMessage(error);
      if (promoErrorMessage) {
        this.clearAppliedPromoState();
        this.setPromoFeedback('error', promoErrorMessage);
        return;
      }

      this.showErrorState(
        'Не получилось открыть оплату',
        'Мы не смогли подготовить платёж. Попробуйте ещё раз через несколько секунд.',
        'Failed to start checkout payment',
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

    await this.confirmPayment(userId, paymentId);
  }

  protected resetCheckout(): void {
    if (this.isBusy()) {
      return;
    }

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

    this.notice.set('');
    this.state.set('processing');
    await this.confirmPayment(userId, paymentId);
  }

  private handleWidgetCancellation(message: string): void {
    if (!this.beginWidgetTerminalTransition()) {
      return;
    }

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
      'YooKassa widget error',
      error,
    );
  }

  private async confirmPayment(userId: string, paymentId: string): Promise<void> {
    this.loading.set(true);
    try {
      const status = await this.checkoutApi.waitForPaymentStatus({
        userId,
        paymentId,
      });
      this.applyPaymentStatus(status);
    } catch (error) {
      this.showErrorState(
        'Не получилось подтвердить платёж',
        'Мы не смогли получить актуальный статус платежа. Попробуйте запросить проверку ещё раз.',
        'Failed to confirm payment status',
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
        return;

      case 'failed':
      case 'refunded':
        this.state.set('cancelled');
        this.notice.set('');
        this.errorMessage.set('Платёж не был завершён. Можно попробовать ещё раз.');
        return;

      case 'pending':
      case 'not_found':
      default:
        this.state.set('processing');
        this.errorMessage.set('');
        this.notice.set('');
        return;
    }
  }

  private beginWidgetTerminalTransition(): boolean {
    if (this.widgetResultHandled) {
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
      console.error(`[Checkout] ${logMessage}`, error);
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
    this.widgetSession?.destroy();
    this.widgetSession = null;
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
