import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChangeDetectorRef, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { TokenStore, WebLoggerService } from '@notary-portal/ui';
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
  private readonly logger = inject(WebLoggerService);

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
    this.logInfo('payment.checkout.applicant.page_opened', {
      routePath: this.route.snapshot.routeConfig?.path ?? '',
    });
    this.resumeFromFallbackRoute();
  }

  protected async startPayment(): Promise<void> {
    this.logInfo('payment.checkout.applicant.start_requested');
    const userId = this.requireUserId();
    const targetId = this.targetId();
    if (!userId) {
      return;
    }

    if (!targetId) {
      this.logWarn('payment.checkout.applicant.start_blocked_missing_target');
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
      this.logInfo('payment.checkout.applicant.create_payment_requested', {
        actorUserId: userId,
        requestedAmount: this.baseAmount(),
      });
      const response = await this.checkoutApi.createPayment({
        userId,
        amount: this.baseAmount(),
        type: this.selectedService().rpcType,
        targetId,
      });

      this.paymentId.set(response.paymentId);
      this.confirmedAmount.set(response.amount?.amount?.trim() || this.baseAmount());
      this.logInfo('payment.checkout.applicant.create_payment_succeeded', {
        actorUserId: userId,
        paymentId: response.paymentId,
        confirmedAmount: this.confirmedAmount(),
        currency: response.amount?.currency ?? 'RUB',
      });

      const paymentUrl = response.paymentUrl?.trim();
      if (paymentUrl) {
        this.logInfo('payment.checkout.applicant.robokassa_redirect', {
          actorUserId: userId,
          paymentId: response.paymentId,
          paymentUrl,
        });
        this.state.set('processing');
        this.cdr.detectChanges();
        window.location.href = paymentUrl;
        return;
      }

      const confirmationToken = response.widget?.confirmationToken?.trim();
      if (!confirmationToken) {
        throw new Error('Backend did not return a payment URL or confirmation token');
      }

      this.state.set('widget');
      this.cdr.detectChanges();

      this.logInfo('payment.checkout.applicant.widget_mount_requested', {
        actorUserId: userId,
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
      this.logInfo('payment.checkout.applicant.widget_mounted', {
        actorUserId: userId,
      });
    } catch (error) {
      this.showErrorState(
        'Не получилось открыть оплату',
        'Мы не смогли подготовить платёж. Попробуйте ещё раз через несколько секунд.',
        'payment.checkout.applicant.start_failed',
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

    this.logInfo('payment.checkout.applicant.status_retry_requested', {
      actorUserId: userId,
      paymentId,
    });
    await this.confirmPayment(userId, paymentId);
  }

  protected resetCheckout(): void {
    if (this.isBusy()) {
      return;
    }

    this.logInfo('payment.checkout.applicant.reset');
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

    this.logInfo('payment.checkout.applicant.widget_success', {
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

    this.logWarn('payment.checkout.applicant.widget_cancelled', {
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
      'payment.checkout.applicant.widget_error',
      error,
    );
  }

  private async confirmPayment(userId: string, paymentId: string): Promise<void> {
    this.loading.set(true);
    try {
      this.logInfo('payment.checkout.applicant.status_check_started', {
        actorUserId: userId,
        paymentId,
      });
      const status = await this.checkoutApi.waitForPaymentStatus({
        userId,
        paymentId,
      });
      this.logInfo('payment.checkout.applicant.status_check_finished', {
        actorUserId: userId,
        paymentId,
        status,
      });
      this.applyPaymentStatus(status);
    } catch (error) {
      this.showErrorState(
        'Не получилось подтвердить платёж',
        'Мы не смогли получить актуальный статус платежа. Попробуйте запросить проверку ещё раз.',
        'payment.checkout.applicant.status_check_failed',
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
        this.logInfo('payment.checkout.applicant.status_applied', {
          status,
          nextState: 'success',
        });
        return;

      case 'failed':
      case 'refunded':
        this.state.set('cancelled');
        this.notice.set('');
        this.errorMessage.set('Платёж не был завершён. Можно попробовать ещё раз.');
        this.logWarn('payment.checkout.applicant.status_applied', {
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
        this.logInfo('payment.checkout.applicant.status_applied', {
          status,
          nextState: 'processing',
        });
        return;
    }
  }

  private beginWidgetTerminalTransition(): boolean {
    if (this.widgetResultHandled) {
      this.logWarn('payment.checkout.applicant.widget_terminal_event_ignored');
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
      this.logWarn('payment.checkout.applicant.fallback_cancelled', {
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

    this.logInfo('payment.checkout.applicant.fallback_success', {
      actorUserId: userId,
      routePath,
      paymentId,
    });
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

    this.logWarn('payment.checkout.applicant.session_missing');
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

  private destroyWidget(): void {
    if (this.widgetSession) {
      this.logInfo('payment.checkout.applicant.widget_destroyed');
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
    const service = this.selectedService();

    return {
      area: 'applicant_checkout',
      route: '/applicant/checkout',
      serviceCode: service.code,
      paymentType: service.rpcType,
      targetId: this.targetId(),
      paymentId: this.paymentId(),
      state: this.state(),
      amount: this.displayAmount(),
      ...extra,
    };
  }
}
