import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangeDetectorRef, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { TokenStore } from '@notary-portal/ui';
import {
  APPLICANT_CHECKOUT_SERVICES,
  formatPrice,
  resolveApplicantCheckoutService,
  resolveApplicantCheckoutServiceCode,
  resolveCheckoutAmount,
  type ApplicantCheckoutServiceViewModel,
} from './checkout.models';
import { CheckoutApiService, type CheckoutPaymentStatus } from './checkout-api.service';
import { YooKassaWidgetService, type YooKassaWidgetSession } from './yookassa-widget.service';

type CheckoutState = 'ready' | 'widget' | 'processing' | 'success' | 'cancelled' | 'error';

@Component({
  selector: 'lib-checkout',
  imports: [RouterLink],
  templateUrl: './checkout.html',
  styleUrl: './checkout.scss',
})
export class Checkout implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly tokenStore = inject(TokenStore);
  private readonly checkoutApi = inject(CheckoutApiService);
  private readonly widgetService = inject(YooKassaWidgetService);

  protected readonly services = APPLICANT_CHECKOUT_SERVICES;
  protected readonly formatPrice = formatPrice;
  protected readonly state = signal<CheckoutState>('ready');
  protected readonly loading = signal(false);
  protected readonly notice = signal('');
  protected readonly errorTitle = signal('Не получилось продолжить оплату');
  protected readonly errorMessage = signal('');
  protected readonly paymentId = signal<string | null>(null);
  protected readonly confirmedAmount = signal<string | null>(null);
  protected readonly selectedServiceCode = signal(
    resolveApplicantCheckoutServiceCode(this.route.snapshot.queryParamMap.get('type')),
  );
  protected readonly selectedService = computed<ApplicantCheckoutServiceViewModel>(() =>
    resolveApplicantCheckoutService(this.selectedServiceCode()),
  );
  protected readonly serviceTitle = computed(() => {
    const override = this.route.snapshot.queryParamMap.get('title')?.trim();
    return override || this.selectedService().title;
  });
  protected readonly serviceDescription = computed(() => {
    const override = this.route.snapshot.queryParamMap.get('description')?.trim();
    return override || this.selectedService().description;
  });
  protected readonly targetId = computed(() => this.resolveTargetId(this.selectedService()));
  protected readonly baseAmount = computed(() =>
    resolveCheckoutAmount(
      this.route.snapshot.queryParamMap.get('amount'),
      this.selectedService().price,
    ),
  );
  protected readonly displayAmount = computed(() => this.confirmedAmount() ?? this.baseAmount());
  protected readonly displayAmountLabel = computed(() => formatPrice(this.displayAmount()));
  protected readonly isBusy = computed(
    () => this.loading() || this.state() === 'widget' || this.state() === 'processing',
  );
  protected readonly canStartPayment = computed(() => !this.isBusy() && Boolean(this.targetId()));
  protected readonly cabinetLink = '/applicant/payments';

  private widgetSession: YooKassaWidgetSession | null = null;
  private widgetResultHandled = false;

  constructor() {
    this.resumeFromFallbackRoute();
  }

  protected async startPayment(): Promise<void> {
    const userId = this.requireUserId();
    const targetId = this.targetId();
    if (!userId) {
      return;
    }

    if (!targetId) {
      this.showErrorState(
        'Не получилось определить услугу',
        'Для этой оплаты не хватает идентификатора заказа. Откройте checkout из карточки услуги и попробуйте снова.',
      );
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.errorTitle.set('Не получилось продолжить оплату');
    this.notice.set('');
    this.confirmedAmount.set(null);
    this.state.set('ready');
    this.destroyWidget();
    this.widgetResultHandled = false;

    try {
      const response = await this.checkoutApi.createPayment({
        userId,
        amount: this.baseAmount(),
        type: this.selectedService().rpcType,
        targetId,
      });

      const confirmationToken = response.widget?.confirmationToken?.trim();
      if (!confirmationToken) {
        throw new Error('Backend did not return a YooKassa confirmation token');
      }

      this.paymentId.set(response.paymentId);
      this.confirmedAmount.set(response.amount?.amount?.trim() || this.baseAmount());
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
      this.showErrorState(
        'Не получилось открыть оплату',
        'Мы не смогли подготовить платёж. Попробуйте ещё раз через несколько секунд.',
        'Failed to start applicant checkout payment',
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
  }

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
      'Applicant YooKassa widget error',
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
        'Failed to confirm applicant payment status',
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

  private resolveTargetId(service: ApplicantCheckoutServiceViewModel): string | null {
    for (const alias of service.targetAliases) {
      const value = this.route.snapshot.queryParamMap.get(alias)?.trim();
      if (value) {
        return value;
      }
    }

    return null;
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

  private destroyWidget(): void {
    this.widgetSession?.destroy();
    this.widgetSession = null;
  }
}
