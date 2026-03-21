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
  protected readonly promoCode = signal('');
  protected readonly notice = signal('');
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
    () => this.confirmedAmount() ?? this.selectedPlan().price,
  );
  protected readonly displayAmountLabel = computed(() => formatPrice(this.displayAmount()));
  protected readonly isBusy = computed(
    () => this.loading() || this.state() === 'widget' || this.state() === 'processing',
  );

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
    this.errorMessage.set('');
    this.state.set('ready');
    this.paymentId.set(null);
    this.destroyWidget();
  }

  protected applyPromo(): void {
    const promoCode = this.promoCode().trim();
    this.errorMessage.set('');

    if (!promoCode) {
      this.notice.set('Промокод очищен. Итоговая сумма будет без скидки.');
      this.confirmedAmount.set(null);
      return;
    }

    this.notice.set('Промокод сохранён. Сервер проверит скидку при создании платежа.');
  }

  protected async startPayment(): Promise<void> {
    const userId = this.requireUserId();
    if (!userId) {
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.notice.set('');
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
        promoCode: this.promoCode().trim(),
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
          onComplete: () =>
            this.notice.set('Платёж отправлен в обработку, ждём подтверждение webhook.'),
          onClose: () => this.handleWidgetCancellation('Виджет оплаты закрыт. Попробуйте снова.'),
          onError: (error) => this.handleWidgetError(error),
        },
      );
    } catch (error) {
      this.state.set('error');
      this.errorMessage.set(readErrorMessage(error, 'Не удалось создать платёж'));
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
    this.errorMessage.set('');
    this.confirmedAmount.set(null);
    this.paymentId.set(null);
    this.destroyWidget();
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

    this.notice.set('Платёж подтверждён в виджете. Проверяем статус на сервере...');
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

    this.state.set('error');
    this.notice.set('');
    this.errorMessage.set(readErrorMessage(error, 'Виджет ЮKassa завершился с ошибкой'));
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
      this.state.set('error');
      this.errorMessage.set(readErrorMessage(error, 'Не удалось получить статус платежа'));
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
        this.notice.set(
          'ЮKassa уже приняла платёж, но webhook ещё не обновил статус. Нажмите "Проверить ещё раз" через несколько секунд.',
        );
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
    this.notice.set('Возвращение из ЮKassa завершено. Проверяем финальный статус платежа...');
    void this.confirmPayment(userId, paymentId);
  }

  private requireUserId(): string | null {
    const userId = this.tokenStore.user()?.id?.trim() ?? '';
    if (userId) {
      return userId;
    }

    this.state.set('error');
    this.errorMessage.set(
      'Сессия пользователя недоступна. Авторизуйтесь заново и повторите оплату.',
    );
    void this.router.navigateByUrl('/auth');
    return null;
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

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}
